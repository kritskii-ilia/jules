const classicGameRooms = {
  classic1: {
    id: 'classic1',
    name: 'Classic Room - Low Roller',
    minBet: 1, // in coins
    maxBetPerPlayer: 100, // Max total bet a single player can place in one round
    // maxBank: 10000, // Optional: Max total pot before game might auto-start or cap bets
    timerDurationSeconds: 30, // Countdown starts when 2 unique players have bet
    commissionRatePercent: 5, // 5% commission on the pot
    currency: 'coins',
  },
  classic2: {
    id: 'classic2',
    name: 'Classic Room - Mid Stakes',
    minBet: 10,
    maxBetPerPlayer: 500,
    // maxBank: 50000,
    timerDurationSeconds: 45,
    commissionRatePercent: 4,
    currency: 'coins',
  },
  classic3: {
    id: 'classic3',
    name: 'Classic Room - High Roller',
    minBet: 100,
    maxBetPerPlayer: 2000,
    // maxBank: 200000,
    timerDurationSeconds: 60,
    commissionRatePercent: 3,
    currency: 'coins',
  },
};

const getRoomConfig = (roomId) => {
    return classicGameRooms[roomId];
}

module.exports = {
  classicGameRooms,
  getRoomConfig,
  auctionGameConfig: {
    id: 'auction1',
    name: 'Auction Game',
    initialVirtualBankCoins: 500, // Coins added by the house to start the pot
    fixedBetAmountCoins: 10,      // Each bid costs this amount
    timerDurationSeconds: 15,     // Timer resets to this on each new bid
    commissionRatePercent: 10,    // 10% commission on the final pot
    currency: 'coins',
  },
  lotteryGameConfig: {
    id: 'lottery1',
    name: 'Lottery Game',
    numberOfFields: 25, // e.g., 5x5 grid
    minBetPerFieldCoins: 5,
    roundDurationHours: 24, // A new lottery every 24 hours
    commissionRatePercent: 15,
    currency: 'coins',
  },
};
