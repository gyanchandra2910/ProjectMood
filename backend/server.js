// Express server with Socket.IO integration, CORS, and health-check route
// This server handles real-time communication and provides API endpoints

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Configure Socket.IO with CORS
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.get('/', (req, res) => {
  res.json({
    message: 'ProjectMood Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      socketIO: 'Socket.IO enabled on same port'
    }
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Send welcome message
  socket.emit('message', `Welcome! You are connected as ${socket.id}`);

  // Handle incoming messages
  socket.on('message', (data) => {
    console.log('Message received:', data);
    // Broadcast to all connected clients
    io.emit('message', `${socket.id}: ${data}`);
  });

  // Handle custom events
  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`Client ${socket.id} joined room: ${room}`);
    socket.to(room).emit('message', `${socket.id} joined the room`);
  });

  socket.on('leave-room', (room) => {
    socket.leave(room);
    console.log(`Client ${socket.id} left room: ${room}`);
    socket.to(room).emit('message', `${socket.id} left the room`);
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', socket.id, 'Reason:', reason);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
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
🔌 Socket.IO: Enabled
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
