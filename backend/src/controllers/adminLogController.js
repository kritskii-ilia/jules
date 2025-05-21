const adminLogService = require('../services/adminLogService');

const listAdminActionLogs = async (req, res) => {
  try {
    const { page, limit, adminUserId, action, targetType, dateFrom, dateTo } = req.query;
    const result = await adminLogService.listAdminActionLogs({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      adminUserId,
      action,
      targetType,
      dateFrom,
      dateTo,
    });
    res.json(result);
  } catch (error) {
    console.error('Error listing admin action logs:', error);
    res.status(500).json({ message: 'Error listing admin action logs.' });
  }
};

const listSystemLogs = async (req, res) => {
  // For this implementation, system logs are primarily console logs.
  // A more advanced system might pull from a log file or a dedicated logging database.
  res.json({ 
    message: "System logs are currently directed to the server console and/or external log management tools (if configured). Please check those sources for detailed system-level logging.",
    tip: "For specific admin actions, please use the /api/admin/logs/admin-actions endpoint."
  });
};

module.exports = {
  listAdminActionLogs,
  listSystemLogs,
};
