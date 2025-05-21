const authService = require('../services/authService');

const telegramLogin = async (req, res) => {
  try {
    const authData = req.body; // Data from Telegram login widget

    // 1. Verify Telegram authentication data
    if (!authService.verifyTelegramAuth(authData)) {
      return res.status(401).json({ message: 'Invalid Telegram data' });
    }

    // 2. Find or create user
    const user = await authService.findOrCreateUser(authData);

    // 3. Generate JWT token
    const token = authService.generateToken(user);

    res.json({ token, user });
  } catch (error) {
    console.error('Error during Telegram login:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

module.exports = {
  telegramLogin,
};
