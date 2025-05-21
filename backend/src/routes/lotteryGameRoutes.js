const express = require('express');
const router = express.Router();
const lotteryGameController = require('../controllers/lotteryGameController');
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/games/lottery/bet
// @desc    Place a bet in the lottery game
// @access  Private
router.post('/bet', protect, lotteryGameController.placeBet);

// @route   GET /api/games/lottery/state
// @desc    Get the current state of the lottery game
// @access  Private (or public, if some info is public)
router.get('/state', protect, lotteryGameController.getGameState);

// @route   POST /api/games/lottery/client-seed
// @desc    Update client seed for the lottery game
// @access  Private
router.post('/client-seed', protect, lotteryGameController.updateClientSeed);

module.exports = router;
