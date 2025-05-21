const paymentService = require('../services/paymentService');
const paymentConfig = require('../config/paymentConfig'); // For static wallet address

// Controller for simulated deposit check
const checkMockDeposit = async (req, res) => {
  try {
    // In a real scenario, this data might come from a webhook or a monitoring service
    // that has already confirmed a blockchain transaction.
    // For simulation, the client sends mock data.
    const { mockTonAmount, mockBlockchainTxId, memo } = req.body;
    const userId = req.user.id; // User performing the "check", or derive from memo if more appropriate

    if (!mockTonAmount || !mockBlockchainTxId || !memo) {
      return res.status(400).json({ message: 'Missing mockTonAmount, mockBlockchainTxId, or memo.' });
    }

    // Here, 'memo' would typically be the user's unique ID that they included
    // when making the deposit to the static wallet address.
    // For this simulation, we'll assume the memo *is* the user's ID from the JWT for simplicity,
    // though in a real system, the memo would be used to look up the user.
    // If the memo was different from req.user.id, you'd use the memo to find the user.
    // For this exercise, we'll use req.user.id as the target user for simplicity.
    
    // Log if memo is problematic (e.g. if it was intended to be different from user.id and failed validation)
    // For example, if memo was supposed to be a specific format or match a known user ID:
    // if (!isValidMemoFormat(memo)) { 
    //    console.warn(`Problematic deposit memo received: ${memo} from user ${userId}`);
    //    // Potentially flag for admin review, but for now just log
    // }

    const result = await paymentService.processMockDeposit(userId, parseFloat(mockTonAmount), mockBlockchainTxId, memo);
    res.json({ 
      message: 'Mock deposit processed successfully.', 
      transaction: result.transaction, 
      userBalance: result.userBalance,
      staticTonWalletAddress: paymentConfig.staticTonWalletAddress // Provide this for user info
    });
  } catch (error) {
    console.error('Error in checkMockDeposit controller:', error);
    // If error is due to user not found via memo (if memo was the primary key for user lookup)
    if (error.message.includes("User ID (memo) is missing or invalid") || error.message.includes("User not found")) {
        console.warn(`Failed mock deposit attempt: ${error.message}. Data: ${JSON.stringify(req.body)}`);
        // This is where you'd flag for admin review in a real system
        return res.status(400).json({ message: `Deposit failed: ${error.message}` });
    }
    res.status(500).json({ message: 'Server error during mock deposit processing.' });
  }
};

// Controller for withdrawal request
const requestWithdrawal = async (req, res) => {
  try {
    const { amount: coinsAmount, tonWalletAddress } = req.body;
    const userId = req.user.id;

    if (!coinsAmount || !tonWalletAddress) {
      return res.status(400).json({ message: 'Missing amount (in coins) or tonWalletAddress.' });
    }
    if (isNaN(parseFloat(coinsAmount)) || parseFloat(coinsAmount) <= 0) {
        return res.status(400).json({ message: 'Invalid amount for withdrawal.' });
    }

    const result = await paymentService.requestWithdrawal(userId, parseFloat(coinsAmount), tonWalletAddress);
    res.json({ 
      message: 'Withdrawal request submitted successfully. It will be processed shortly.', 
      transaction: result.transaction,
      userBalance: result.userBalance 
    });
  } catch (error) {
    console.error('Error in requestWithdrawal controller:', error);
    res.status(400).json({ message: error.message || 'Server error during withdrawal request.' });
  }
};

// Controller to get payment configuration (like static wallet address)
const getPaymentConfig = (req, res) => {
  res.json({
    staticTonWalletAddress: paymentConfig.staticTonWalletAddress,
    tonToCoinsRate: paymentConfig.tonToCoinsRate,
    minWithdrawalAmountCoins: paymentConfig.minWithdrawalAmountCoins,
  });
};


module.exports = {
  checkMockDeposit,
  requestWithdrawal,
  getPaymentConfig,
};
