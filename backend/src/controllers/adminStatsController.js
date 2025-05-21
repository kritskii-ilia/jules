const adminStatsService = require('../services/adminStatsService');

const getOverviewStats = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query; // Optional date filters
    const stats = await adminStatsService.getOverviewStats({ dateFrom, dateTo });
    res.json(stats);
  } catch (error) {
    console.error('Error fetching overview statistics:', error);
    res.status(500).json({ message: 'Error fetching overview statistics.' });
  }
};

module.exports = {
  getOverviewStats,
};
