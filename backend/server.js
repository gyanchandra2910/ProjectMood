// Express server with Socket.IO integration, CORS, Firebase Auth, MongoDB, and room management
// Enhanced with room system, mood tracking, and real-time messaging

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

// Firebase Admin SDK
const { initializeFirebase, getFirebaseAuth, getFirestore } = require('./firebase-admin');
const { verifyFirebaseToken, optionalAuth } = require('./middleware/auth');

// MongoDB
const { connectDB } = require('./database');
const Room = require('./models/Room');

// Room handlers
const {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handleUpdateMood,
  handleSendMessage,
  handleGetRooms,
  handleDisconnect
} = require('./handlers/roomHandlers');

const app = express();
const server = http.createServer(app);

// Initialize Firebase Admin SDK
initializeFirebase();

// Connect to MongoDB
connectDB();

// Configure Socket.IO with CORS
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    firebase: getFirebaseAuth() ? 'Connected' : 'Not Connected',
    mongodb: require('mongoose').connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// API Routes
app.get('/', optionalAuth, (req, res) => {
  res.json({
    message: 'ProjectMood Backend API',
    version: '1.0.0',
    user: req.user ? {
      uid: req.user.uid,
      email: req.user.email,
      displayName: req.user.displayName
    } : null,
    endpoints: {
      health: '/health',
      profile: '/api/profile (requires auth)',
      users: '/api/users (requires auth)',
      socketIO: 'Socket.IO enabled on same port'
    }
  });
});

// Protected API Routes
app.get('/api/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const firestore = getFirestore();
    if (!firestore) {
      return res.status(500).json({
        error: 'Firestore not available'
      });
    }

    // Get user profile from Firestore
    const userDoc = await firestore.collection('users').doc(req.user.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        error: 'Profile not found'
      });
    }

    res.json({
      user: req.user,
      profile: userDoc.data()
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      error: 'Failed to fetch profile'
    });
  }
});

app.get('/api/rooms', verifyFirebaseToken, async (req, res) => {
  try {
    const rooms = await Room.findActiveRooms();
    
    const roomList = rooms.map(room => ({
      roomId: room.roomId,
      name: room.name,
      description: room.description,
      participantCount: room.participants ? room.participants.filter(p => p.isOnline).length : 0,
      lastActivity: room.lastActivity,
      createdAt: room.createdAt
    }));

    res.json({
      rooms: roomList,
      count: roomList.length
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({
      error: 'Failed to fetch rooms'
    });
  }
});

app.get('/api/rooms/:roomId', verifyFirebaseToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findByRoomId(roomId);
    
    if (!room) {
      return res.status(404).json({
        error: 'Room not found'
      });
    }

    res.json({
      roomId: room.roomId,
      name: room.name,
      description: room.description,
      participants: room.participants.filter(p => p.isOnline),
      messages: room.getRecentMessages(20),
      createdAt: room.createdAt,
      lastActivity: room.lastActivity
    });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({
      error: 'Failed to fetch room'
    });
  }
});

app.get('/api/users', verifyFirebaseToken, async (req, res) => {
  try {
    const firestore = getFirestore();
    if (!firestore) {
      return res.status(500).json({
        error: 'Firestore not available'
      });
    }

    // Get list of users (limited for privacy)
    const usersSnapshot = await firestore.collection('users')
      .select('displayName', 'email', 'photoURL', 'createdAt')
      .limit(50)
      .get();
    
    const users = [];
    usersSnapshot.forEach(doc => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      users,
      count: users.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      error: 'Failed to fetch users'
    });
  }
});

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      // Allow connection but mark as unauthenticated
      socket.isAuthenticated = false;
      socket.user = null;
      return next();
    }

    const firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth) {
      socket.isAuthenticated = false;
      socket.user = null;
      return next();
    }

    const decodedToken = await firebaseAuth.verifyIdToken(token);
    
    socket.isAuthenticated = true;
    socket.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name,
      photoURL: decodedToken.picture
    };
    
    next();
  } catch (error) {
    console.error('Socket authentication failed:', error);
    socket.isAuthenticated = false;
    socket.user = null;
    next();
  }
});

// Socket.IO connection handling with authentication and room management
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  if (socket.isAuthenticated && socket.user) {
    console.log('Authenticated user:', socket.user.email);
    socket.emit('message', {
      type: 'system',
      text: `Welcome back, ${socket.user.displayName || socket.user.email}!`,
      timestamp: new Date()
    });
  } else {
    console.log('Unauthenticated connection');
    socket.emit('message', {
      type: 'system',
      text: 'Connected as guest. Please sign in for full features.',
      timestamp: new Date()
    });
  }

  // Room management events
  socket.on('createRoom', (data) => handleCreateRoom(socket, data));
  socket.on('joinRoom', (data) => handleJoinRoom(socket, data));
  socket.on('leaveRoom', (data) => handleLeaveRoom(socket, data));
  socket.on('updateMood', (data) => handleUpdateMood(socket, data));
  socket.on('sendMessage', (data) => handleSendMessage(socket, data));
  socket.on('getRooms', () => handleGetRooms(socket));

  // Legacy message handling (for backward compatibility)
  socket.on('message', (data) => {
    console.log('Legacy message received:', data);
    
    const messageData = {
      type: 'user',
      text: typeof data === 'string' ? data : data.text,
      user: socket.isAuthenticated ? socket.user : {
        displayName: 'Guest',
        uid: socket.id
      },
      timestamp: new Date()
    };
    
    // Broadcast to all connected clients
    io.emit('message', messageData);
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => handleDisconnect(socket, reason));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`
🚀 ProjectMood Backend Server Running!
📍 Port: ${PORT}
🌐 Health Check: http://localhost:${PORT}/health
🔌 Socket.IO: Enabled with Firebase Auth & Room System
🔥 Firebase: ${getFirebaseAuth() ? '✅ Connected' : '❌ Not Connected'}
🍃 MongoDB: ${require('mongoose').connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}
⏰ Started: ${new Date().toLocaleString()}
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = { app, server, io };
