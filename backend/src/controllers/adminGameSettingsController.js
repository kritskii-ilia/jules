const gameSettingsService = require('../services/gameSettingsService');

const getAllGameSettings = async (req, res) => {
  try {
    const settings = await gameSettingsService.getAllGameSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching all game settings:', error);
    res.status(500).json({ message: 'Error fetching game settings.' });
  }
};

const getGameSetting = async (req, res) => {
  try {
    const { gameId } = req.params;
    const setting = await gameSettingsService.getGameSettings(gameId);
    if (!setting) {
      return res.status(404).json({ message: `Game setting for ${gameId} not found.` });
    }
    res.json({ gameId, config: setting });
  } catch (error)
  {
    console.error(`Error fetching game setting for ${req.params.gameId}:`, error);
    res.status(500).json({ message: error.message || 'Error fetching game setting.' });
  }
};

const updateGameSetting = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { newConfig } = req.body; // Expecting the new configuration object directly
    const adminUserId = req.user.id; // From adminProtect middleware

    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({ message: 'Invalid newConfig data provided.' });
    }

    // Basic validation: Ensure essential keys are not being set to undefined or wrong types
    // This should be more robust based on each game's specific config structure
    if (newConfig.hasOwnProperty('commissionRatePercent') && (typeof newConfig.commissionRatePercent !== 'number' || newConfig.commissionRatePercent < 0 || newConfig.commissionRatePercent > 100)) {
        return res.status(400).json({ message: 'Invalid commissionRatePercent.' });
    }
    if (newConfig.hasOwnProperty('timerDurationSeconds') && (typeof newConfig.timerDurationSeconds !== 'number' || newConfig.timerDurationSeconds <= 0)) {
        return res.status(400).json({ message: 'Invalid timerDurationSeconds.' });
    }
    // Add more specific validations for minBet, maxBet, etc. per game type if needed.

    const updatedConfig = await gameSettingsService.updateGameSettings(gameId, newConfig, adminUserId);
    res.json({ message: `Game setting for ${gameId} updated successfully.`, config: updatedConfig });
  } catch (error) {
    console.error(`Error updating game setting for ${req.params.gameId}:`, error);
    res.status(error.message.includes('not found') ? 404 : 500).json({ message: error.message || 'Error updating game setting.' });
  }
};

module.exports = {
  getAllGameSettings,
  getGameSetting,
  updateGameSetting,
};
