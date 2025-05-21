const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/UserModel');
const ChatMessage = require('../models/ChatMessageModel'); // Import ChatMessageModel

let ioInstance; // Renamed to avoid confusion with module 'io'
const connectedUsers = new Map(); 

function initSocketService(httpServer, options = {}) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3001", // Allow frontend origin
      methods: ["GET", "POST"],
      credentials: true
    },
    ...options
  });

  // Middleware for JWT authentication
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication error: Token not provided'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('username photoUrl telegramId');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      socket.user = user; // Attach user info to the socket object
      next();
    } catch (err) {
      console.error("Socket authentication error:", err.message);
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.username} (Socket ID: ${socket.id}, User ID: ${socket.user._id})`);
    connectedUsers.set(socket.id, {
        id: socket.user._id,
        username: socket.user.username,
        photoUrl: socket.user.photoUrl || 'default_photo_url.png' // Provide a default if null
    });

    // Handle incoming chat messages
    socket.on('chatMessage', async (messageContent) => {
      if (typeof messageContent !== 'string' || messageContent.trim() === '') {
        socket.emit('error', { message: 'Invalid message content.' });
        return;
      }
      
      const sender = connectedUsers.get(socket.id);
      if (!sender) {
          console.error(`Sender not found for socket ID: ${socket.id}`);
          socket.emit('error', { message: 'Error sending message. Please reconnect.'});
          return;
      }
      // Prevent chat if user is banned from chat (check req.user or socket.user)
      if (socket.user && socket.user.isBannedChat) {
          const banExpires = socket.user.banChatExpiresAt ? `until ${new Date(socket.user.banChatExpiresAt).toLocaleString()}` : 'indefinitely';
          socket.emit('chatError', { message: `You are banned from chat ${banExpires}. Reason: ${socket.user.banChatReason || 'N/A'}` });
          console.log(`Blocked chat message from banned user: ${sender.username}`);
          return;
      }


      const messageData = {
        userId: sender.id, // This is the MongoDB ObjectId
        username: sender.username,
        photoUrl: sender.photoUrl,
        messageContent: messageContent.substring(0, 500), // Basic sanitization/length limit
        // timestamp is handled by Mongoose timestamps: true
      };

      try {
        const savedMessage = await new ChatMessage(messageData).save();
        
        // Broadcast to all connected clients, including the MongoDB _id
        ioInstance.emit('newChatMessage', {
            _id: savedMessage._id, // Include the database ID
            userId: savedMessage.userId,
            username: savedMessage.username,
            photoUrl: savedMessage.photoUrl,
            messageContent: savedMessage.messageContent,
            createdAt: savedMessage.createdAt, // Send timestamp from DB
        });
        console.log(`Message from ${sender.username} (ID: ${savedMessage._id}): ${messageContent}`);
      } catch (error) {
        console.error('Error saving chat message to DB:', error);
        socket.emit('error', { message: 'Failed to send message. Please try again.' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const disconnectedUser = connectedUsers.get(socket.id);
      console.log(`User disconnected: ${disconnectedUser ? disconnectedUser.username : 'Unknown'} (Socket ID: ${socket.id})`);
      connectedUsers.delete(socket.id);
    });

    socket.on('error', (error) => {
        console.error(`Socket error for user ${socket.user ? socket.user.username : 'Unknown'}:`, error);
        // You might want to send a generic error message to the client
        socket.emit('serverError', { message: 'An unexpected error occurred on the server.' });
    });

  });

  console.log("Socket.IO service initialized.");
  return ioInstance;
}

// Function to emit message deletion event
function emitChatMessageDeleted(messageId) {
    if (ioInstance) {
        ioInstance.emit('chatMessageDeleted', { messageId });
        console.log(`Emitted chatMessageDeleted for messageId: ${messageId}`);
    } else {
        console.error('Socket.IO not initialized, cannot emit chatMessageDeleted event.');
    }
}


module.exports = { initSocketService, getIO: () => ioInstance, emitChatMessageDeleted };
