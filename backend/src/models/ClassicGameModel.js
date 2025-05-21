const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  photoUrl: { type: String },
  totalBet: { type: Number, required: true, default: 0 },
  ticketsStart: { type: Number, required: true, default: 0 }, // Inclusive
  ticketsEnd: { type: Number, required: true, default: 0 },   // Inclusive
}, { _id: false });

const classicGameSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true }, // e.g., 'classic1', 'classic2'
  roundNumber: { type: Number, required: true, default: 1 },
  status: {
    type: String,
    enum: ['waiting', 'countdown', 'spinning', 'finished', 'error'],
    default: 'waiting',
    required: true,
  },
  players: [playerSchema],
  totalPot: { type: Number, default: 0, required: true },
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  winningTicket: { type: Number, default: null },
  
  // Provably Fair fields
  serverSeed: { type: String, required: true }, // Stored encrypted or revealed only at the end
  hashedServerSeed: { type: String, required: true },
  clientSeed: { type: String, default: 'default_client_seed' }, // Can be user-specific or aggregated
  nonce: { type: Number, required: true, default: 1 }, // Round-specific nonce

  commissionRatePercent: { type: Number, required: true }, // From room config
  commissionAmount: { type: Number, default: 0 },
  
  startedAt: { type: Date },
  endedAt: { type: Date },
  log: [String], // For important events or errors during the game round

}, { timestamps: true }); // Adds createdAt, updatedAt

classicGameSchema.index({ roomId: 1, roundNumber: 1 }, { unique: true });

module.exports = mongoose.model('ClassicGame', classicGameSchema);
