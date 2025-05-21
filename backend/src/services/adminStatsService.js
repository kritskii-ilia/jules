const User = require('../models/UserModel');
const Transaction = require('../models/TransactionModel');
const ClassicGame = require('../models/ClassicGameModel');
const AuctionGame = require('../models/AuctionGameModel');
const LotteryGame = require('../models/LotteryGameModel');
const adminFinanceService = require('./adminFinanceService'); // To reuse getSiteRevenueStats

const getOverviewStats = async ({ dateFrom, dateTo } = {}) => {
  const stats = {};

  // User Stats
  stats.totalRegisteredUsers = await User.countDocuments();
  
  // Active Users (Simplified: users with a transaction in the period, or all users if no period)
  // A more robust 'active user' would track lastLoginAt or specific activity events.
  const activeUserQuery = {};
  if (dateFrom || dateTo) {
    activeUserQuery.createdAt = {}; // Using transaction creation time as proxy for activity
    if (dateFrom) activeUserQuery.createdAt.$gte = new Date(dateFrom);
    if (dateTo) activeUserQuery.createdAt.$lte = new Date(dateTo);
    const usersWithRecentTransactions = await Transaction.distinct('userId', activeUserQuery);
    stats.activeUsersInPeriod = usersWithRecentTransactions.length;
  } else {
    // If no date range, perhaps count users with any transaction ever, or just skip this metric.
    // For simplicity, let's provide total users if no range, or label it clearly.
    stats.activeUsersLifetime = await Transaction.distinct('userId'); // Users who ever made a transaction
  }


  // Game Stats
  const gameStatusQuery = { status: 'finished' };
  const gameDateQuery = { ...gameStatusQuery }; // Base query for games
  if (dateFrom || dateTo) {
    gameDateQuery.endedAt = {}; // Assuming 'endedAt' marks when a game is finished and relevant for stats
    if (dateFrom) gameDateQuery.endedAt.$gte = new Date(dateFrom);
    if (dateTo) gameDateQuery.endedAt.$lte = new Date(dateTo);
  }

  const classicGamesPlayed = await ClassicGame.countDocuments(gameDateQuery);
  const auctionGamesPlayed = await AuctionGame.countDocuments(gameDateQuery);
  const lotteryGamesPlayed = await LotteryGame.countDocuments(gameDateQuery);
  stats.totalGamesPlayed = classicGamesPlayed + auctionGamesPlayed + lotteryGamesPlayed;
  stats.gamesPlayedByType = {
    classic: classicGamesPlayed,
    auction: auctionGamesPlayed,
    lottery: lotteryGamesPlayed,
  };
  

  // Financial Stats
  const financialQuery = { status: 'completed' }; // Default for deposits
  const financialDateQuery = { ...financialQuery };
  if (dateFrom || dateTo) {
    financialDateQuery.createdAt = {};
    if (dateFrom) financialDateQuery.createdAt.$gte = new Date(dateFrom);
    if (dateTo) financialDateQuery.createdAt.$lte = new Date(dateTo);
  }

  const depositResult = await Transaction.aggregate([
    { $match: { ...financialDateQuery, type: 'deposit' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  stats.totalDepositAmount = depositResult.length > 0 ? depositResult[0].total : 0;

  // For withdrawals, status might be 'approved' or 'completed' depending on flow
  const withdrawalStatus = ['approved', 'completed']; // Consider both as successful withdrawals
  const withdrawalQuery = { type: 'withdrawal', status: { $in: withdrawalStatus }};
  if (dateFrom || dateTo) {
    withdrawalQuery.updatedAt = {}; // Use updatedAt as it reflects when status changed to approved/completed
    if (dateFrom) withdrawalQuery.updatedAt.$gte = new Date(dateFrom);
    if (dateTo) withdrawalQuery.updatedAt.$lte = new Date(dateTo);
  }
  const withdrawalResult = await Transaction.aggregate([
    { $match: withdrawalQuery },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  stats.totalWithdrawalAmount = withdrawalResult.length > 0 ? withdrawalResult[0].total : 0;

  // Site Revenue (using existing service)
  const revenueStats = await adminFinanceService.getSiteRevenueStats({ dateFrom, dateTo });
  stats.siteRevenue = revenueStats.totalCommission;

  stats.filtersApplied = { dateFrom, dateTo };

  return stats;
};

module.exports = {
  getOverviewStats,
};
