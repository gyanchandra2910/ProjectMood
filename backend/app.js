// Main Express Application
// Integrates MoodFusion, RoomMemory, Room Connections, and Real-time features

// Load environment variables
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Route imports
const memoryRoutes = require('./routes/memoryRoutes');
const spotifyRoutes = require('./routes/spotifyRoutes');
const musicRoutes = require('./routes/musicRoutes');
const roomConnectionRoutes = require('./routes/roomConnectionRoutes');

// Services imports
const { RoomConnectionSocketHandler } = require('./services/roomConnectionSockets');

// Utility imports
const { fuseMoods, createMoodInput } = require('./utils/moodFusion');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mock authentication middleware (replace with real auth)
app.use((req, res, next) => {
  // In production, implement proper JWT/OAuth authentication
  req.user = {
    uid: req.headers['x-user-id'] || 'demo-user-' + Math.random().toString(36).substr(2, 9),
    displayName: req.headers['x-user-name'] || 'Demo User',
    email: req.headers['x-user-email'] || 'demo@example.com'
  };
  next();
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/moodfusion-db';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB');
  console.log(`Database: ${mongoose.connection.name}`);
  
  // Initialize Socket.IO services after DB connection
  const roomConnectionHandler = new RoomConnectionSocketHandler(io);
  console.log('✅ Socket.IO room connection services initialized');
  
  // Initialize room connection routes with io instance
  roomConnectionRoutes.init(io);
  console.log('✅ Room connection routes initialized with Socket.IO');
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// API Routes
app.use('/api/rooms', memoryRoutes);
app.use('/api/spotify', spotifyRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/room-connections', roomConnectionRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      moodFusion: '✅ Enabled',
      roomMemory: '✅ Enabled',
      roomConnections: '✅ Enabled',
      ambientMatching: '✅ Enabled',
      djBattles: '✅ Enabled',
      spotifyIntegration: '✅ Enabled',
      aiMusicGeneration: '✅ Enabled',
      socketIO: '✅ Real-time enabled',
      mongoDb: mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'
    }
  });
});

// MoodFusion API endpoint for testing
app.post('/api/mood/fuse', (req, res) => {
  try {
    const { moodInputs } = req.body;
    
    if (!moodInputs || !Array.isArray(moodInputs) || moodInputs.length === 0) {
      return res.status(400).json({
        error: 'Invalid input',
        details: 'moodInputs must be a non-empty array'
      });
    }
    
    // Validate and create mood inputs
    const processedInputs = moodInputs.map(input => {
      if (typeof input === 'string') {
        return createMoodInput(input);
      } else if (typeof input === 'object' && input.mood) {
        return createMoodInput(
          input.mood,
          input.confidence || 1.0,
          input.weight || 1.0,
          input.source || 'api'
        );
      } else {
        throw new Error(`Invalid mood input: ${JSON.stringify(input)}`);
      }
    });
    
    // Fuse moods
    const result = fuseMoods(processedInputs);
    
    res.json({
      success: true,
      input: {
        moodCount: processedInputs.length,
        moods: processedInputs.map(input => input.mood)
      },
      result
    });
    
  } catch (error) {
    console.error('Mood fusion error:', error);
    res.status(400).json({
      error: 'Mood fusion failed',
      details: error.message
    });
  }
});

// Test endpoint for MoodFusion examples
app.get('/api/mood/examples', (req, res) => {
  const examples = [
    {
      name: 'Calm + Excited Mix',
      inputs: ['calm', 'excited'],
      description: 'Demonstrates fusion of opposite moods'
    },
    {
      name: 'Sad + Anxious Combination',
      inputs: ['sad', 'anxious'],
      description: 'Shows how negative moods combine'
    },
    {
      name: 'Complex Mix',
      inputs: [
        { mood: 'happy', confidence: 0.8, weight: 1.5 },
        { mood: 'relaxed', confidence: 0.6, weight: 1.0 },
        { mood: 'content', confidence: 0.9, weight: 1.2 }
      ],
      description: 'Weighted fusion with confidence scores'
    }
  ];
  
  res.json({
    success: true,
    examples,
    usage: {
      endpoint: 'POST /api/mood/fuse',
      format: {
        moodInputs: [
          'string mood names or',
          {
            mood: 'string',
            confidence: 'number (0-1, optional)',
            weight: 'number (optional)',
            source: 'string (optional)'
          }
        ]
      }
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /api/health',
      'POST /api/mood/fuse',
      'GET /api/mood/examples',
      'POST /api/rooms/:roomId/memory',
      'GET /api/rooms/:roomId/memories',
      'GET /api/rooms/:roomId/memories/:memoryId/replay',
      'GET /api/rooms/:roomId/memories/similar'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Shutting down gracefully...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n🚀 MoodFusion API Server running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🧠 Mood fusion: http://localhost:${PORT}/api/mood/fuse`);
    console.log(`📝 Examples: http://localhost:${PORT}/api/mood/examples`);
    console.log(`💾 Memory API: http://localhost:${PORT}/api/rooms/:roomId/memory`);
    console.log(`🎵 Music API: http://localhost:${PORT}/api/music`);
    console.log(`🔗 Room Connections: http://localhost:${PORT}/api/room-connections`);
    console.log(`⚡ Socket.IO: Real-time room connections enabled`);
    console.log('');
  });
}

module.exports = app;
