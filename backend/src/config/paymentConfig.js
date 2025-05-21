const dotenv = require('dotenv');
dotenv.config({ path: '../.env' }); // Adjust path if necessary, assuming .env is in backend folder

const paymentConfig = {
  staticTonWalletAddress: process.env.STATIC_TON_WALLET_ADDRESS,
  tonToCoinsRate: parseInt(process.env.TON_TO_COINS_RATE, 10) || 1000, // Default to 1000 if not set
  minWithdrawalAmountCoins: 100, // Example: Minimum 100 coins for withdrawal
  withdrawalFeeCoins: 5, // Example: 5 coins withdrawal fee
};

if (!paymentConfig.staticTonWalletAddress) {
  console.warn("Warning: STATIC_TON_WALLET_ADDRESS is not set in .env. Deposits will not have a target address.");
}

if (isNaN(paymentConfig.tonToCoinsRate)) {
  console.warn("Warning: TON_TO_COINS_RATE is not a valid number in .env. Using default 1000.");
  paymentConfig.tonToCoinsRate = 1000;
}


module.exports = paymentConfig;
