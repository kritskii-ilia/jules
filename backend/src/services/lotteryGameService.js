const mongoose = require('mongoose');
const LotteryGame = require('../models/LotteryGameModel');
const User = require('../models/UserModel');
const Transaction = require('../models/TransactionModel');
const { lotteryGameConfig: defaultLotteryConfig } = require('../config/gameConfig'); // For ID and fallback
const gameSettingsService = require('./gameSettingsService'); // Import gameSettingsService
const provablyFairService = require('./provablyFairService');
const { getIO } = require('./socketService');

let lotteryState = {
  currentGame: null,
  roundEndTimer: null,
  config: null, // Will hold the dynamically fetched config
};

const LOTTERY_ROOM_ID = 'lottery_room_main'; // Single global lottery room

function emitToLotteryRoom(event, data) {
  const io = getIO();
  if (io) {
    io.to(LOTTERY_ROOM_ID).emit(event, data);
    console.log(`Emitted [${event}] to lottery room [${LOTTERY_ROOM_ID}]:`, JSON.stringify(data).substring(0,100));
  } else {
    console.error('Socket.IO not initialized, cannot emit event to lottery room:', event);
  }
}

function scheduleRoundEnd(game) {
  if (lotteryState.roundEndTimer) {
    clearTimeout(lotteryState.roundEndTimer);
  }

  const now = Date.now();
  const endsAtTime = new Date(game.endsAt).getTime();
  const timeRemainingMs = endsAtTime - now;

  if (timeRemainingMs <= 0) {
    console.log(`Lottery round ${game.gameId} has already ended. Processing winner determination.`);
    determineWinner(game.gameId);
  } else {
    console.log(`Lottery round ${game.gameId} will end in ${timeRemainingMs / 1000 / 60} minutes. Scheduling winner determination.`);
    lotteryState.roundEndTimer = setTimeout(() => {
      determineWinner(game.gameId);
    }, timeRemainingMs);
  }
}

async function initializeNewLotteryRound() {
  const dynamicConfig = await gameSettingsService.getGameSettings(defaultLotteryConfig.id);
  if (!dynamicConfig) {
    console.error(`CRITICAL: Lottery game configuration (ID: ${defaultLotteryConfig.id}) not found. Cannot initialize new round.`);
    emitToLotteryRoom('gameError', { message: `Critical error: Lottery game configuration is missing. Round cannot start.` });
    return null;
  }
  lotteryState.config = dynamicConfig; // Store fetched config

  const serverSeed = provablyFairService.generateServerSeed();
  const hashedServerSeed = provablyFairService.hashServerSeed(serverSeed);
  const nonce = lotteryState.currentGame ? lotteryState.currentGame.nonce + 1 : 1;
  const now = new Date();
  const endsAt = new Date(now.getTime() + lotteryState.config.roundDurationHours * 60 * 60 * 1000);

  const newGame = new LotteryGame({
    gameId: `lottery-${now.getTime()}-${nonce}`,
    status: 'running',
    bets: [],
    totalPotCoins: 0,
    serverSeed,
    hashedServerSeed,
    clientSeed: 'default_client_seed_lottery',
    nonce,
    commissionRatePercent: lotteryState.config.commissionRatePercent,
    startedAt: now,
    endsAt,
    log: [`Lottery round ${nonce} initialized. Ends at: ${endsAt.toISOString()}`]
  });

  try {
    await newGame.save();
    lotteryState.currentGame = newGame; // Mongoose model instance
    scheduleRoundEnd(newGame);

    console.log(`New lottery round ${newGame.gameId} initialized with dynamic config. Ends At: ${newGame.endsAt.toISOString()}. Hashed Seed: ${hashedServerSeed}`);
    emitToLotteryRoom('newLotteryRound', {
      gameId: newGame.gameId,
      status: 'running',
      totalPotCoins: 0,
      hashedServerSeed,
      endsAt: newGame.endsAt,
      numberOfFields: lotteryState.config.numberOfFields,
      minBetPerFieldCoins: lotteryState.config.minBetPerFieldCoins,
    });
    return newGame; // Return Mongoose model instance
  } catch (error) {
    console.error(`Error initializing new lottery round:`, error);
     if (newGame) {
        newGame.log.push(`Error initializing: ${error.message}`);
        newGame.status = 'error';
        await newGame.save().catch(e => console.error("Failed to save error state for lottery:", e));
    }
    return null;
  }
}

async function getCurrentLotteryGame() {
  if (!lotteryState.currentGame || lotteryState.currentGame.status === 'finished' || lotteryState.currentGame.status === 'error') {
    console.log(`No current lottery game or last one finished/errored. Initializing new one.`);
    return await initializeNewLotteryRound();
  }
  // Ensure timer is running if game is active
  if (lotteryState.currentGame.status === 'running' && !lotteryState.roundEndTimer) {
      console.log("Timer for current lottery game was not active. Re-scheduling.");
      scheduleRoundEnd(lotteryState.currentGame);
  }
  return lotteryState.currentGame;
}

async function placeBet(userId, username, photoUrl, fieldNumber, amount) {
  const game = await getCurrentLotteryGame(); // Ensures config is loaded into lotteryState.config if new round starts
  const config = lotteryState.config;

  if (!game || !config) {
    console.error(`CRITICAL: Lottery game or config not available for betting. Game: ${!!game}, Config: ${!!config}`);
    throw new Error('Lottery system error. Please try again later.');
  }

  if (game.status !== 'running') {
    throw new Error('Lottery is not active or accepting bets.');
  }
  if (fieldNumber < 1 || fieldNumber > config.numberOfFields) {
    throw new Error(`Invalid field number. Must be between 1 and ${config.numberOfFields}.`);
  }
  if (amount < config.minBetPerFieldCoins) {
    throw new Error(`Minimum bet per field is ${config.minBetPerFieldCoins} coins.`);
  }
   if (new Date() >= new Date(game.endsAt)) {
    throw new Error('Betting for this lottery round has closed.');
  }

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');
  if (user.balance < amount) throw new Error('Insufficient balance.');
   if (user.isGamingDisabledUntil && new Date() < new Date(user.isGamingDisabledUntil)) {
    throw new Error(`Gaming is disabled for this user until ${new Date(user.isGamingDisabledUntil).toLocaleString()}`);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    user.balance -= amount;
    await user.save({ session });

    const betTransaction = new Transaction({
      userId,
      type: 'bet', // Or 'lottery_bet'
      amount: amount,
      currency: config.currency,
      description: `Bet on field ${fieldNumber} in Lottery ${game.gameId}`,
      relatedGameId: game._id.toString(),
      status: 'completed',
    });
    await betTransaction.save({ session });

    const betData = { userId, username, photoUrl, fieldNumber, amount, timestamp: new Date() };
    game.bets.push(betData);
    game.totalPotCoins += amount;
    game.log.push(`${username} bet ${amount} on field ${fieldNumber}. Pot: ${game.totalPotCoins}.`);
    
    await game.save({ session });
    await session.commitTransaction();

    emitToLotteryRoom('lotteryBetPlaced', { 
        gameId: game.gameId, 
        bet: betData,
    });
    emitToLotteryRoom('lotteryPotUpdate', { gameId: game.gameId, totalPotCoins: game.totalPotCoins });
    
    return { game, bet: betData };

  } catch (error) {
    await session.abortTransaction();
    console.error(`Error processing lottery bet for ${username} in ${game.gameId}:`, error);
    throw error;
  } finally {
    session.endSession();
  }
}

async function determineWinner(gameId) {
  let game = lotteryState.currentGame;
  // If the game in state doesn't match, or is null, fetch it.
  if (!game || game.gameId !== gameId) {
    game = await LotteryGame.findOne({ gameId }); // Fetch from DB if not in memory
  }
  
  const config = lotteryState.config; // Use the config from the current lottery state

  if (!game || !config) {
    console.error(`CRITICAL: Lottery game or config not available for winner determination. Game ID: ${gameId}, Config: ${!!config}`);
    if (game && !config) { // Game exists but config is missing
        game.status = 'error';
        game.log.push('Critical: Missing configuration for winner determination.');
        await game.save().catch(e => console.error("Failed to save error state:", e));
        emitToLotteryRoom('gameError', { gameId, message: `Game configuration error for lottery. Cannot determine winner.` });
    }
    return;
  }
  if (game.status !== 'running') {
    console.warn(`Lottery game ${gameId} is not in 'running' state for winner determination. Status: ${game.status}`);
    // If already finished or errored, don't reprocess. If drawing, maybe it timed out before, retry?
    if (game.status === 'finished' || game.status === 'error') return;
  }

  game.status = 'drawing_winner';
  game.log.push('Determining winner...');
  await game.save(); // Save status change
  emitToLotteryRoom('lotteryStatusUpdate', { gameId: game.gameId, status: game.status });

  const winningField = provablyFairService.generateGameResult(
    game.serverSeed,
    game.clientSeed,
    game.nonce,
    config.numberOfFields 
  ) + 1; // Result is 0-N-1, so add 1 for field 1-N

  game.winningField = winningField;
  game.log.push(`Winning field is ${winningField}.`);

  const betsOnWinningField = game.bets.filter(b => b.fieldNumber === winningField);
  const commission = Math.floor((game.totalPotCoins * config.commissionRatePercent) / 100);
  const potAfterCommission = game.totalPotCoins - commission;
  game.commissionAmount = commission;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (betsOnWinningField.length > 0) {
      const totalBetAmountOnWinningField = betsOnWinningField.reduce((sum, b) => sum + b.amount, 0);
      
      for (const bet of betsOnWinningField) {
        const proportionOfBet = bet.amount / totalBetAmountOnWinningField;
        const payout = Math.floor(proportionOfBet * potAfterCommission); // Distribute proportionally

        if (payout > 0) {
          const winnerUser = await User.findById(bet.userId).session(session);
          if (winnerUser) {
            winnerUser.balance += payout;
            await winnerUser.save({ session });

            game.winners.push({
              userId: bet.userId,
              username: bet.username,
              photoUrl: bet.photoUrl,
              totalBetOnWinningField: bet.amount, // Or sum all bets by this user on this field if they can bet multiple times
              payout,
            });

            const winTransaction = new Transaction({
              userId: bet.userId,
              type: 'win', // Or 'lottery_win'
              amount: payout,
              currency: config.currency,
              description: `Win in Lottery ${game.gameId} on field ${winningField}. Bet amount: ${bet.amount}`,
              relatedGameId: game._id.toString(),
              status: 'completed',
            });
            await winTransaction.save({ session });
          } else {
             game.log.push(`Winner user ${bet.userId} not found for payout.`);
          }
        }
      }
      game.log.push(`Distributed ${potAfterCommission} among ${game.winners.length} winning bets on field ${winningField}.`);
    } else {
      game.log.push(`No winning bets on field ${winningField}. Pot (after commission) of ${potAfterCommission} goes to house/rollover.`);
      // If pot goes to house, create a transaction for that if needed.
      // For now, it's implicitly part of the commission logic / remaining pot.
    }

    if (commission > 0) {
        const commissionTransaction = new Transaction({
            type: 'commission',
            amount: commission,
            currency: config.currency,
            description: `Commission from Lottery Game ${game.gameId}`,
            relatedGameId: game._id.toString(),
            status: 'completed',
        });
        await commissionTransaction.save({ session });
    }

    game.status = 'finished';
    await game.save({ session });
    await session.commitTransaction();

    emitToLotteryRoom('lotteryFinished', {
      gameId: game.gameId,
      status: game.status,
      winningField: game.winningField,
      winners: game.winners,
      totalPotCoins: game.totalPotCoins,
      commissionAmount: game.commissionAmount,
      serverSeed: game.serverSeed, // Reveal server seed
      clientSeed: game.clientSeed,
      nonce: game.nonce,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error(`Error during lottery winner processing for ${game.gameId}:`, error);
    game.status = 'error';
    game.log.push(`Error during winner processing: ${error.message}`);
    await game.save(); 
    emitToLotteryRoom('lotteryError', { gameId: game.gameId, message: 'Error processing winner payout.' });
  } finally {
    session.endSession();
  }

  console.log(`Lottery round ${game.gameId} finished. Next round will start automatically if server is running.`);
  // The next round will be initialized when getCurrentLotteryGame() is called again.
  // Or, explicitly start a new one after a delay:
  lotteryState.currentGame = null; // Clear current game so next getCurrentLotteryGame call initializes a new one
  setTimeout(initializeNewLotteryRound, 10000); // Start new round after 10 seconds
}


async function initializeLotteryGame() {
  console.log(`Initializing Lottery Game...`);
  const config = await gameSettingsService.getGameSettings(defaultLotteryConfig.id);
  if (!config) {
      console.error(`CRITICAL: Lottery game configuration (ID: ${defaultLotteryConfig.id}) not found on startup. Lottery game will not function correctly.`);
      lotteryState.config = defaultLotteryConfig; // Use default as a last resort or null
  } else {
      lotteryState.config = config;
  }

  lotteryState.currentGame = await LotteryGame.findOne({ status: 'running' }).sort({ createdAt: -1 });
  
  if (lotteryState.currentGame) {
    console.log(`Found active lottery game: ${lotteryState.currentGame.gameId}, ends at ${lotteryState.currentGame.endsAt.toISOString()}. Using dynamic config.`);
    scheduleRoundEnd(lotteryState.currentGame); 
  } else {
    const drawingGame = await LotteryGame.findOne({ status: 'drawing_winner' }).sort({ createdAt: -1 });
    if (drawingGame) {
        console.log(`Found lottery game ${drawingGame.gameId} in 'drawing_winner' state. Re-attempting winner determination with dynamic config.`);
        // Config should be loaded in lotteryState by now. If not, determineWinner will handle it.
        determineWinner(drawingGame.gameId); 
    } else {
        console.log('No active or drawing lottery game found. Initializing a new round with dynamic config.');
        // This will use lotteryState.config already fetched (or fallback)
        await initializeNewLotteryRound(); 
    }
  }
  console.log("Lottery Game service initialized with dynamic config.");
}

async function updateClientSeedForLottery(newClientSeed) {
    // Ensure config is loaded before proceeding
    if (!lotteryState.config) {
        const loadedConfig = await gameSettingsService.getGameSettings(defaultLotteryConfig.id);
        if (!loadedConfig) throw new Error('Lottery configuration not loaded, cannot update client seed.');
        lotteryState.config = loadedConfig;
    }
    const game = await getCurrentLotteryGame(); 
    if (!game) throw new Error('Lottery game not available.');

    game.clientSeed = newClientSeed; // Modification on the Mongoose model instance
    game.log.push(`Client seed updated to ${newClientSeed}.`);
    await game.save();
    console.log(`Lottery client seed updated to ${newClientSeed} for game ${game.gameId}.`);
    emitToLotteryRoom('clientSeedUpdate', { gameId: game.gameId, message: 'Client seed has been updated.' });
    return { message: 'Client seed updated. It will be used in the current lottery round if it has not ended.' };
}

module.exports = {
  initializeLotteryGame,
  getCurrentLotteryGame,
  placeBet,
  updateClientSeedForLottery,
  LOTTERY_ROOM_ID,
};
