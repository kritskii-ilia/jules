const mongoose = require('mongoose');

const adminActionLogSchema = new mongoose.Schema({
  adminUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Assuming your User model is named 'User'
    required: true,
  },
  adminUsername: { // Denormalized for easier display in logs
    type: String,
    required: true,
  },
  action: { // e.g., 'banned_user', 'adjusted_balance', 'updated_game_settings', 'deleted_chat_message'
    type: String,
    required: true,
    index: true,
  },
  targetType: { // e.g., 'user', 'game_setting', 'transaction', 'chat_message', 'content_page'
    type: String,
    required: false, // Might not always have a specific target type (e.g. system-wide action)
    index: true,
  },
  targetId: { // ID of the entity that was acted upon
    type: String, // Can be ObjectId or a string key like gameId or pageKey
    required: false,
  },
  details: { // Object to store action-specific data, e.g., { userId: '...', reason: '...' } for ban
    type: Object,
    default: {},
  },
  // No need for explicit timestamp, { timestamps: true } handles createdAt
}, { timestamps: true });

adminActionLogSchema.index({ createdAt: -1 }); // For sorting by time
adminActionLogSchema.index({ adminUserId: 1, createdAt: -1 }); // For filtering by admin

module.exports = mongoose.model('AdminActionLog', adminActionLogSchema);
