const classicGameService = require('../services/classicGameService');
const { getRoomConfig } = require('../config/gameConfig');

// Place a bet in a specific classic game room
const placeBet = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { amount } = req.body;
    const userId = req.user.id; // From 'protect' middleware
    const username = req.user.username; // Assuming these are on req.user
    const photoUrl = req.user.photoUrl;

    if (!roomId || !amount) {
      return res.status(400).json({ message: 'Room ID and bet amount are required.' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: 'Invalid bet amount.' });
    }

    const result = await classicGameService.addBet(roomId, userId, username, photoUrl, amount);
    res.status(201).json({ 
        message: 'Bet placed successfully.', 
        gameId: result.game._id, 
        player: result.player, 
        totalPot: result.game.totalPot 
    });
  } catch (error) {
    console.error(`Error in placeBet controller for room ${req.params.roomId}:`, error);
    res.status(error.message.includes('Insufficient balance') || error.message.includes('Minimum bet') || error.message.includes('Maximum bet') || error.message.includes('Betting is currently closed') || error.message.includes('Gaming is disabled') ? 400 : 500).json({ message: error.message || 'Server error placing bet.' });
  }
};

// Get the current state of a specific classic game room
const getRoomState = async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!roomId) {
      return res.status(400).json({ message: 'Room ID is required.' });
    }

    const game = await classicGameService.getCurrentGame(roomId);
    const config = getRoomConfig(roomId);

    if (!game || !config) {
      return res.status(404).json({ message: 'Game room or configuration not found.' });
    }
    
    // Determine timerRemaining accurately
    let timerRemaining = null;
    const roomState = classicGameService.roomStates ? classicGameService.roomStates[roomId] : null; // Direct access for internal state if needed
    
    if (game.status === 'countdown' && roomState && roomState.timer) {
        // This is tricky because setTimeout doesn't expose remaining time directly.
        // For now, we'll send the config duration when countdown *starts*.
        // A more accurate timer would require storing targetEndTime.
        // For the purpose of this controller, if game is in countdown, client should rely on socket timerUpdate.
        // Sending full duration here might be misleading if timer is partway through.
        // We can just indicate it's in countdown.
        // Or, classicGameService.roomStates[roomId].timerRemaining (if service maintained it accurately)
        // For simplicity, let's assume the client gets the accurate timer via WebSockets.
        // The initial GET might just show that a timer *is* active.
    }


    res.json({
      roomId: game.roomId,
      roundNumber: game.roundNumber,
      status: game.status,
      players: game.players,
      totalPot: game.totalPot,
      hashedServerSeed: game.hashedServerSeed,
      clientSeedInfo: game.clientSeed === 'default_client_seed' ? 'Using default client seed' : 'Custom client seed set', // Don't reveal seed
      // timerRemaining: timerRemaining, // See comment above. Best handled by WebSocket.
      // If timer is active, client should see it from socket.
      // This endpoint is more for initial load or HTTP refresh.
      timerDuration: config.timerDurationSeconds, // Max timer duration for this room
      minBet: config.minBet,
      maxBetPerPlayer: config.maxBetPerPlayer,
      commissionRatePercent: config.commissionRatePercent,
      // Potentially also send: game.log (last few entries)
    });
  } catch (error) {
    console.error(`Error in getRoomState controller for room ${req.params.roomId}:`, error);
    res.status(500).json({ message: error.message || 'Server error fetching room state.' });
  }
};

// Update client seed for the game (simplified: updates a global client seed for the room)
const updateClientSeed = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { clientSeed } = req.body;
    const userId = req.user.id; // From 'protect' middleware

    if (!roomId || !clientSeed) {
      return res.status(400).json({ message: 'Room ID and client seed are required.' });
    }
    if (typeof clientSeed !== 'string' || clientSeed.length < 1 || clientSeed.length > 64) {
        return res.status(400).json({ message: 'Client seed must be a string between 1 and 64 characters.' });
    }

    const result = await classicGameService.updateClientSeedForPlayer(roomId, userId, clientSeed);
    res.json({ message: result.message });
  } catch (error) {
    console.error(`Error in updateClientSeed controller for room ${req.params.roomId}:`, error);
    res.status(error.message.includes('No active game') ? 404 : 500).json({ message: error.message || 'Server error updating client seed.' });
  }
};

module.exports = {
  placeBet,
  getRoomState,
  updateClientSeed,
};
