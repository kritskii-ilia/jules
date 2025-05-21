const User = require('../models/UserModel');
const Transaction = require('../models/TransactionModel');
const paymentConfig = require('../config/paymentConfig');
const mongoose = require('mongoose');

const processMockDeposit = async (userId, mockTonAmount, mockBlockchainTxId, memo) => {
  if (!userId) { // This check is important if memo is used to find user
    console.error("Deposit failed: User ID (memo) is missing or invalid.");
    // In a real system, you'd flag this for admin review.
    // For now, we'll just prevent the transaction.
    throw new Error('User ID (memo) is missing or invalid.');
  }

  const user = await User.findById(userId);
  if (!user) {
    console.error(`Deposit failed: User not found for ID (memo): ${userId}`);
    throw new Error('User not found.');
  }

  const coinsAmount = mockTonAmount * paymentConfig.tonToCoinsRate;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const depositTransaction = new Transaction({
      userId,
      type: 'deposit',
      amount: coinsAmount,
      currency: 'coins',
      description: `Deposit of ${mockTonAmount} TON (mock). TxID: ${mockBlockchainTxId}`,
      blockchainTransactionId: mockBlockchainTxId, // Store the mock blockchain tx id
      memo: memo, // Store the memo used for deposit
      status: 'completed', // Simulating immediate completion
    });
    await depositTransaction.save({ session });

    user.balance += coinsAmount;
    await user.save({ session });

    await session.commitTransaction();
    return { transaction: depositTransaction, userBalance: user.balance };
  } catch (error) {
    await session.abortTransaction();
    console.error("Error processing mock deposit:", error);
    throw error;
  } finally {
    session.endSession();
  }
};

const requestWithdrawal = async (userId, coinsAmount, tonWalletAddress) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  if (user.balance < coinsAmount) {
    throw new Error('Insufficient balance.');
  }

  if (coinsAmount < paymentConfig.minWithdrawalAmountCoins) {
    throw new Error(`Minimum withdrawal amount is ${paymentConfig.minWithdrawalAmountCoins} coins.`);
  }
  
  // For simplicity, direct deduction. In a real system, you might have a more complex fee structure.
  const finalAmountToDeduct = coinsAmount; // If fees are part of the amount, or handle separately

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const withdrawalTransaction = new Transaction({
      userId,
      type: 'withdrawal',
      amount: coinsAmount, // The amount requested by user
      currency: 'coins',
      description: `Withdrawal request to ${tonWalletAddress}. Amount: ${coinsAmount} coins.`,
      cryptoAddress: tonWalletAddress,
      status: 'pending', // Pending until processed by admin/automated system
    });
    await withdrawalTransaction.save({ session });

    user.balance -= finalAmountToDeduct;
    await user.save({ session });

    await session.commitTransaction();
    // In a real system, this would trigger a notification to an admin or an automated system
    // to process the actual crypto transfer.
    return { transaction: withdrawalTransaction, userBalance: user.balance };
  } catch (error) {
    await session.abortTransaction();
    console.error("Error processing withdrawal request:", error);
    throw error;
  } finally {
    session.endSession();
  }
};

module.exports = {
  processMockDeposit,
  requestWithdrawal,
};
