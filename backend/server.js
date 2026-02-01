require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const connectionRoutes = require('./routes/connections');
const postRoutes = require('./routes/posts');
const reviewRoutes = require('./routes/reviews');
const chatRoutes = require('./routes/chat');
const botRoutes = require('./routes/bot');

// Import models
const User = require('./models/User');
const { Message, Conversation } = require('./models/Message');

const app = express();
const server = http.createServer(app);

// Trust proxy (for Render/Railway)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? `https://${process.env.DOMAIN}`
        : ['http://localhost:3000', 'http://localhost:5500', 'http://localhost:5173', 'http://127.0.0.1:5500', /^http:\/\/localhost:\d+$/],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files from frontend folder
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/bot', botRoutes);

// Health check endpoint (for Render)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve specific HTML pages
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'dashboard.html'));
});

app.get('/onboarding', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'onboarding.html'));
});

app.get('/verification-success', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'verification-success.html'));
});

app.get('/verification-failed', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'verification-failed.html'));
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Socket.io setup
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? `https://${process.env.DOMAIN}`
            : [/^http:\/\/localhost:\d+$/],
        credentials: true
    }
});

// Store connected users: Map<userId, Set<socketId>>
const connectedUsers = new Map();

// Socket.io authentication middleware
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return next(new Error('User not found'));
        }

        socket.user = user;
        next();
    } catch (error) {
        next(new Error('Authentication error'));
    }
});

// Socket.io connection handler
io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`🔌 User connected: ${socket.user.firstName} ${socket.user.lastName}`);

    // Store socket connection (support multiple sockets per user)
    if (!connectedUsers.has(userId)) {
        connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socket.id);

    // Update user online status
    await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: new Date()
    });

    // Notify connections that user is online
    socket.user.connections.forEach(connectionId => {
        const connectionSocketId = connectedUsers.get(connectionId.toString());
        if (connectionSocketId) {
            io.to(connectionSocketId).emit('user_online', { userId });
        }
    });

    // Join user to their own room for direct messages
    socket.join(userId);

    // Handle sending messages
    socket.on('send_message', async (data) => {
        try {
            const { recipientId, content, conversationId } = data;

            // Verify users are connected
            if (!socket.user.connections.includes(recipientId)) {
                socket.emit('error', { message: 'You can only message your connections' });
                return;
            }

            // Find or create conversation
            let conversation;
            if (conversationId) {
                conversation = await Conversation.findById(conversationId);
            } else {
                conversation = await Conversation.findOrCreateConversation(userId, recipientId);
            }

            // Create message
            const message = await Message.create({
                conversation: conversation._id,
                sender: userId,
                content: content.trim(),
                readBy: [{ user: userId, readAt: new Date() }]
            });

            // Update conversation
            const currentUnread = conversation.unreadCount.get(recipientId) || 0;
            await Conversation.findByIdAndUpdate(conversation._id, {
                lastMessage: message._id,
                lastMessageAt: new Date(),
                $set: { [`unreadCount.${recipientId}`]: currentUnread + 1 }
            });

            // Populate sender info
            await message.populate('sender', 'firstName lastName profilePicture');

            const messageData = {
                _id: message._id,
                conversation: conversation._id,
                sender: message.sender,
                content: message.content,
                createdAt: message.createdAt
            };

            // Send to recipient if online
            const recipientSocketId = connectedUsers.get(recipientId);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('new_message', messageData);
            }

            // Confirm to sender
            socket.emit('message_sent', messageData);

        } catch (error) {
            console.error('Socket send message error:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Handle typing indicator
    socket.on('typing_start', (data) => {
        const { recipientId, conversationId } = data;
        const recipientSocketId = connectedUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('user_typing', {
                conversationId,
                userId,
                userName: `${socket.user.firstName}`
            });
        }
    });

    socket.on('typing_stop', (data) => {
        const { recipientId, conversationId } = data;
        const recipientSocketId = connectedUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('user_stopped_typing', {
                conversationId,
                userId
            });
        }
    });

    // Handle message read
    socket.on('mark_read', async (data) => {
        const { conversationId } = data;
        try {
            await Message.updateMany(
                {
                    conversation: conversationId,
                    sender: { $ne: userId },
                    'readBy.user': { $ne: userId }
                },
                {
                    $push: {
                        readBy: { user: userId, readAt: new Date() }
                    }
                }
            );

            await Conversation.findByIdAndUpdate(conversationId, {
                $set: { [`unreadCount.${userId}`]: 0 }
            });

            // Notify sender that messages were read
            const conversation = await Conversation.findById(conversationId);
            const otherUserId = conversation.participants.find(
                p => p.toString() !== userId
            ).toString();

            const otherSocketId = connectedUsers.get(otherUserId);
            if (otherSocketId) {
                io.to(otherSocketId).emit('messages_read', { conversationId, readBy: userId });
            }
        } catch (error) {
            console.error('Mark read error:', error);
        }
    });

    // Handle connection request notifications
    socket.on('connection_request', (data) => {
        const { targetUserId } = data;
        const targetSocketId = connectedUsers.get(targetUserId);
        if (targetSocketId) {
            io.to(targetSocketId).emit('new_connection_request', {
                from: {
                    _id: socket.user._id,
                    firstName: socket.user.firstName,
                    lastName: socket.user.lastName,
                    collegeName: socket.user.collegeName
                }
            });
        }
    });

    // Handle connection accepted notifications
    socket.on('connection_accepted', (data) => {
        const { requesterId } = data;
        const requesterSocketId = connectedUsers.get(requesterId);
        if (requesterSocketId) {
            io.to(requesterSocketId).emit('connection_accepted_notification', {
                by: {
                    _id: socket.user._id,
                    firstName: socket.user.firstName,
                    lastName: socket.user.lastName,
                    collegeName: socket.user.collegeName
                }
            });
        }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
        console.log(`🔌 User disconnected: ${socket.user.firstName} ${socket.user.lastName}`);

        // Remove this socket from the user's set
        const userSockets = connectedUsers.get(userId);
        if (userSockets) {
            userSockets.delete(socket.id);
            if (userSockets.size === 0) {
                connectedUsers.delete(userId);
                // Update user offline status
                await User.findByIdAndUpdate(userId, {
                    isOnline: false,
                    lastSeen: new Date()
                });
                // Notify connections that user is offline
                socket.user.connections.forEach(connectionId => {
                    const connectionSockets = connectedUsers.get(connectionId.toString());
                    if (connectionSockets && connectionSockets.size > 0) {
                        // Notify all sockets of the connection
                        connectionSockets.forEach(sockId => {
                            io.to(sockId).emit('user_offline', { userId });
                        });
                    }
                });
            }
        }
    });
});

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
});

// Database connection and server start
const startServer = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/collera', {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 30000,
            maxPoolSize: 10,
            minPoolSize: 2,
            retryWrites: true,
            retryReads: true,
        });
        console.log('✅ Connected to MongoDB');

        // Start server only after DB connection is established
        const PORT = process.env.PORT || 3000;
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 CollEra server running on port ${PORT}`);
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`💬 Socket.io enabled for real-time chat`);
        });
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    }
};

startServer();

module.exports = { app, server, io };
