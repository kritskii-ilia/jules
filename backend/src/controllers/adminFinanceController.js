const adminFinanceService = require('../services/adminFinanceService');

const listTransactions = async (req, res) => {
  try {
    const { page, limit, type, userId, dateFrom, dateTo, status, minAmount, maxAmount } = req.query;
    const result = await adminFinanceService.listTransactions({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      type,
      userId,
      dateFrom,
      dateTo,
      status,
      minAmount: minAmount !== undefined ? parseFloat(minAmount) : undefined,
      maxAmount: maxAmount !== undefined ? parseFloat(maxAmount) : undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('Error listing transactions:', error);
    res.status(500).json({ message: 'Error listing transactions.' });
  }
};

const listProblematicDeposits = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await adminFinanceService.listProblematicDeposits({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });
    res.json(result);
  } catch (error) {
    console.error('Error listing problematic deposits:', error);
    res.status(500).json({ message: 'Error listing problematic deposits.' });
  }
};

const assignUserToDeposit = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { userId, adminNotes } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required to assign to the deposit.' });
    }

    const updatedTransaction = await adminFinanceService.assignUserToDeposit(transactionId, userId, adminNotes);
    res.json({ message: 'User assigned to deposit and balance credited successfully.', transaction: updatedTransaction });
  } catch (error) {
    console.error(`Error assigning user to deposit ${req.params.transactionId}:`, error);
    res.status(error.message.includes('not found') ? 404 : error.message.includes('not in a state') || error.message.includes('already assigned') ? 400 : 500)
       .json({ message: error.message || 'Server error assigning user to deposit.' });
  }
};

const listPendingWithdrawals = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await adminFinanceService.listPendingWithdrawals({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });
    res.json(result);
  } catch (error) {
    console.error('Error listing pending withdrawals:', error);
    res.status(500).json({ message: 'Error listing pending withdrawals.' });
  }
};

const approveWithdrawal = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { adminNotes } = req.body;
    const adminUserId = req.user.id; // From adminProtect middleware

    const updatedTransaction = await adminFinanceService.approveWithdrawal(transactionId, adminUserId, adminNotes);
    res.json({ message: 'Withdrawal approved successfully.', transaction: updatedTransaction });
  } catch (error) {
    console.error(`Error approving withdrawal ${req.params.transactionId}:`, error);
    res.status(error.message.includes('not found') ? 404 : error.message.includes('not pending') ? 400 : 500)
       .json({ message: error.message || 'Server error approving withdrawal.' });
  }
};

const rejectWithdrawal = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { reason } = req.body;
    const adminUserId = req.user.id;

    if (!reason) {
      return res.status(400).json({ message: 'Reason for rejection is required.' });
    }

    const updatedTransaction = await adminFinanceService.rejectWithdrawal(transactionId, adminUserId, reason);
    res.json({ message: 'Withdrawal rejected and balance refunded successfully.', transaction: updatedTransaction });
  } catch (error) {
    console.error(`Error rejecting withdrawal ${req.params.transactionId}:`, error);
    res.status(error.message.includes('not found') ? 404 : error.message.includes('not pending') || error.message.includes('Reason for rejection is required') ? 400 : 500)
       .json({ message: error.message || 'Server error rejecting withdrawal.' });
  }
};

const getSiteRevenueStats = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const stats = await adminFinanceService.getSiteRevenueStats({ dateFrom, dateTo });
    res.json(stats);
  } catch (error) {
    console.error('Error fetching site revenue stats:', error);
    res.status(500).json({ message: 'Error fetching site revenue stats.' });
  }
};

module.exports = {
  listTransactions,
  listProblematicDeposits,
  assignUserToDeposit,
  listPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  getSiteRevenueStats,
};
