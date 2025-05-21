const adminUserService = require('../services/adminUserService');

const listUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', searchBy = 'username' } = req.query;
    const result = await adminUserService.listUsers({ 
        page: parseInt(page, 10), 
        limit: parseInt(limit, 10), 
        search, 
        searchBy 
    });
    res.json(result);
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ message: 'Error listing users.' });
  }
};

const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const userDetails = await adminUserService.getUserDetails(userId);
    res.json(userDetails);
  } catch (error) {
    console.error(`Error fetching details for user ${req.params.userId}:`, error);
    res.status(error.message === 'User not found' ? 404 : 500).json({ message: error.message });
  }
};

const banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, durationHours } = req.body;
    const banType = req.path.includes('ban-site') ? 'site' : 'chat'; // Determine ban type from path

    if (!reason) {
        return res.status(400).json({ message: 'Reason for ban is required.' });
    }
    if (durationHours && (typeof durationHours !== 'number' || durationHours <= 0)) {
        return res.status(400).json({ message: 'Invalid duration specified.' });
    }

    const updatedUser = await adminUserService.updateUserBanStatus(
        userId, 
        banType, 
        true, 
        reason, 
        durationHours ? parseInt(durationHours, 10) : null,
        req.user.username // Admin username from token
    );
    res.json({ message: `User ${banType} ban applied successfully.`, user: updatedUser });
  } catch (error) {
    console.error(`Error banning user ${req.params.userId} for ${req.path.includes('ban-site') ? 'site' : 'chat'}:`, error);
    res.status(error.message === 'User not found' ? 404 : 500).json({ message: error.message });
  }
};

const unbanUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const banType = req.path.includes('unban-site') ? 'site' : 'chat';

    const updatedUser = await adminUserService.updateUserBanStatus(
        userId, 
        banType, 
        false, 
        'Ban lifted by admin.', // Default reason for unban
        null,
        req.user.username // Admin username from token
    );
    res.json({ message: `User ${banType} unbanned successfully.`, user: updatedUser });
  } catch (error) {
    console.error(`Error unbanning user ${req.params.userId} for ${req.path.includes('unban-site') ? 'site' : 'chat'}:`, error);
    res.status(error.message === 'User not found' ? 404 : 500).json({ message: error.message });
  }
};

const adjustUserBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;
    const adminUserId = req.user.id;
    const adminUsername = req.user.username;

    if (amount === undefined || reason === undefined) {
      return res.status(400).json({ message: 'Amount and reason are required for balance adjustment.' });
    }
    if (typeof amount !== 'number') {
        return res.status(400).json({ message: 'Amount must be a number.' });
    }
     if (typeof reason !== 'string' || reason.trim() === '') {
        return res.status(400).json({ message: 'Reason must be a non-empty string.' });
    }


    const result = await adminUserService.adjustUserBalance(userId, amount, reason, adminUserId, adminUsername);
    res.json({ 
        message: 'User balance adjusted successfully.', 
        user: result.user, 
        transaction: result.transaction 
    });
  } catch (error) {
    console.error(`Error adjusting balance for user ${req.params.userId}:`, error);
    res.status(error.message === 'User not found' ? 404 : (error.message.includes('Invalid amount') || error.message.includes('Reason for balance adjustment is required')) ? 400 : 500)
       .json({ message: error.message });
  }
};

module.exports = {
  listUsers,
  getUserDetails,
  banUser,
  unbanUser,
  adjustUserBalance,
};
