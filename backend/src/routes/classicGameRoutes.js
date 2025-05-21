const express = require('express');
const router = express.Router();
const classicGameController = require('../controllers/classicGameController');
const { protect } = require('../middleware/authMiddleware'); // Assuming you have this

// @route   POST /api/games/classic/:roomId/bet
// @desc    Place a bet in a classic game room
// @access  Private
router.post('/:roomId/bet', protect, classicGameController.placeBet);

// @route   GET /api/games/classic/:roomId/state
// @desc    Get the current state of a classic game room
// @access  Private (or public, depending on requirements)
router.get('/:roomId/state', protect, classicGameController.getRoomState);

// @route   POST /api/games/classic/:roomId/client-seed
// @desc    Update client seed for the game room
// @access  Private
router.post('/:roomId/client-seed', protect, classicGameController.updateClientSeed);

module.exports = router;
