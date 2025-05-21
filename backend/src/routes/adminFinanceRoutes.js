const express = require('express');
const router = express.Router();
const adminFinanceController = require('../controllers/adminFinanceController');
const { adminProtect } = require('../middleware/adminAuthMiddleware');

// All routes in this file will be protected by adminProtect

// @route   GET /api/admin/finances/transactions
// @desc    List and filter all transactions
// @access  Admin
router.get('/transactions', adminProtect, adminFinanceController.listTransactions);

// @route   GET /api/admin/finances/deposits/problematic
// @desc    List deposits needing manual review
// @access  Admin
router.get('/deposits/problematic', adminProtect, adminFinanceController.listProblematicDeposits);

// @route   POST /api/admin/finances/deposits/:transactionId/assign-user
// @desc    Assign a user to a problematic deposit and credit their account
// @access  Admin
router.post('/deposits/:transactionId/assign-user', adminProtect, adminFinanceController.assignUserToDeposit);

// @route   GET /api/admin/finances/withdrawals/pending
// @desc    List pending withdrawal requests
// @access  Admin
router.get('/withdrawals/pending', adminProtect, adminFinanceController.listPendingWithdrawals);

// @route   POST /api/admin/finances/withdrawals/:transactionId/approve
// @desc    Approve a pending withdrawal request
// @access  Admin
router.post('/withdrawals/:transactionId/approve', adminProtect, adminFinanceController.approveWithdrawal);

// @route   POST /api/admin/finances/withdrawals/:transactionId/reject
// @desc    Reject a pending withdrawal request and refund user
// @access  Admin
router.post('/withdrawals/:transactionId/reject', adminProtect, adminFinanceController.rejectWithdrawal);

// @route   GET /api/admin/finances/stats/revenue
// @desc    Get site revenue statistics (commissions)
// @access  Admin
router.get('/stats/revenue', adminProtect, adminFinanceController.getSiteRevenueStats);

module.exports = router;
