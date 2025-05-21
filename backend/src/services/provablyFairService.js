const crypto = require('crypto');

/**
 * Generates a cryptographically strong random server seed.
 * @returns {string} Hex-encoded server seed.
 */
const generateServerSeed = () => {
  return crypto.randomBytes(32).toString('hex'); // 64 characters
};

/**
 * Hashes the server seed using SHA256.
 * @param {string} serverSeed - The server seed to hash.
 * @returns {string} Hex-encoded hash of the server seed.
 */
const hashServerSeed = (serverSeed) => {
  if (!serverSeed || typeof serverSeed !== 'string') {
    throw new Error('Invalid server seed provided for hashing.');
  }
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
};

/**
 * Combines server seed, client seed, and nonce into a single string.
 * @param {string} serverSeed - The server seed.
 * @param {string} clientSeed - The client seed.
 * @param {(string|number)} nonce - The nonce (game round number or unique ID).
 * @returns {string} The combined string.
 */
const combineSeeds = (serverSeed, clientSeed, nonce) => {
  if (typeof serverSeed !== 'string' || typeof clientSeed !== 'string' || (typeof nonce !== 'string' && typeof nonce !== 'number')) {
    throw new Error('Invalid input types for combining seeds.');
  }
  return `${serverSeed}:${clientSeed}:${nonce}`;
};

/**
 * Generates a game result based on combined seeds and a maximum outcome.
 * Uses HMAC-SHA512 for a robust and fair distribution.
 * @param {string} serverSeed - The server seed (used as the key for HMAC).
 * @param {string} clientSeed - The client seed.
 * @param {(string|number)} nonce - The nonce.
 * @param {number} maxOutcome - The maximum possible outcome (exclusive, e.g., 100 for results 0-99).
 * @returns {number} The generated game result (integer).
 */
const generateGameResult = (serverSeed, clientSeed, nonce, maxOutcome) => {
  if (typeof serverSeed !== 'string' || typeof clientSeed !== 'string' || 
      (typeof nonce !== 'string' && typeof nonce !== 'number') || typeof maxOutcome !== 'number' || maxOutcome <= 0) {
    throw new Error('Invalid input for generating game result.');
  }
  if (!Number.isInteger(maxOutcome)) {
    throw new Error('maxOutcome must be an integer.');
  }

  const combinedClientNonce = `${clientSeed}:${nonce}`;
  const hmac = crypto.createHmac('sha512', serverSeed);
  hmac.update(combinedClientNonce);
  const hash = hmac.digest('hex');

  // Use first 8 bytes (16 hex characters) for a larger range before modulo
  // This helps in achieving a more uniform distribution for typical maxOutcome values.
  const hexPart = hash.substring(0, 16); 
  const decimalValue = parseInt(hexPart, 16);

  return decimalValue % maxOutcome;
};

/**
 * Verifies a game result by re-generating it with the provided seeds and nonce.
 * @param {string} serverSeed - The server seed.
 * @param {string} clientSeed - The client seed.
 * @param {(string|number)} nonce - The nonce.
 * @param {number} maxOutcome - The maximum possible outcome (exclusive).
 * @param {number} gameResultToVerify - The game result to verify.
 * @returns {boolean} True if the generated result matches gameResultToVerify, false otherwise.
 */
const verifyGameResult = (serverSeed, clientSeed, nonce, maxOutcome, gameResultToVerify) => {
  if (typeof gameResultToVerify !== 'number' || !Number.isInteger(gameResultToVerify) || gameResultToVerify < 0) {
      throw new Error('Invalid gameResultToVerify provided.');
  }
  const calculatedResult = generateGameResult(serverSeed, clientSeed, nonce, maxOutcome);
  return calculatedResult === gameResultToVerify;
};

module.exports = {
  generateServerSeed,
  hashServerSeed,
  combineSeeds, // Though generateGameResult and verifyGameResult now take individual parts
  generateGameResult,
  verifyGameResult,
};
