const AdminActionLog = require('../models/AdminActionLogModel');

/**
 * Logs an administrative action.
 * @param {string} adminUserId - The ID of the admin performing the action.
 * @param {string} adminUsername - The username of the admin.
 * @param {string} action - A string identifying the action (e.g., 'USER_BAN', 'GAME_SETTINGS_UPDATE').
 * @param {string} [targetType] - The type of entity being acted upon (e.g., 'user', 'game_setting').
 * @param {string} [targetId] - The ID of the entity.
 * @param {object} [details={}] - An object containing additional details about the action.
 */
const logAdminAction = async (adminUserId, adminUsername, action, targetType, targetId, details = {}) => {
  try {
    const logEntry = new AdminActionLog({
      adminUserId,
      adminUsername,
      action,
      targetType,
      targetId,
      details,
    });
    await logEntry.save();
    console.log(`Admin Action Logged: ${adminUsername} performed ${action} on ${targetType || 'N/A'}:${targetId || 'N/A'}`);
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Depending on policy, you might want to throw this error, or just log it and continue
  }
};

const listAdminActionLogs = async ({ page = 1, limit = 20, adminUserId, action, targetType, dateFrom, dateTo }) => {
  const query = {};

  if (adminUserId) query.adminUserId = adminUserId;
  if (action) query.action = { $regex: action, $options: 'i' }; // Case-insensitive search for action
  if (targetType) query.targetType = targetType;

  if (dateFrom || dateTo) {
    query.createdAt = {}; // Log entries use 'createdAt' from timestamps
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  const logs = await AdminActionLog.find(query)
    .populate('adminUserId', 'username') // Just get username from User model
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 })
    .exec();

  const count = await AdminActionLog.countDocuments(query);

  return {
    logs,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page, 10),
    totalLogs: count,
  };
};

module.exports = {
  logAdminAction,
  listAdminActionLogs,
};
