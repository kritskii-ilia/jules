const GameSetting = require('../models/GameSettingModel');
const { classicGameRooms, auctionGameConfig, lotteryGameConfig } = require('../config/gameConfig');
const mongoose = require('mongoose');
const { logAdminAction } = require('./adminLogService'); // Import admin logger

// In-memory cache for game settings
const gameSettingsCache = new Map();

const getGameSettings = async (gameId) => {
  if (gameSettingsCache.has(gameId)) {
    return gameSettingsCache.get(gameId);
  }

  const setting = await GameSetting.findOne({ gameId });
  if (setting) {
    gameSettingsCache.set(gameId, setting.config);
    return setting.config;
  }
  // If not in DB, it should have been initialized on startup.
  // This path might indicate an issue or a new game type added without restart/re-init.
  console.warn(`Game setting for ${gameId} not found in DB or cache. Attempting to load from default.`);
  
  // Fallback to default if somehow missed (should not happen if init is correct)
  let defaultConfig;
  if (classicGameRooms[gameId]) {
    defaultConfig = classicGameRooms[gameId];
  } else if (gameId === auctionGameConfig.id) {
    defaultConfig = auctionGameConfig;
  } else if (gameId === lotteryGameConfig.id) {
    defaultConfig = lotteryGameConfig;
  }

  if (defaultConfig) {
      console.warn(`Game setting for ${gameId} loaded from default config as fallback.`);
      // Optionally, save it to DB now if it was missing
      // await GameSetting.findOneAndUpdate({ gameId }, { gameId, config: defaultConfig }, { upsert: true, new: true });
      gameSettingsCache.set(gameId, defaultConfig);
      return defaultConfig;
  }
  
  console.error(`No default config found for gameId: ${gameId} as a fallback.`);
  return null; // Or throw an error
};

const updateGameSettings = async (gameId, newConfigData, adminUserId) => {
  const setting = await GameSetting.findOne({ gameId });
  if (!setting) {
    throw new Error(`Game setting for ${gameId} not found. Cannot update.`);
  }

  // Perform validation or merging logic if necessary
  // For example, ensure essential fields are not removed or types are correct.
  // This is a simple overwrite for now.
  const oldConfig = JSON.parse(JSON.stringify(setting.config)); // Deep clone for logging
  setting.config = { ...setting.config, ...newConfigData }; 
  setting.lastUpdatedBy = adminUserId ? new mongoose.Types.ObjectId(adminUserId) : null;
  
  await setting.save();
  gameSettingsCache.set(gameId, setting.config); 
  console.log(`Game settings for ${gameId} updated by admin ${adminUserId}. New config:`, JSON.stringify(setting.config).substring(0,100));
  
  // Log this action
  // Fetch admin username if possible, or pass it if available. For now, only ID.
  // In a real scenario, adminUsername would be available from req.user.username in the controller
  // and passed down to the service.
  await logAdminAction(
    adminUserId,
    'Admin', // Placeholder for adminUsername, should be fetched or passed
    'GAME_SETTINGS_UPDATED',
    'game_setting',
    gameId,
    { oldConfig, newConfig: setting.config }
  );
  
  // Inform relevant game services about the update
  // For now, game services will fetch on new round.
  
  return setting.config;
};

const getAllGameSettings = async () => {
  const settings = await GameSetting.find({});
  return settings.map(s => ({ gameId: s.gameId, config: s.config, updatedAt: s.updatedAt, lastUpdatedBy: s.lastUpdatedBy }));
};

const initializeDefaultGameSettings = async () => {
  console.log('Initializing default game settings from gameConfig.js into DB...');
  const allDefaultConfigs = {
    ...classicGameRooms,
    [auctionGameConfig.id]: auctionGameConfig,
    [lotteryGameConfig.id]: lotteryGameConfig,
  };

  for (const [gameId, defaultConfig] of Object.entries(allDefaultConfigs)) {
    try {
      let setting = await GameSetting.findOne({ gameId });
      if (!setting) {
        console.log(`No setting found for ${gameId} in DB. Initializing from default.`);
        setting = new GameSetting({
          gameId,
          config: defaultConfig,
        });
        await setting.save();
        console.log(`Saved default config for ${gameId} to DB.`);
      } else {
        // Optional: Update existing DB entry if default has new fields (complex merge logic)
        // For now, if it exists, we assume it's managed by admin.
        // Or, could do a shallow merge of top-level keys:
        // let updated = false;
        // for (const key in defaultConfig) {
        //   if (setting.config[key] === undefined) {
        //     setting.config[key] = defaultConfig[key];
        //     updated = true;
        //   }
        // }
        // if (updated) {
        //   console.log(`Updating existing config for ${gameId} with new default fields.`);
        //   await setting.save();
        // }
        console.log(`Settings for ${gameId} already exist in DB. Skipping initialization from default.`);
      }
      gameSettingsCache.set(gameId, setting.config); // Populate cache
    } catch (error) {
      console.error(`Error initializing game setting for ${gameId}:`, error);
    }
  }
  console.log('Game settings cache populated from DB/defaults.');
  console.log('Default game settings initialization complete.');
};


module.exports = {
  getGameSettings,
  updateGameSettings,
  getAllGameSettings,
  initializeDefaultGameSettings,
  gameSettingsCache // Exporting cache for direct use by game services if needed for performance
};
