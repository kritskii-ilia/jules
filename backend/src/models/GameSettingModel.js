const mongoose = require('mongoose');

const gameSettingSchema = new mongoose.Schema({
  gameId: { // e.g., 'classic1', 'classic2', 'classic3', 'auction1', 'lottery1'
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  config: { // Stores game-specific settings
    type: Object,
    required: true,
    default: {},
  },
  // Example fields within config object (structure will vary per game type):
  // For Classic Games: name, minBet, maxBetPerPlayer, timerDurationSeconds, commissionRatePercent, currency
  // For Auction Game: name, initialVirtualBankCoins, fixedBetAmountCoins, timerDurationSeconds, commissionRatePercent, currency
  // For Lottery Game: name, numberOfFields, minBetPerFieldCoins, roundDurationHours, commissionRatePercent, currency
  
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { timestamps: true }); // Adds createdAt, updatedAt automatically

module.exports = mongoose.model('GameSetting', gameSettingSchema);
