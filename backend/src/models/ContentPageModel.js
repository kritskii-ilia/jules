const mongoose = require('mongoose');

const contentPageSchema = new mongoose.Schema({
  pageKey: { // e.g., 'faq', 'terms', 'provably-fair-info', 'about-us'
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true, // Standardize pageKey to lowercase
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: { // Store as HTML or Markdown. Assume HTML for now for direct rendering.
    type: String,
    required: true,
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model (admin who updated it)
    default: null,
  },
}, { timestamps: true }); // Adds createdAt and updatedAt automatically

module.exports = mongoose.model('ContentPage', contentPageSchema);
