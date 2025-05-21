const auctionGameService = require('../services/auctionGameService');
const { auctionGameConfig } = require('../config/gameConfig');

const placeBid = async (req, res) => {
  try {
    const userId = req.user.id; // From 'protect' middleware
    const username = req.user.username;
    const photoUrl = req.user.photoUrl;

    const result = await auctionGameService.placeBid(userId, username, photoUrl);
    res.status(201).json({
      message: 'Bid placed successfully.',
      gameId: result.game.gameId,
      bid: result.bid,
      currentPotCoins: result.game.currentPotCoins,
      lastBidder: result.game.lastBidder,
    });
  } catch (error) {
    console.error(`Error in placeBid (auction) controller:`, error);
    res.status(error.message.includes('Insufficient balance') || error.message.includes('You are already the last bidder') || error.message.includes('Auction is not active') || error.message.includes('Gaming is disabled') ? 400 : 500)
       .json({ message: error.message || 'Server error placing bid.' });
  }
};

const getGameState = async (req, res) => {
  try {
    const game = await auctionGameService.getCurrentGame(); // Ensures a game instance is available
    const config = auctionGameConfig;

    if (!game) {
      return res.status(404).json({ message: 'Auction game not available or failed to initialize.' });
    }
    
    // Timer remaining logic: Best handled by WebSockets for real-time accuracy.
    // This HTTP endpoint can provide the configured duration.
    // If auctionState.timerEndTime is maintained, calculate: Math.max(0, Math.round((auctionState.timerEndTime - Date.now()) / 1000))
    let timerRemaining = null; 
    if (game.status === 'running' && auctionGameService.auctionState && auctionGameService.auctionState.timer) {
        // Client should rely on socket 'timerUpdate' for precise time.
        // This indicates timer is active.
        timerRemaining = config.timerDurationSeconds; // Placeholder, shows max duration
    }


    res.json({
      gameId: game.gameId,
      status: game.status,
      currentPotCoins: game.currentPotCoins,
      lastBidder: game.lastBidder,
      betsCount: game.bets.length, // Count of bets for UI if needed
      hashedServerSeed: game.hashedServerSeed, // For transparency
      clientSeedInfo: game.clientSeed === 'default_client_seed_auction' ? 'Using default client seed' : 'Custom client seed set',
      // timerRemaining, // See comment above
      // Config details for the client:
      config: {
        initialVirtualBankCoins: config.initialVirtualBankCoins,
        fixedBetAmountCoins: config.fixedBetAmountCoins,
        timerDurationSeconds: config.timerDurationSeconds,
        commissionRatePercent: config.commissionRatePercent,
      },
      // lastBetTimestamp: game.bets.length > 0 ? game.bets[game.bets.length - 1].timestamp : null,
    });
  } catch (error) {
    console.error(`Error in getGameState (auction) controller:`, error);
    res.status(500).json({ message: error.message || 'Server error fetching auction game state.' });
  }
};

// Optional: Update client seed for the auction game
const updateClientSeed = async (req, res) => {
    try {
        const { clientSeed } = req.body;
        // const userId = req.user.id; // If needed for logging who changed it

        if (!clientSeed) {
            return res.status(400).json({ message: 'Client seed is required.' });
        }
        if (typeof clientSeed !== 'string' || clientSeed.length < 1 || clientSeed.length > 64) {
            return res.status(400).json({ message: 'Client seed must be a string between 1 and 64 characters.' });
        }

        const result = await auctionGameService.updateClientSeedForAuction(clientSeed);
        res.json({ message: result.message });
    } catch (error) {
        console.error(`Error in updateClientSeed (auction) controller:`, error);
        res.status(500).json({ message: error.message || 'Server error updating client seed.' });
    }
};


module.exports = {
  placeBid,
  getGameState,
  updateClientSeed, // If you decide to implement this route
};
