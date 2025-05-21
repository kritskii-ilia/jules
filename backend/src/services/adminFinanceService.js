const Transaction = require('../models/TransactionModel');
const User = require('../models/UserModel');
// Game models might not be strictly needed here unless doing direct revenue calculation from them
// const ClassicGame = require('../models/ClassicGameModel');
// const AuctionGame = require('../models/AuctionGameModel');
// const LotteryGame = require('../models/LotteryGameModel');
const mongoose = require('mongoose');
const { logAdminAction } = require('./adminLogService'); // Import admin logger

const listTransactions = async ({ page = 1, limit = 10, type, userId, dateFrom, dateTo, status, minAmount, maxAmount }) => {
  const query = {};

  if (type) query.type = type;
  if (userId) query.userId = userId;
  if (status) query.status = status;

  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  if (minAmount !== undefined || maxAmount !== undefined) {
    query.amount = {};
    if (minAmount !== undefined) query.amount.$gte = parseFloat(minAmount);
    if (maxAmount !== undefined) query.amount.$lte = parseFloat(maxAmount);
  }

  const transactions = await Transaction.find(query)
    .populate('userId', 'username telegramId') // Populate user info
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 })
    .exec();

  const count = await Transaction.countDocuments(query);

  return {
    transactions,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page, 10),
    totalTransactions: count,
  };
};

const listProblematicDeposits = async ({ page = 1, limit = 10 }) => {
  // Example criteria: type 'deposit', status 'pending_manual_review'
  // Or, if deposits are directly created with a 'pending' status and no userId initially.
  // This depends on how `paymentService.processMockDeposit` handles unverified/unassigned deposits.
  // For now, let's assume a status 'pending_manual_review' is set by the payment service.
  const query = {
    type: 'deposit', // Assuming these are of type 'deposit'
    status: 'pending_manual_review', // Or 'pending' if that's the initial state for unassigned
    // userId: null, // Optionally, if problematic means no user is assigned
  };

  const transactions = await Transaction.find(query)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 })
    .exec();

  const count = await Transaction.countDocuments(query);
  return {
    transactions,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page, 10),
    totalTransactions: count,
  };
};

const assignUserToDeposit = async (transactionId, newUserId, adminNotes) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const transaction = await Transaction.findById(transactionId).session(session);
    if (!transaction) {
      throw new Error('Transaction not found.');
    }
    if (transaction.type !== 'deposit') {
      throw new Error('Transaction is not a deposit.');
    }
    // Ensure it's a problematic deposit and not already completed/assigned in a way that would cause issues.
    if (transaction.status !== 'pending_manual_review' && transaction.status !== 'pending') {
        throw new Error('Deposit is not in a state that allows user assignment (e.g., already completed or rejected).');
    }
    if (transaction.userId) {
        throw new Error('Deposit is already assigned to a user. This action should only be for unassigned or problematic deposits.');
    }


    const user = await User.findById(newUserId).session(session);
    if (!user) {
      throw new Error('User to assign not found.');
    }

    const amountToCredit = transaction.amount; // Amount from the deposit transaction

    // Update transaction
    transaction.userId = newUserId;
    transaction.status = 'completed'; // Mark as completed
    transaction.adminNotes = `Assigned to user ${user.username} (${newUserId}) by admin. ${adminNotes || ''}`.trim();
    await transaction.save({ session });

    // Credit user's balance
    user.balance += amountToCredit;
    await user.save({ session });

    await session.commitTransaction();

    await logAdminAction(
      'SYSTEM', // Or pass adminUserId if available from controller
      'Admin',  // Placeholder for adminUsername
      'DEPOSIT_ASSIGNED_TO_USER',
      'transaction',
      transactionId,
      { userId: newUserId, amount: amountToCredit, previousUserId: transaction.userId, adminNotes }
    );
    return transaction;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const listPendingWithdrawals = async ({ page = 1, limit = 10 }) => {
  const query = { type: 'withdrawal', status: 'pending' };
  const transactions = await Transaction.find(query)
    .populate('userId', 'username telegramId')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 })
    .exec();
  const count = await Transaction.countDocuments(query);
  return {
    transactions,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page, 10),
    totalTransactions: count,
  };
};

const approveWithdrawal = async (transactionId, adminUserId, adminNotes) => {
  const transaction = await Transaction.findById(transactionId);
  if (!transaction) throw new Error('Withdrawal transaction not found.');
  if (transaction.type !== 'withdrawal') throw new Error('Transaction is not a withdrawal.');
  if (transaction.status !== 'pending') throw new Error('Withdrawal is not pending approval.');

  transaction.status = 'approved'; // Or 'processing' if there's another step
  transaction.adminNotes = `Approved by admin ${adminUserId}. ${adminNotes || ''}`.trim();
  await transaction.save();

  await logAdminAction(
    adminUserId,
    'Admin', // Placeholder
    'WITHDRAWAL_APPROVED',
    'transaction',
    transactionId,
    { amount: transaction.amount, cryptoAddress: transaction.cryptoAddress, adminNotes }
  );
  return transaction;
};

const rejectWithdrawal = async (transactionId, adminUserId, reason) => {
  if (!reason || reason.trim() === '') {
    throw new Error('Reason for rejection is required.');
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const transaction = await Transaction.findById(transactionId).session(session);
    if (!transaction) throw new Error('Withdrawal transaction not found.');
    if (transaction.type !== 'withdrawal') throw new Error('Transaction is not a withdrawal.');
    if (transaction.status !== 'pending') throw new Error('Withdrawal is not pending rejection.');

    const user = await User.findById(transaction.userId).session(session);
    if (!user) throw new Error('User associated with withdrawal not found.');

    // Refund the amount to the user's balance
    user.balance += transaction.amount; // Assuming transaction.amount is positive for withdrawal
    await user.save({ session });

    transaction.status = 'rejected';
    transaction.adminNotes = `Rejected by admin ${adminUserId}. Reason: ${reason}`.trim();
    await transaction.save({ session });
    
    // Create a new transaction to log the refund for clarity, or ensure the original transaction's update is sufficient.
    // For this exercise, updating the original transaction's notes and status is considered sufficient.
    // A new 'refund' transaction could also be created if detailed tracking of this flow is needed.

    await session.commitTransaction();

    await logAdminAction(
      adminUserId,
      'Admin', // Placeholder
      'WITHDRAWAL_REJECTED',
      'transaction',
      transactionId,
      { amount: transaction.amount, reason, balanceRefunded: transaction.amount }
    );
    return transaction;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getSiteRevenueStats = async ({ dateFrom, dateTo }) => {
  const query = {};
  if (dateFrom || dateTo) {
    query.createdAt = {}; // Assuming commission transactions have createdAt
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  // Method 1: Summing 'commission' type transactions
  query.type = 'commission';
  const commissionTransactions = await Transaction.find(query).select('amount');
  const totalCommissionFromTransactions = commissionTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Method 2: Summing from Game Models (might be more complex if games can be deleted or archived)
  // This requires date filtering on game models' `endedAt` or `createdAt` fields.
  // For simplicity, we'll primarily use Method 1. Below is a conceptual sketch for Method 2.
  
  // let totalCommissionFromGames = 0;
  // const gameDateQuery = {};
  // if (dateFrom || dateTo) {
  //   gameDateQuery.endedAt = {}; // Assuming games have an endedAt field
  //   if (dateFrom) gameDateQuery.endedAt.$gte = new Date(dateFrom);
  //   if (dateTo) gameDateQuery.endedAt.$lte = new Date(dateTo);
  // }

  // const classicGames = await ClassicGame.find(gameDateQuery).select('commissionAmount');
  // totalCommissionFromGames += classicGames.reduce((sum, g) => sum + g.commissionAmount, 0);
  // const auctionGames = await AuctionGame.find(gameDateQuery).select('commissionAmount');
  // totalCommissionFromGames += auctionGames.reduce((sum, g) => sum + g.commissionAmount, 0);
  // const lotteryGames = await LotteryGame.find(gameDateQuery).select('commissionAmount');
  // totalCommissionFromGames += lotteryGames.reduce((sum, g) => sum + g.commissionAmount, 0);

  return {
    totalCommission: totalCommissionFromTransactions,
    // totalCommissionCalculatedFromGames: totalCommissionFromGames, // Optional: for comparison or if primary
    filters: { dateFrom, dateTo }
  };
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
