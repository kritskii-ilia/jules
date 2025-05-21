const mongoose = require('mongoose');

const lotteryBetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  photoUrl: { type: String },
  fieldNumber: { type: Number, required: true, min: 1 }, // Field numbers 1 to N
  amount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const lotteryWinnerSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true }, // Denormalized for easy display
    photoUrl: { type: String },
    totalBetOnWinningField: { type: Number, required: true },
    payout: { type: Number, required: true },
}, { _id: false });

const lotteryGameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true, default: () => `lottery-${new Date().getTime()}-${Math.random().toString(36).substr(2, 5)}` },
  status: {
    type: String,
    enum: ['running', 'drawing_winner', 'finished', 'error'], // 'running' is the active betting phase
    default: 'running',
    required: true,
  },
  bets: [lotteryBetSchema],
  totalPotCoins: { type: Number, default: 0, required: true },
  winningField: { type: Number, default: null }, // 1 to N
  winners: [lotteryWinnerSchema],
  
  // Provably Fair fields
  serverSeed: { type: String, required: true },
  hashedServerSeed: { type: String, required: true },
  clientSeed: { type: String, default: 'default_client_seed_lottery' },
  nonce: { type: Number, required: true, default: 1 },

  commissionRatePercent: { type: Number, required: true },
  commissionAmount: { type: Number, default: 0 },
  
  startedAt: { type: Date, default: Date.now },
  endsAt: { type: Date, required: true }, // Calculated based on roundDurationHours
  log: [String],

}, { timestamps: true }); // Adds createdAt, updatedAt

// Index for finding active lotteries
lotteryGameSchema.index({ status: 1, endsAt: 1 });

module.exports = mongoose.model('LotteryGame', lotteryGameSchema);
