// Express server with Socket.IO integration, CORS, Firebase Auth, and health-check route
// Enhanced with Firebase JWT validation and authenticated real-time communication

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

// Firebase Admin SDK
const { initializeFirebase, getFirebaseAuth, getFirestore } = require('./firebase-admin');
const { verifyFirebaseToken, optionalAuth } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

// Initialize Firebase Admin SDK
initializeFirebase();

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
    firebase: getFirebaseAuth() ? 'Connected' : 'Not Connected'
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

// Socket.IO connection handling with authentication
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

  // Handle incoming messages
  socket.on('message', (data) => {
    console.log('Message received:', data);
    
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

  // Handle room operations (authenticated users only)
  socket.on('join-room', (room) => {
    if (!socket.isAuthenticated) {
      socket.emit('error', 'Authentication required to join rooms');
      return;
    }
    
    socket.join(room);
    console.log(`User ${socket.user.email} joined room: ${room}`);
    socket.to(room).emit('message', {
      type: 'system',
      text: `${socket.user.displayName} joined the room`,
      timestamp: new Date()
    });
  });

  socket.on('leave-room', (room) => {
    if (!socket.isAuthenticated) {
      return;
    }
    
    socket.leave(room);
    console.log(`User ${socket.user.email} left room: ${room}`);
    socket.to(room).emit('message', {
      type: 'system',
      text: `${socket.user.displayName} left the room`,
      timestamp: new Date()
    });
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', socket.id, 'Reason:', reason);
    if (socket.isAuthenticated) {
      console.log('User disconnected:', socket.user.email);
    }
  });
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
🔌 Socket.IO: Enabled with Firebase Auth
🔥 Firebase: ${getFirebaseAuth() ? '✅ Connected' : '❌ Not Connected'}
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
