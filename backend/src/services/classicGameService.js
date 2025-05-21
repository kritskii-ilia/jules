const mongoose = require('mongoose');
const ClassicGame = require('../models/ClassicGameModel');
const User = require('../models/UserModel');
const Transaction = require('../models/TransactionModel');
// classicGameRooms is still used to get the list of room IDs to initialize
const { classicGameRooms } = require('../config/gameConfig'); 
const gameSettingsService = require('./gameSettingsService'); // Import gameSettingsService
const provablyFairService = require('./provablyFairService');
const { getIO } = require('./socketService');

const MIN_PLAYERS_TO_START_TIMER = 2;

// In-memory state for game rooms
const roomStates = {};

// Helper function to emit to a specific room
function emitToRoom(roomId, event, data) {
  const io = getIO();
  if (io) {
    io.to(roomId).emit(event, data);
    console.log(`Emitted [${event}] to room [${roomId}]:`, data ? JSON.stringify(data).substring(0,100) : '');
  } else {
    console.error('Socket.IO not initialized, cannot emit event:', event);
  }
}

// Helper to update player ticket ranges
function updatePlayerTickets(players, totalPot) {
  let currentTicket = 0;
  players.forEach(player => {
    const betPercentage = player.totalBet / totalPot;
    // Using a large number for tickets to allow for fine-grained probability
    // Max total tickets will be 1,000,000 for now.
    // This means 1 coin = (1,000,000 / totalPot) tickets
    const ticketsOwned = Math.round((player.totalBet / totalPot) * 1000000); 
    player.ticketsStart = currentTicket;
    player.ticketsEnd = currentTicket + ticketsOwned -1; // Inclusive
    currentTicket += ticketsOwned;
  });
  return players;
}

async function initializeNewRound(roomId) {
  // Fetch dynamic configuration for the room
  const config = await gameSettingsService.getGameSettings(roomId);
  if (!config) {
    // Log critical error and potentially emit to room if possible
    console.error(`CRITICAL: Configuration for room ${roomId} not found. Cannot initialize new round.`);
    emitToRoom(roomId, 'gameError', { message: `Game configuration for ${roomId} is missing. Round cannot start.` });
    return null;
  }

  // Store the fetched config in the room's state for the current round
  if (roomStates[roomId]) {
    roomStates[roomId].config = config;
  } else {
    // This case should ideally not happen if roomStates are pre-initialized correctly
    console.warn(`Room state for ${roomId} was not pre-initialized. Initializing now.`);
    roomStates[roomId] = { config, currentGame: null, timer: null, uniquePlayersWhoBet: new Set() };
  }

  const serverSeed = provablyFairService.generateServerSeed();
  const hashedServerSeed = provablyFairService.hashServerSeed(serverSeed);
  
  // Get the last round number for this room and increment
  const lastGame = await ClassicGame.findOne({ roomId }).sort({ roundNumber: -1 });
  const roundNumber = lastGame ? lastGame.roundNumber + 1 : 1;
  const nonce = roundNumber; // Using round number as nonce for simplicity

  const newGame = new ClassicGame({
    roomId,
    roundNumber,
    status: 'waiting',
    players: [],
    totalPot: 0,
    serverSeed, // Store plaintext serverSeed, will be revealed at end. Consider encryption for prod.
    hashedServerSeed,
    clientSeed: 'default_client_seed', // Will be updated by players
    nonce,
    commissionRatePercent: config.commissionRatePercent,
    log: [`Round ${roundNumber} initialized.`]
  });

  try {
    await newGame.save();
    roomStates[roomId].currentGame = newGame;
    roomStates[roomId].timer = null; 
    roomStates[roomId].uniquePlayersWhoBet = new Set(); 

    console.log(`New round ${roundNumber} initialized for room ${roomId} with dynamic config. Hashed Seed: ${hashedServerSeed}`);
    // Send relevant (non-sensitive) parts of config to client
    const clientConfig = { 
        id: config.id || roomId, // Ensure ID is present
        name: config.name, 
        minBet: config.minBet, 
        maxBetPerPlayer: config.maxBetPerPlayer, 
        timerDurationSeconds: config.timerDurationSeconds,
        currency: config.currency,
    };
    emitToRoom(roomId, 'newRound', {
      roomId,
      roundNumber,
      hashedServerSeed,
      status: 'waiting',
      totalPot: 0,
      players: [],
      timerRemaining: null, 
      config: clientConfig, 
    });
    return newGame;
  } catch (error) {
    console.error(`Error initializing new round for ${roomId}:`, error);
    if (newGame) newGame.log.push(`Error initializing: ${error.message}`);
    // Potentially update game status to 'error'
    // await newGame.save(); 
    return null;
  }
}

async function getCurrentGame(roomId) {
  if (!roomStates[roomId] || !roomStates[roomId].currentGame) {
    console.log(`No current game for room ${roomId} in memory, attempting to load or create.`);
    // Try to load an ongoing game from DB (e.g. waiting, countdown)
    const ongoingGame = await ClassicGame.findOne({ 
        roomId, 
        status: { $in: ['waiting', 'countdown'] } 
    }).sort({ createdAt: -1 });

    if (ongoingGame) {
        // Fetch config for this loaded game's room before proceeding
        const currentConfig = await gameSettingsService.getGameSettings(roomId);
        if (!currentConfig) {
            console.error(`CRITICAL: Configuration for room ${roomId} not found when loading ongoing game. Cannot proceed.`);
            // Handle error, maybe set game to error state
            ongoingGame.status = 'error';
            ongoingGame.log.push('Critical: Missing configuration during load.');
            await ongoingGame.save().catch(e => console.error("Failed to save error state:", e));
            return null; // Or re-initialize after error
        }
        roomStates[roomId] = { 
            ...roomStates[roomId], 
            config: currentConfig, // Store fetched config
            currentGame: ongoingGame, 
            timer: null, 
            uniquePlayersWhoBet: new Set(ongoingGame.players.map(p => p.userId.toString()))
        };
        console.log(`Loaded ongoing game round ${ongoingGame.roundNumber} for room ${roomId} from DB with dynamic config.`);
        
        if (ongoingGame.status === 'countdown' && roomStates[roomId].uniquePlayersWhoBet.size >= MIN_PLAYERS_TO_START_TIMER) {
            console.warn(`Game ${ongoingGame.roundNumber} for room ${roomId} was in countdown. Restarting timer with current config.`);
            startGameTimer(roomId, ongoingGame); // Uses config from roomStates[roomId].config
        }
    } else {
        console.log(`No ongoing game in DB for ${roomId}, initializing a new one (will fetch config).`);
        return await initializeNewRound(roomId); // This will fetch config
    }
  } else if (roomStates[roomId].currentGame.status === 'finished' || roomStates[roomId].currentGame.status === 'error') {
    return await initializeNewRound(roomId);
  }
  return roomStates[roomId].currentGame;
}


function startGameTimer(roomId, game) { // Config is now expected to be in roomStates[roomId].config
    const config = roomStates[roomId]?.config;
    if (!config) {
        console.error(`CRITICAL: Missing configuration for room ${roomId} when starting timer.`);
        game.status = 'error';
        game.log.push('Critical: Missing configuration for timer start.');
        game.save().catch(e => console.error("Failed to save error state:", e));
        emitToRoom(roomId, 'gameError', { message: `Game configuration error for ${roomId}. Timer cannot start.` });
        return;
    }

    if (roomStates[roomId].timer) { 
        clearTimeout(roomStates[roomId].timer);
    }
    game.status = 'countdown';
    game.log.push(`Countdown started. Duration: ${config.timerDurationSeconds}s`);
    
    let timerRemaining = config.timerDurationSeconds;
    emitToRoom(roomId, 'timerUpdate', { roomId, timerRemaining, status: 'countdown' });

    const timerTick = () => {
        timerRemaining--;
        if (timerRemaining > 0) {
            emitToRoom(roomId, 'timerUpdate', { roomId, timerRemaining, status: 'countdown' });
            roomStates[roomId].timer = setTimeout(timerTick, 1000);
        } else {
            emitToRoom(roomId, 'timerUpdate', { roomId, timerRemaining: 0, status: 'countdownEnd' });
            determineWinner(roomId); // Uses config from roomStates[roomId].config implicitly
        }
    };
    roomStates[roomId].timer = setTimeout(timerTick, 1000);
    game.save().catch(err => console.error("Error saving game state on timer start:", err));
}

async function addBet(roomId, userId, username, photoUrl, betAmount) {
  const config = roomStates[roomId]?.config; // Use the config stored for the current round
  if (!config) {
    console.error(`CRITICAL: Room configuration for ${roomId} not found during bet placement.`);
    throw new Error('Game configuration is missing. Cannot place bet.');
  }

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');
  if (user.balance < betAmount) throw new Error('Insufficient balance.');
  if (user.isGamingDisabledUntil && new Date() < new Date(user.isGamingDisabledUntil)) {
    throw new Error(`Gaming is disabled for this user until ${new Date(user.isGamingDisabledUntil).toLocaleString()}`);
  }

  const game = await getCurrentGame(roomId);
  if (!game || game.status === 'spinning' || game.status === 'finished' || game.status === 'error') {
    throw new Error('Betting is currently closed for this round.');
  }
  if (betAmount < config.minBet) throw new Error(`Minimum bet is ${config.minBet} ${config.currency}.`);
  
  const playerIndex = game.players.findIndex(p => p.userId.equals(userId));
  let playerEntry;

  if (playerIndex > -1) {
    playerEntry = game.players[playerIndex];
    if (playerEntry.totalBet + betAmount > config.maxBetPerPlayer) {
      throw new Error(`Maximum bet per player is ${config.maxBetPerPlayer} ${config.currency}.`);
    }
    playerEntry.totalBet += betAmount;
  } else {
    if (betAmount > config.maxBetPerPlayer) {
      throw new Error(`Maximum bet per player is ${config.maxBetPerPlayer} ${config.currency}.`);
    }
    playerEntry = { userId, username, photoUrl, totalBet: betAmount, ticketsStart: 0, ticketsEnd: 0 };
    game.players.push(playerEntry);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    user.balance -= betAmount;
    await user.save({ session });

    const betTransaction = new Transaction({
      userId,
      type: 'bet',
      amount: betAmount,
      currency: config.currency,
      description: `Bet in Classic Game ${roomId}, Round ${game.roundNumber}`,
      relatedGameId: game._id.toString(),
      status: 'completed',
    });
    await betTransaction.save({ session });

    game.totalPot += betAmount;
    game.players = updatePlayerTickets(game.players, game.totalPot); // Recalculate tickets for all
    game.log.push(`${username} bet ${betAmount}. Total pot: ${game.totalPot}.`);
    
    // Manage unique players and timer
    const wasNewPlayerThisBet = !roomStates[roomId].uniquePlayersWhoBet.has(userId.toString());
    if (wasNewPlayerThisBet) {
        roomStates[roomId].uniquePlayersWhoBet.add(userId.toString());
    }

    if (game.status === 'waiting' && roomStates[roomId].uniquePlayersWhoBet.size >= MIN_PLAYERS_TO_START_TIMER) {
        startGameTimer(roomId, game); // Config will be sourced from roomStates[roomId].config
    } else if (game.status === 'countdown' && wasNewPlayerThisBet) {
        console.log(`New player ${username} joined during countdown for room ${roomId}. Timer extended/reset.`);
        startGameTimer(roomId, game); // Config will be sourced from roomStates[roomId].config
    }

    await game.save({ session });
    await session.commitTransaction();

    emitToRoom(roomId, 'newBet', { roomId, player: playerEntry, totalPot: game.totalPot });
    emitToRoom(roomId, 'potUpdate', { roomId, totalPot: game.totalPot, players: game.players });
    if(game.status === 'countdown') { // if timer started or was already running
        const timerInstance = roomStates[roomId].timer;
        // Timer is restarted with full duration for now.
         emitToRoom(roomId, 'timerUpdate', { roomId, timerRemaining: config.timerDurationSeconds, status: 'countdown' });
    }


    return { game, player: playerEntry };

  } catch (error) {
    await session.abortTransaction();
    console.error(`Error processing bet for ${username} in ${roomId}:`, error);
    throw error; 
  } finally {
    session.endSession();
  }
}

async function determineWinner(roomId) {
  const game = roomStates[roomId]?.currentGame;
  const config = roomStates[roomId]?.config; // Use the config stored for the current round

  if (!config) {
    console.error(`CRITICAL: Room configuration for ${roomId} not found during winner determination.`);
    if(game) {
        game.status = 'error';
        game.log.push('Critical: Missing configuration for winner determination.');
        await game.save().catch(e => console.error("Failed to save error state:", e));
    }
    emitToRoom(roomId, 'gameError', { message: `Game configuration error for ${roomId}. Cannot determine winner.` });
    return;
  }

  if (!game || game.status !== 'countdown') { 
    console.error(`Cannot determine winner: Game not in correct state for ${roomId}. Current status: ${game?.status}`);
    // Potentially try to re-fetch game or reset
    return;
  }

  game.status = 'spinning';
  game.log.push('Spinning to determine winner...');
  await game.save();
  emitToRoom(roomId, 'roundSpinning', { roomId, roundNumber: game.roundNumber });

  // Short delay to simulate spinning
  await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds spin

  const totalTickets = game.players.reduce((sum, p) => sum + (p.ticketsEnd - p.ticketsStart + 1), 0);
  if (totalTickets <= 0) {
      game.status = 'error';
      game.log.push('Error: No tickets in pot. Cannot determine winner.');
      await game.save();
      emitToRoom(roomId, 'roundError', { roomId, message: 'No bets placed, cannot determine winner.' });
      setTimeout(() => initializeNewRound(roomId), 5000); // Restart after delay
      return;
  }
  
  // Use roundNumber as nonce if game.nonce wasn't specifically set per round start (it is in initializeNewRound)
  const winningTicketNumber = provablyFairService.generateGameResult(
    game.serverSeed,
    game.clientSeed, // TODO: Allow per-player client seeds and aggregate them or use a global one
    game.nonce,
    totalTickets // Max outcome is totalTickets (0 to totalTickets-1)
  );

  const winner = game.players.find(p => winningTicketNumber >= p.ticketsStart && winningTicketNumber <= p.ticketsEnd);

  if (!winner) {
    game.status = 'error';
    game.log.push(`Error: No winner found for ticket ${winningTicketNumber}. This should not happen.`);
    await game.save();
    emitToRoom(roomId, 'roundError', { roomId, message: 'Critical error: Could not determine winner.' });
    setTimeout(() => initializeNewRound(roomId), 5000);
    return;
  }

  const commission = Math.floor((game.totalPot * config.commissionRatePercent) / 100);
  const amountWonByPlayer = game.totalPot - commission;
  game.winnerId = winner.userId;
  game.winningTicket = winningTicketNumber;
  game.commissionAmount = commission;
  game.status = 'finished';
  game.endedAt = new Date();
  game.log.push(`Winner: ${winner.username} with ticket ${winningTicketNumber}. Won: ${amountWonByPlayer} after ${commission} commission.`);
  
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const winnerUser = await User.findById(winner.userId).session(session);
    if (!winnerUser) throw new Error('Winner user not found in DB.');
    
    winnerUser.balance += amountWonByPlayer;
    await winnerUser.save({ session });

    const winTransaction = new Transaction({
      userId: winner.userId,
      type: 'win',
      amount: amountWonByPlayer,
      currency: config.currency,
      description: `Win in Classic Game ${roomId}, Round ${game.roundNumber}. Ticket: ${winningTicketNumber}`,
      relatedGameId: game._id.toString(),
      status: 'completed',
    });
    await winTransaction.save({ session });

    if (commission > 0) {
        const commissionTransaction = new Transaction({
            // userId: null, // Or a specific commission account ID
            type: 'commission',
            amount: commission,
            currency: config.currency,
            description: `Commission from Classic Game ${roomId}, Round ${game.roundNumber}`,
            relatedGameId: game._id.toString(),
            status: 'completed',
        });
        await commissionTransaction.save({ session });
    }
    
    await game.save({ session });
    await session.commitTransaction();

    emitToRoom(roomId, 'roundFinished', {
      roomId,
      roundNumber: game.roundNumber,
      winner: { userId: winner.userId, username: winner.username, photoUrl: winner.photoUrl, totalBet: winner.totalBet },
      winningTicket: winningTicketNumber,
      totalPot: game.totalPot,
      commissionAmount: game.commissionAmount,
      serverSeed: game.serverSeed, // Reveal server seed
      clientSeed: game.clientSeed, // Reveal client seed used
      nonce: game.nonce,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error(`Error finalizing round and awarding winner for ${roomId}, round ${game.roundNumber}:`, error);
    game.status = 'error';
    game.log.push(`Error during winner processing: ${error.message}`);
    await game.save(); // Save error state
    emitToRoom(roomId, 'roundError', { roomId, message: 'Error processing winner payout.' });
  } finally {
    session.endSession();
  }

  // Schedule next round
  console.log(`Round ${game.roundNumber} for room ${roomId} finished. Next round in 10s.`);
  setTimeout(() => initializeNewRound(roomId), 10000); // Start new round after 10 seconds
}

async function updateClientSeedForPlayer(roomId, userId, newClientSeed) {
    // For MVP, we'll assume a global client seed for the room, updated by any player.
    // A more complex system would store client seeds per player for the next round
    // or combine them.
    const game = await getCurrentGame(roomId);
    if (!game) {
        throw new Error('No active game found for this room.');
    }

    // Only allow updating client seed for 'waiting' or 'countdown' stages for next round.
    // Or, if current game is 'finished', update for the *next* game.
    if (game.status === 'spinning' || game.status === 'finished' && !roomStates[roomId].nextClientSeed) {
         // If game is active, store it for the next round.
        roomStates[roomId].nextClientSeed = newClientSeed;
        console.log(`Client seed for room ${roomId} will be updated to ${newClientSeed} for the next round by ${userId}.`);
        // User specific client seed update would be more complex:
        // if (!roomStates[roomId].playerClientSeeds) roomStates[roomId].playerClientSeeds = {};
        // roomStates[roomId].playerClientSeeds[userId.toString()] = newClientSeed;
    } else {
        // If game is waiting or in countdown, update current game's client seed
        // (This means all players in current round use the latest seed set by anyone)
        game.clientSeed = newClientSeed;
        game.log.push(`Client seed updated to ${newClientSeed} by user ${userId}.`);
        await game.save();
        console.log(`Client seed for room ${roomId}, round ${game.roundNumber} updated to ${newClientSeed} by ${userId}.`);
        emitToRoom(roomId, 'clientSeedUpdate', { roomId, newClientSeedInfo: `Seed updated by a player.` }); // Don't reveal seed itself, just that it changed
    }
    return { message: 'Client seed updated successfully. It will be used for the current or next game round.', newClientSeed };
}


function initializeAllClassicGames() {
  Object.keys(classicGameRooms).forEach(roomId => {
    console.log(`Initializing game room: ${roomId}`);
    // Initialize roomState with a placeholder for config; it will be fetched by getCurrentGame->initializeNewRound
    roomStates[roomId] = {
      config: null, // Will be populated by initializeNewRound
      currentGame: null,
      timer: null,
      uniquePlayersWhoBet: new Set(),
      // nextClientSeed: null, 
      // playerClientSeeds: {} 
    };
    // getCurrentGame will fetch config when it calls initializeNewRound if no game is active
    // or when loading an ongoing game.
    getCurrentGame(roomId).then(gameInstance => {
      if (gameInstance) {
        console.log(`Room ${roomId} initialized with round ${gameInstance.roundNumber}. Status: ${gameInstance.status}. Config: ${roomStates[roomId]?.config?.name}`);
      } else {
        // Error messages (e.g. config not found) are logged within initializeNewRound or getCurrentGame
         console.error(`Failed to initialize game for room ${roomId} (likely due to missing configuration).`);
      }
    }).catch(error => {
        console.error(`Error during initial getCurrentGame for room ${roomId}:`, error);
    });
  });
}

module.exports = {
  initializeAllClassicGames,
  getCurrentGame, // Primarily for controller to get state
  addBet,
  determineWinner, // Mostly for internal use by timer
  updateClientSeedForPlayer,
  // For testing or admin purposes, might expose:
  // initializeNewRound,
  // startGameTimer,
};
