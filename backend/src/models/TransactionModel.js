const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'bet', 'win', 'commission', 'referral_bonus'], // Added referral_bonus
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'coins', // Default currency
    required: true,
  },
  description: {
    type: String,
  },
  // Fields for crypto transactions
  cryptoAddress: { // For withdrawals, the destination address
    type: String,
  },
  blockchainTransactionId: { // For both deposit (external) and withdrawal (our tx)
    type: String,
    index: true, // Good for searching/ensuring uniqueness if needed for deposits
    sparse: true, // As not all transactions are crypto
  },
  memo: { // For deposits, to identify the user
    type: String,
  },
  relatedGameId: { // Could be a String or ObjectId depending on how games are identified
    type: String, // Or mongoose.Schema.Types.ObjectId if you have a Game model
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'pending_manual_review', 'approved', 'rejected'], // Added more statuses
    default: 'completed',
    required: true,
  },
  adminNotes: { // For admin comments, e.g., reason for rejection
    type: String,
  }
}, { timestamps: true }); // Adds createdAt and updatedAt automatically

module.exports = mongoose.model('Transaction', transactionSchema);
