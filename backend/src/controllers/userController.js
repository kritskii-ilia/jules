const userService = require('../services/userService');

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming protect middleware adds user to req
    const userProfile = await userService.getUserProfile(userId);
    const transactions = await userService.getUserTransactionHistory(userId);
    res.json({ user: userProfile, transactions });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: error.message || 'Error fetching user profile' });
  }
};

const disableGaming = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming protect middleware adds user to req
    const user = await userService.disableGamingForUser(userId);
    res.json({ message: 'Gaming has been disabled for 24 hours.', isGamingDisabledUntil: user.isGamingDisabledUntil });
  } catch (error) {
    console.error('Error disabling gaming:', error);
    res.status(500).json({ message: error.message || 'Error disabling gaming' });
  }
};

module.exports = {
  getProfile,
  disableGaming,
};
