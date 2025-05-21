const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const { initSocketService } = require('./services/socketService');
const classicGameService = require('./services/classicGameService');
const auctionGameService = require('./services/auctionGameService');
const lotteryGameService = require('./services/lotteryGameService');
const gameSettingsService = require('./services/gameSettingsService'); // Import Game Settings Service

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const classicGameRoutes = require('./routes/classicGameRoutes');
const auctionGameRoutes = require('./routes/auctionGameRoutes');
const lotteryGameRoutes = require('./routes/lotteryGameRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const adminGameSettingsRoutes = require('./routes/adminGameSettingsRoutes');
const adminFinanceRoutes = require('./routes/adminFinanceRoutes');
const adminChatRoutes = require('./routes/adminChatRoutes');
const adminContentService = require('./services/adminContentService');
const contentRoutes = require('./routes/contentRoutes');
const adminContentRoutes = require('./routes/adminContentRoutes');
const adminLogRoutes = require('./routes/adminLogRoutes'); // Import Admin Log Routes
const adminStatsRoutes = require('./routes/adminStatsRoutes'); // Import Admin Stats Routes
const { protect } = require('./middleware/authMiddleware');

dotenv.config({ path: './.env' });

const app = express();
const port = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
initSocketService(server);

// Middleware to parse JSON bodies
app.use(express.json()); // Make sure this is high enough

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  // Options are deprecated
})
.then(() => {
  console.log('MongoDB Connected');
  // Initialize Classic Games after DB connection
  classicGameService.initializeAllClassicGames();
  // Initialize Auction Game after DB connection
  auctionGameService.initializeAuctionGame();
  // Initialize Lottery Game after DB connection
  lotteryGameService.initializeLotteryGame();
  // Initialize Game Settings in DB
  gameSettingsService.initializeDefaultGameSettings();
  // Initialize Default Content Pages
  adminContentService.initializeDefaultContentPages();
})
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Public Routes
app.use('/api/content', contentRoutes); // Public content pages

// API Routes (mostly protected)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/games/classic', classicGameRoutes);
app.use('/api/games/auction', auctionGameRoutes);
app.use('/api/games/lottery', lotteryGameRoutes);

// Admin Routes
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/game-settings', adminGameSettingsRoutes);
app.use('/api/admin/finances', adminFinanceRoutes);
app.use('/api/admin/chat', adminChatRoutes);
app.use('/api/admin/content-pages', adminContentRoutes);
app.use('/api/admin/logs', adminLogRoutes); // Use Admin Log Routes
app.use('/api/admin/stats', adminStatsRoutes); // Use Admin Stats Routes

// Example of a protected route
app.get('/api/protected-route', protect, (req, res) => {
  res.json({ message: 'This is a protected route', user: req.user });
});

// Start the server
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Socket.IO is attached and listening on port ${port}`);
});
