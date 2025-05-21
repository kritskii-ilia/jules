const User = require('../models/UserModel');
const Transaction = require('../models/TransactionModel');

const getUserProfile = async (userId) => {
  const user = await User.findById(userId).select('telegramId username photoUrl balance isGamingDisabledUntil');
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};

const getUserTransactionHistory = async (userId) => {
  return await Transaction.find({ userId }).sort({ createdAt: -1 });
};

const disableGamingForUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  const now = new Date();
  user.isGamingDisabledUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
  await user.save();
  return user;
};

module.exports = {
  getUserProfile,
  getUserTransactionHistory,
  disableGamingForUser,
};
