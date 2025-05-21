const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  userId: { // Can be null for system messages, but usually a user
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, 
  },
  username: { // Denormalized for easy display, especially if userId is null or for past users
    type: String,
    required: true,
  },
  photoUrl: { // Denormalized
    type: String,
  },
  messageContent: {
    type: String,
    required: true,
    trim: true,
  },
  isDeleted: { // For soft deletion
    type: Boolean,
    default: false,
  },
  deletedBy: { // Optional: track who deleted the message
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  deletedAt: { // Optional: track when it was deleted
    type: Date,
    default: null,
  }
}, { timestamps: true }); // Adds createdAt, updatedAt automatically

// Index for querying messages, potentially by user or if deleted
chatMessageSchema.index({ userId: 1, createdAt: -1 });
chatMessageSchema.index({ isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
