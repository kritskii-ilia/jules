const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/payments/check-deposit
// @desc    Simulate checking a TON deposit (mock)
// @access  Private
router.post('/check-deposit', protect, paymentController.checkMockDeposit);

// @route   POST /api/payments/request-withdrawal
// @desc    Request a withdrawal of game coins to a TON wallet
// @access  Private
router.post('/request-withdrawal', protect, paymentController.requestWithdrawal);

// @route   GET /api/payments/config
// @desc    Get payment configuration (e.g., static wallet address, conversion rates)
// @access  Private (or Public, depending on what's exposed)
router.get('/config', protect, paymentController.getPaymentConfig);


module.exports = router;
