const jwt = require('jsonwebtoken');
const User = require('../models/UserModel');
const crypto = require('crypto');

const generateToken = (user) => {
  return jwt.sign({ id: user.id, telegramId: user.telegramId }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

const verifyTelegramAuth = (authData) => {
  const { hash, ...data } = authData;
  const secretKey = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  const dataCheckString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join('\n');
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return hmac === hash;
};

const findOrCreateUser = async (userData) => {
  const { id, username, first_name, last_name, photo_url } = userData;

  let user = await User.findOne({ telegramId: id });

  if (user) {
    user.username = username;
    user.firstName = first_name;
    user.lastName = last_name;
    user.photoUrl = photo_url;
    await user.save();
  } else {
    user = await User.create({
      telegramId: id,
      username,
      firstName: first_name,
      lastName: last_name,
      photoUrl: photo_url,
    });
  }
  return user;
};

module.exports = {
  generateToken,
  verifyTelegramAuth,
  findOrCreateUser,
};
