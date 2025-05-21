const lotteryGameService = require('../services/lotteryGameService');
const { lotteryGameConfig } = require('../config/gameConfig');

const placeBet = async (req, res) => {
  try {
    const userId = req.user.id; // From 'protect' middleware
    const username = req.user.username;
    const photoUrl = req.user.photoUrl;
    const { fieldNumber, amount } = req.body;

    if (fieldNumber === undefined || amount === undefined) {
      return res.status(400).json({ message: 'Field number and amount are required.' });
    }
    if (typeof fieldNumber !== 'number' || typeof amount !== 'number') {
        return res.status(400).json({ message: 'Field number and amount must be numbers.'});
    }

    const result = await lotteryGameService.placeBet(userId, username, photoUrl, fieldNumber, amount);
    res.status(201).json({
      message: 'Bet placed successfully in lottery.',
      gameId: result.game.gameId,
      bet: result.bet,
      totalPotCoins: result.game.totalPotCoins,
    });
  } catch (error) {
    console.error(`Error in placeBet (lottery) controller:`, error);
    res.status(error.message.includes('Insufficient balance') || error.message.includes('Invalid field number') || error.message.includes('Minimum bet') || error.message.includes('Lottery is not active') || error.message.includes('Gaming is disabled') || error.message.includes('Betting for this lottery round has closed') ? 400 : 500)
       .json({ message: error.message || 'Server error placing lottery bet.' });
  }
};

const getGameState = async (req, res) => {
  try {
    const game = await lotteryGameService.getCurrentLotteryGame();
    const config = lotteryGameConfig;

    if (!game) {
      return res.status(404).json({ message: 'Lottery game not available or failed to initialize.' });
    }
    
    let timeRemainingMs = 0;
    if (game.status === 'running' && game.endsAt) {
        timeRemainingMs = Math.max(0, new Date(game.endsAt).getTime() - Date.now());
    }

    res.json({
      gameId: game.gameId,
      status: game.status,
      totalPotCoins: game.totalPotCoins,
      betsPreview: game.bets.slice(-10).map(b => ({ // Send last 10 bets as a preview
          username: b.username, 
          photoUrl: b.photoUrl, 
          fieldNumber: b.fieldNumber, 
          amount: b.amount 
      })), 
      hashedServerSeed: game.hashedServerSeed,
      clientSeedInfo: game.clientSeed === 'default_client_seed_lottery' ? 'Using default client seed' : 'Custom client seed set',
      endsAt: game.endsAt,
      timeRemainingSeconds: Math.floor(timeRemainingMs / 1000),
      // For 'finished' games:
      winningField: game.status === 'finished' ? game.winningField : null,
      winners: game.status === 'finished' ? game.winners.map(w => ({username: w.username, payout: w.payout})) : [], // Simplified winner info
      // Config details for the client:
      config: {
        numberOfFields: config.numberOfFields,
        minBetPerFieldCoins: config.minBetPerFieldCoins,
        roundDurationHours: config.roundDurationHours,
        commissionRatePercent: config.commissionRatePercent,
      },
    });
  } catch (error) {
    console.error(`Error in getGameState (lottery) controller:`, error);
    res.status(500).json({ message: error.message || 'Server error fetching lottery game state.' });
  }
};

const updateClientSeed = async (req, res) => {
    try {
        const { clientSeed } = req.body;
        if (!clientSeed) {
            return res.status(400).json({ message: 'Client seed is required.' });
        }
        if (typeof clientSeed !== 'string' || clientSeed.length < 1 || clientSeed.length > 64) {
            return res.status(400).json({ message: 'Client seed must be a string between 1 and 64 characters.' });
        }
        const result = await lotteryGameService.updateClientSeedForLottery(clientSeed);
        res.json({ message: result.message });
    } catch (error) {
        console.error(`Error in updateClientSeed (lottery) controller:`, error);
        res.status(500).json({ message: error.message || 'Server error updating client seed.' });
    }
};

module.exports = {
  placeBet,
  getGameState,
  updateClientSeed,
};
