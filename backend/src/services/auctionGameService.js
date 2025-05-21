const mongoose = require('mongoose');
const AuctionGame = require('../models/AuctionGameModel');
const User = require('../models/UserModel');
const Transaction = require('../models/TransactionModel');
const { auctionGameConfig: defaultAuctionConfig } = require('../config/gameConfig'); // For ID and fallback
const gameSettingsService = require('./gameSettingsService'); // Import gameSettingsService
const provablyFairService = require('./provablyFairService');
const { getIO } = require('./socketService');

let auctionState = {
  currentGame: null,
  timer: null,
  config: null, // Will hold the dynamically fetched config
};

const AUCTION_ROOM_ID = 'auction_room_main'; // Single global auction room

function emitToAuctionRoom(event, data) {
  const io = getIO();
  if (io) {
    io.to(AUCTION_ROOM_ID).emit(event, data);
    console.log(`Emitted [${event}] to auction room [${AUCTION_ROOM_ID}]:`, JSON.stringify(data).substring(0,100));
  } else {
    console.error('Socket.IO not initialized, cannot emit event to auction room:', event);
  }
}

async function initializeNewAuctionRound() {
  const dynamicConfig = await gameSettingsService.getGameSettings(defaultAuctionConfig.id);
  if (!dynamicConfig) {
    console.error(`CRITICAL: Auction game configuration (ID: ${defaultAuctionConfig.id}) not found. Cannot initialize new round.`);
    emitToAuctionRoom('gameError', { message: `Critical error: Auction game configuration is missing. Round cannot start.` });
    return null;
  }
  auctionState.config = dynamicConfig; // Store fetched config in state

  const serverSeed = provablyFairService.generateServerSeed();
  const hashedServerSeed = provablyFairService.hashServerSeed(serverSeed);
  const nonce = auctionState.currentGame ? auctionState.currentGame.nonce + 1 : 1;

  const newGame = new AuctionGame({
    gameId: `auction-${Date.now()}-${nonce}`,
    status: 'waiting',
    currentPotCoins: auctionState.config.initialVirtualBankCoins,
    bets: [],
    lastBidder: null,
    winnerId: null,
    serverSeed, 
    hashedServerSeed,
    clientSeed: 'default_client_seed_auction', 
    nonce,
    commissionRatePercent: auctionState.config.commissionRatePercent,
    initialVirtualBankCoins: auctionState.config.initialVirtualBankCoins,
    log: [`Auction round ${nonce} initialized with ${auctionState.config.initialVirtualBankCoins} virtual coins.`]
  });

  try {
    await newGame.save();
    auctionState.currentGame = newGame; // currentGame is now the Mongoose model instance
    if (auctionState.timer) clearTimeout(auctionState.timer);
    auctionState.timer = null;

    console.log(`New auction round ${newGame.gameId} initialized with dynamic config. Hashed Seed: ${hashedServerSeed}`);
    emitToAuctionRoom('newAuctionRound', {
      gameId: newGame.gameId,
      status: 'waiting',
      currentPotCoins: newGame.currentPotCoins,
      lastBidder: null,
      hashedServerSeed,
      timerRemaining: null,
      initialVirtualBankCoins: auctionState.config.initialVirtualBankCoins,
      fixedBetAmountCoins: auctionState.config.fixedBetAmountCoins,
      timerDurationSeconds: auctionState.config.timerDurationSeconds,
    });
    return newGame; // Return the Mongoose model instance
  } catch (error) {
    console.error(`Error initializing new auction round:`, error);
    if (newGame) {
        newGame.log.push(`Error initializing: ${error.message}`);
        newGame.status = 'error';
        await newGame.save().catch(e => console.error("Failed to save error state for auction:", e));
    }
    return null;
  }
}

async function getCurrentGame() {
  if (!auctionState.currentGame || auctionState.currentGame.status === 'finished' || auctionState.currentGame.status === 'error') {
    console.log(`No current auction game or last one finished/errored. Initializing new one.`);
    return await initializeNewAuctionRound();
  }
  return auctionState.currentGame;
}

function startOrResetAuctionTimer() {
  const game = auctionState.currentGame;
  if (!game) return; // Game is from auctionState.currentGame
  const currentConfig = auctionState.config;
  if (!currentConfig) {
    console.error(`CRITICAL: Missing configuration for auction game ${game.gameId} when starting timer.`);
    game.status = 'error';
    game.log.push('Critical: Missing configuration for timer start.');
    game.save().catch(e => console.error("Failed to save error state:", e));
    emitToAuctionRoom('gameError', { message: `Game configuration error for auction. Timer cannot start.` });
    return;
  }

  if (auctionState.timer) {
    clearTimeout(auctionState.timer);
  }
  
  game.status = 'running'; 
  let timerRemaining = currentConfig.timerDurationSeconds;

  emitToAuctionRoom('timerUpdate', { gameId: game.gameId, timerRemaining, status: game.status });

  const timerTick = () => {
    timerRemaining--;
    if (timerRemaining > 0) {
      emitToAuctionRoom('timerUpdate', { gameId: game.gameId, timerRemaining, status: game.status });
      auctionState.timer = setTimeout(timerTick, 1000);
    } else {
      emitToAuctionRoom('timerUpdate', { gameId: game.gameId, timerRemaining: 0, status: 'ending' });
      determineWinner();
    }
  };
  auctionState.timer = setTimeout(timerTick, 1000);
  // No need to save game on timer start, only on significant events like bets or finish.
}

async function placeBid(userId, username, photoUrl) {
  const game = await getCurrentGame(); // This ensures config is loaded into auctionState.config if a new round starts
  const config = auctionState.config;

  if (!game || !config) {
    console.error(`CRITICAL: Auction game or config not available for bidding. Game: ${!!game}, Config: ${!!config}`);
    throw new Error('Auction system error. Please try again later.');
  }

  if (game.status !== 'waiting' && game.status !== 'running') {
    throw new Error('Auction is not active or accepting bids.');
  }
  if (game.lastBidder && game.lastBidder.userId.equals(userId)) {
    throw new Error('You are already the last bidder.');
  }

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');
  if (user.balance < config.fixedBetAmountCoins) throw new Error('Insufficient balance for a bid.');
  if (user.isGamingDisabledUntil && new Date() < new Date(user.isGamingDisabledUntil)) {
    throw new Error(`Gaming is disabled for this user until ${new Date(user.isGamingDisabledUntil).toLocaleString()}`);
  }
  
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    user.balance -= config.fixedBetAmountCoins;
    await user.save({ session });

    const betTransaction = new Transaction({
      userId,
      type: 'bet', // Or 'auction_bid'
      amount: config.fixedBetAmountCoins,
      currency: config.currency,
      description: `Bid in Auction Game ${game.gameId}`,
      relatedGameId: game._id.toString(), // Use MongoDB _id
      status: 'completed',
    });
    await betTransaction.save({ session });

    const bidData = { userId, username, photoUrl, amount: config.fixedBetAmountCoins, timestamp: new Date() };
    game.bets.push(bidData);
    game.lastBidder = { userId, username, photoUrl };
    game.currentPotCoins += config.fixedBetAmountCoins;
    game.log.push(`${username} placed a bid. Pot: ${game.currentPotCoins}.`);

    const isFirstBid = game.status === 'waiting';
    if (isFirstBid) {
      game.startedAt = new Date();
    }
    game.status = 'running'; // Set/confirm status

    await game.save({ session });
    await session.commitTransaction();

    emitToAuctionRoom('newBid', { 
        gameId: game.gameId, 
        bidder: { userId, username, photoUrl }, 
        pot: game.currentPotCoins 
    });
    emitToAuctionRoom('lastBidderUpdate', { gameId: game.gameId, lastBidder: game.lastBidder });
    emitToAuctionRoom('potUpdate', { gameId: game.gameId, currentPotCoins: game.currentPotCoins });
    
    startOrResetAuctionTimer(); // This will also emit timerUpdate

    return { game, bid: bidData };

  } catch (error) {
    await session.abortTransaction();
    console.error(`Error processing bid for ${username} in auction ${game.gameId}:`, error);
    throw error;
  } finally {
    session.endSession();
  }
}

async function determineWinner() {
  const game = auctionState.currentGame;
  const config = auctionState.config; // Use the config from the current auction state

  if (!game || !config) {
    console.error(`CRITICAL: Auction game or config not available for winner determination. Game: ${!!game}, Config: ${!!config}`);
    if (!game && !config) await initializeNewAuctionRound(); // Try to re-initialize if everything is null
    else if (game && !config) { // Game exists but config is missing, critical error
        game.status = 'error';
        game.log.push('Critical: Missing configuration for winner determination.');
        await game.save().catch(e => console.error("Failed to save error state:", e));
        emitToAuctionRoom('gameError', { message: `Game configuration error for auction. Cannot determine winner.` });
    }
    return;
  }

  if (game.status !== 'running') { 
    console.error(`Cannot determine winner: Auction game not in correct state. Current status: ${game?.status}`);
    return;
  }
  if (!game.lastBidder) {
    game.status = 'finished'; 
    game.log.push('Auction ended with no bids. No winner.');
    game.endedAt = new Date();
    await game.save();
    emitToAuctionRoom('auctionFinished', { gameId: game.gameId, message: 'Auction ended with no bids.', winner: null, pot: game.currentPotCoins });
    setTimeout(initializeNewAuctionRound, 10000); // Start new round after delay
    return;
  }

  game.status = 'finished';
  game.winnerId = game.lastBidder.userId;
  game.endedAt = new Date();

  const commission = Math.floor((game.currentPotCoins * config.commissionRatePercent) / 100);
  const amountWonByPlayer = game.currentPotCoins - commission;
  game.commissionAmount = commission;
  game.log.push(`Winner: ${game.lastBidder.username}. Pot: ${game.currentPotCoins}. Commission: ${commission}. Won: ${amountWonByPlayer}.`);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const winnerUser = await User.findById(game.winnerId).session(session);
    if (!winnerUser) throw new Error('Winner user not found in DB.');
    
    winnerUser.balance += amountWonByPlayer;
    await winnerUser.save({ session });

    const winTransaction = new Transaction({
      userId: game.winnerId,
      type: 'win', // Or 'auction_win'
      amount: amountWonByPlayer,
      currency: config.currency,
      description: `Win in Auction Game ${game.gameId}. Final Pot: ${game.currentPotCoins}`,
      relatedGameId: game._id.toString(),
      status: 'completed',
    });
    await winTransaction.save({ session });

    if (commission > 0) {
        const commissionTransaction = new Transaction({
            type: 'commission',
            amount: commission,
            currency: config.currency,
            description: `Commission from Auction Game ${game.gameId}`,
            relatedGameId: game._id.toString(),
            status: 'completed',
        });
        await commissionTransaction.save({ session });
    }
    
    await game.save({ session });
    await session.commitTransaction();

    emitToAuctionRoom('auctionFinished', {
      gameId: game.gameId,
      status: game.status,
      winner: { userId: game.winnerId, username: game.lastBidder.username, photoUrl: game.lastBidder.photoUrl },
      pot: game.currentPotCoins,
      commissionAmount: game.commissionAmount,
      amountWon: amountWonByPlayer,
      serverSeed: game.serverSeed, // Reveal server seed
      clientSeed: game.clientSeed,
      nonce: game.nonce,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error(`Error finalizing auction round and awarding winner for ${game.gameId}:`, error);
    game.status = 'error'; // Set to error to prevent further interaction until fixed/restarted
    game.log.push(`Error during winner processing: ${error.message}`);
    await game.save(); 
    emitToAuctionRoom('auctionError', { gameId: game.gameId, message: 'Error processing winner payout.' });
  } finally {
    session.endSession();
  }

  console.log(`Auction round ${game.gameId} finished. Next round in 10s.`);
  setTimeout(initializeNewAuctionRound, 10000); // Start new round after 10 seconds
}

async function initializeAuctionGame() {
  console.log(`Initializing Auction Game...`);
  const config = await gameSettingsService.getGameSettings(defaultAuctionConfig.id);
  if (!config) {
      console.error(`CRITICAL: Auction game configuration (ID: ${defaultAuctionConfig.id}) not found on startup. Auction game will not function correctly.`);
      // Set auctionState.config to a fallback or null, and handle this in other functions
      auctionState.config = defaultAuctionConfig; // Use default as a last resort, or null
      // Consider not starting the game or putting it into an error state visible to admins
  } else {
      auctionState.config = config;
  }
  
  auctionState.currentGame = await AuctionGame.findOne({ status: { $in: ['waiting', 'running'] } }).sort({ createdAt: -1 });
  
  if (auctionState.currentGame) {
    console.log(`Found ongoing auction game: ${auctionState.currentGame.gameId}, Status: ${auctionState.currentGame.status}. Using dynamic config.`);
    if (auctionState.currentGame.status === 'running' && auctionState.currentGame.lastBidder) {
      console.log('Restarting timer for ongoing auction game with dynamic config.');
      startOrResetAuctionTimer(); // Uses auctionState.config
    } else if (auctionState.currentGame.status === 'waiting') {
        emitToAuctionRoom('newAuctionRound', { 
            gameId: auctionState.currentGame.gameId,
            status: 'waiting',
            currentPotCoins: auctionState.currentGame.currentPotCoins,
            lastBidder: null,
            hashedServerSeed: auctionState.currentGame.hashedServerSeed,
            timerRemaining: null,
            initialVirtualBankCoins: auctionState.config.initialVirtualBankCoins,
            fixedBetAmountCoins: auctionState.config.fixedBetAmountCoins,
            timerDurationSeconds: auctionState.config.timerDurationSeconds,
        });
    }
  } else {
    // This will use the auctionState.config already fetched (or fallback)
    await initializeNewAuctionRound(); 
  }
  console.log("Auction Game service initialized with dynamic config.");
}

// Function to update client seed (simplified for auction)
async function updateClientSeedForAuction(newClientSeed) {
    // Ensure config is loaded before proceeding, as getCurrentGame might initialize a new round
    if (!auctionState.config) {
        const loadedConfig = await gameSettingsService.getGameSettings(defaultAuctionConfig.id);
        if (!loadedConfig) throw new Error('Auction configuration not loaded, cannot update client seed.');
        auctionState.config = loadedConfig;
    }
    const game = await getCurrentGame(); 
    if (!game) throw new Error('Auction game not available.');

    game.clientSeed = newClientSeed; // This modification should be on the game instance from DB
    game.log.push(`Client seed updated to ${newClientSeed}.`);
    await game.save();
    console.log(`Auction client seed updated to ${newClientSeed} for game ${game.gameId}.`);
    // Emit non-sensitive confirmation
    emitToAuctionRoom('clientSeedUpdate', { gameId: game.gameId, message: 'Client seed has been updated by a player.' });
    return { message: 'Client seed updated. It will be used in ongoing/next auction operations.' };
}


module.exports = {
  initializeAuctionGame,
  getCurrentGame, // For controller to get state
  placeBid,
  determineWinner, // Mostly for internal use by timer
  updateClientSeedForAuction, // If allowing client seed updates
  AUCTION_ROOM_ID, // Export for socket join
};
