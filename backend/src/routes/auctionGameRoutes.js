const express = require('express');
const router = express.Router();
const auctionGameController = require('../controllers/auctionGameController');
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/games/auction/bid
// @desc    Place a bid in the auction game
// @access  Private
router.post('/bid', protect, auctionGameController.placeBid);

// @route   GET /api/games/auction/state
// @desc    Get the current state of the auction game
// @access  Private (or public, depending on requirements)
router.get('/state', protect, auctionGameController.getGameState);

// @route   POST /api/games/auction/client-seed
// @desc    Update client seed for the auction game (optional)
// @access  Private
router.post('/client-seed', protect, auctionGameController.updateClientSeed);


module.exports = router;
