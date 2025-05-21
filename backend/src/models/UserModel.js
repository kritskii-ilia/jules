const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
  },
  photoUrl: {
    type: String,
  },
  balance: {
    type: Number,
    default: 0,
  },
  isGamingDisabledUntil: {
    type: Date,
    default: null,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  isBannedSite: {
    type: Boolean,
    default: false,
  },
  banSiteReason: {
    type: String,
    default: null,
  },
  banSiteExpiresAt: {
    type: Date,
    default: null,
  },
  isBannedChat: {
    type: Boolean,
    default: false,
  },
  banChatReason: {
    type: String,
    default: null,
  },
  banChatExpiresAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
