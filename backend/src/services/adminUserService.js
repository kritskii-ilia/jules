const User = require('../models/UserModel');
const Transaction = require('../models/TransactionModel');
const mongoose = require('mongoose');
const { logAdminAction } = require('./adminLogService'); // Import admin logger

const listUsers = async ({ page = 1, limit = 10, search = '', searchBy = 'username' }) => {
  const query = {};
  if (search) {
    if (searchBy === 'username') {
      query.username = { $regex: search, $options: 'i' };
    } else if (searchBy === 'telegramId') {
      query.telegramId = { $regex: search, $options: 'i' };
    }
  }

  const users = await User.find(query)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .select('-serverSeed') // Example: Exclude sensitive fields if any
    .sort({ createdAt: -1 })
    .exec();

  const count = await User.countDocuments(query);

  return {
    users,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
    totalUsers: count,
  };
};

const getUserDetails = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  const transactions = await Transaction.find({ userId }).sort({ createdAt: -1 }).limit(50); // Get recent 50 transactions
  // Game history would be fetched from game-specific models or a unified game log model
  const gameHistory = []; // Placeholder for now

  return { user, transactions, gameHistory };
};

const updateUserBanStatus = async (userId, banType, isBanned, reason, durationHours, adminUsername) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  let banExpiresAt = null;
  if (isBanned && durationHours) {
    banExpiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
  }
  
  const logEntry = `${isBanned ? 'Banned' : 'Unbanned'} by admin ${adminUsername || 'UnknownAdmin'}. Reason: ${reason || 'N/A'}. ${durationHours ? `Duration: ${durationHours}h.` : ''}`;


  if (banType === 'site') {
    user.isBannedSite = isBanned;
    user.banSiteReason = isBanned ? reason : null;
    user.banSiteExpiresAt = isBanned ? banExpiresAt : null;
    // Consider adding to a specific ban log in user model if needed
  } else if (banType === 'chat') {
    user.isBannedChat = isBanned;
    user.banChatReason = isBanned ? reason : null;
    user.banChatExpiresAt = isBanned ? banExpiresAt : null;
  } else {
    throw new Error('Invalid ban type specified.');
  }
  
  // Here you might want to add to a more structured audit log within the user or a separate collection.
  // For now, we're just updating the fields.

  await user.save();

  await logAdminAction(
    req.user?._id || adminUserId, // adminUserId is fallback if req.user is not passed directly
    adminUsername,
    isBanned ? 'USER_BANNED' : 'USER_UNBANNED',
    'user',
    userId,
    { banType, reason, durationHours: isBanned ? durationHours : undefined, oldStatus: user[banType === 'site' ? 'isBannedSite' : 'isBannedChat'] }
  );

  return user;
};

const adjustUserBalance = async (userId, amount, reason, adminUserId, adminUsername) => {
  if (isNaN(amount)) {
    throw new Error('Invalid amount for balance adjustment.');
  }
  if (!reason || reason.trim() === '') {
    throw new Error('Reason for balance adjustment is required.');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found for balance adjustment.');
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const oldBalance = user.balance;
    user.balance += amount;
    if (user.balance < 0) {
        // Depending on policy, this might be an error or allowed.
        // For now, let's assume it's allowed but could be flagged.
        console.warn(`User ${user.username} (${userId}) balance is now negative: ${user.balance}`);
    }
    await user.save({ session });

    const adjustmentTransaction = new Transaction({
      userId,
      type: 'admin_adjustment', // Specific type for admin actions
      amount: amount, // Can be positive or negative
      currency: 'coins', // Assuming 'coins' is the primary currency
      description: `Admin adjustment by ${adminUsername || 'Admin'}. Reason: ${reason}. Admin ID: ${adminUserId || 'N/A'}. Old Balance: ${oldBalance}, New Balance: ${user.balance}`,
      status: 'completed',
    });
    await adjustmentTransaction.save({ session });

    await session.commitTransaction();

    await logAdminAction(
      adminUserId,
      adminUsername,
      'USER_BALANCE_ADJUSTED',
      'user',
      userId,
      { amount, reason, oldBalance, newBalance: user.balance, transactionId: adjustmentTransaction._id }
    );

    return { user, transaction: adjustmentTransaction };
  } catch (error) {
    await session.abortTransaction();
    console.error(`Error adjusting balance for user ${userId}:`, error);
    throw error;
  } finally {
    session.endSession();
  }
};


module.exports = {
  listUsers,
  getUserDetails,
  updateUserBanStatus,
  adjustUserBalance,
};
