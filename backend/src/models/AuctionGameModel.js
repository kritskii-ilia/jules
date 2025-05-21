const mongoose = require('mongoose');

const auctionBetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  photoUrl: { type: String },
  amount: { type: Number, required: true }, // Should be fixedBetAmountCoins from config
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const auctionGameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true, default: () => `auction-${new Date().getTime()}-${Math.random().toString(36).substr(2, 5)}` },
  status: {
    type: String,
    enum: ['waiting', 'running', 'finished', 'error'],
    default: 'waiting',
    required: true,
  },
  currentPotCoins: { type: Number, default: 0, required: true },
  lastBidder: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String },
    photoUrl: { type: String },
  },
  bets: [auctionBetSchema],
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  
  // Provably Fair fields (more for logging/transparency here)
  serverSeed: { type: String }, // Can be generated at round start
  hashedServerSeed: { type: String },
  clientSeed: { type: String, default: 'default_client_seed_auction' }, // Could be set by players
  nonce: { type: Number, default: 1 }, // Can be incremented per round

  commissionRatePercent: { type: Number, required: true },
  commissionAmount: { type: Number, default: 0 },
  initialVirtualBankCoins: {type: Number, default: 0 }, // From config
  
  startedAt: { type: Date },
  endedAt: { type: Date },
  log: [String],

}, { timestamps: true }); // Adds createdAt, updatedAt

module.exports = mongoose.model('AuctionGame', auctionGameSchema);
