// Room Connection Routes
// REST API endpoints for room connections, DJ battles, and ambient matching

const express = require('express');
const router = express.Router();
const { RoomConnectionManager } = require('../services/roomConnection');
const { AmbientMatchingService } = require('../services/ambientMatching');

// Global managers (initialized in app.js)
let roomConnectionManager = null;
let ambientMatchingService = null;

// Initialize services
const initializeServices = (io) => {
  if (!roomConnectionManager) {
    roomConnectionManager = new RoomConnectionManager(io);
  }
  if (!ambientMatchingService) {
    ambientMatchingService = new AmbientMatchingService(io);
  }
};

// Middleware to ensure services are initialized
const requireServices = (req, res, next) => {
  if (!roomConnectionManager || !ambientMatchingService) {
    return res.status(500).json({
      success: false,
      error: 'Room connection services not initialized'
    });
  }
  next();
};

// === ROOM CONNECTION ENDPOINTS ===

// Connect two rooms
router.post('/connect', requireServices, async (req, res) => {
  try {
    const { roomA, roomB, userId, options = {} } = req.body;

    if (!roomA || !roomB || !userId) {
      return res.status(400).json({
        success: false,
        error: 'roomA, roomB, and userId are required'
      });
    }

    if (roomA === roomB) {
      return res.status(400).json({
        success: false,
        error: 'Cannot connect room to itself'
      });
    }

    const result = await roomConnectionManager.connectRooms(roomA, roomB, userId, options);

    res.json({
      success: true,
      data: result,
      message: 'Rooms connected successfully'
    });

  } catch (error) {
    console.error('Room connection failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Room connection failed'
    });
  }
});

// Disconnect rooms
router.post('/disconnect', requireServices, async (req, res) => {
  try {
    const { sharedRoomId, userId } = req.body;

    if (!sharedRoomId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'sharedRoomId and userId are required'
      });
    }

    await roomConnectionManager.disconnectRooms(sharedRoomId);

    res.json({
      success: true,
      message: 'Rooms disconnected successfully'
    });

  } catch (error) {
    console.error('Room disconnection failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Room disconnection failed'
    });
  }
});

// Get connection status
router.get('/status/:roomId', requireServices, async (req, res) => {
  try {
    const { roomId } = req.params;
    const isConnected = roomConnectionManager.connectedRooms.has(roomId);
    
    if (isConnected) {
      const connectedRoom = roomConnectionManager.connectedRooms.get(roomId);
      const sharedRoomData = Array.from(roomConnectionManager.sharedRooms.values())
        .find(room => room.roomA === roomId || room.roomB === roomId);

      res.json({
        success: true,
        connected: true,
        connectedRoom,
        sharedRoomId: sharedRoomData?.id,
        participantCount: sharedRoomData?.participants?.all?.length || 0,
        status: sharedRoomData?.status
      });
    } else {
      res.json({
        success: true,
        connected: false
      });
    }

  } catch (error) {
    console.error('Connection status check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Status check failed'
    });
  }
});

// === DJ BATTLE ENDPOINTS ===

// Start DJ battle
router.post('/dj-battle/start', requireServices, async (req, res) => {
  try {
    const { sharedRoomId, options = {} } = req.body;

    if (!sharedRoomId) {
      return res.status(400).json({
        success: false,
        error: 'sharedRoomId is required'
      });
    }

    const result = await roomConnectionManager.startDjBattle(sharedRoomId, options);

    res.json({
      success: true,
      data: result,
      message: 'DJ Battle started successfully'
    });

  } catch (error) {
    console.error('DJ Battle start failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'DJ Battle start failed'
    });
  }
});

// Get DJ battle status
router.get('/dj-battle/status/:battleId', requireServices, async (req, res) => {
  try {
    const { battleId } = req.params;
    const battle = roomConnectionManager.djBattles.get(battleId);

    if (!battle) {
      return res.status(404).json({
        success: false,
        error: 'Battle not found'
      });
    }

    const elapsed = Date.now() - battle.createdAt.getTime();
    const remaining = Math.max(0, battle.duration - elapsed);

    res.json({
      success: true,
      battle: {
        id: battle.id,
        status: battle.status,
        duration: battle.duration,
        elapsed,
        remaining,
        roomA: battle.roomA,
        roomB: battle.roomB,
        currentTrack: battle.currentTrack,
        stats: battle.stats
      }
    });

  } catch (error) {
    console.error('Battle status check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Battle status check failed'
    });
  }
});

// Get DJ battle results
router.get('/dj-battle/results/:battleId', requireServices, async (req, res) => {
  try {
    const { battleId } = req.params;
    const battle = roomConnectionManager.djBattles.get(battleId);

    if (!battle) {
      return res.status(404).json({
        success: false,
        error: 'Battle not found'
      });
    }

    if (battle.status !== 'finished') {
      return res.status(400).json({
        success: false,
        error: 'Battle not yet finished'
      });
    }

    res.json({
      success: true,
      results: {
        battleId: battle.id,
        winner: battle.stats.winner,
        duration: battle.duration,
        roomA: {
          name: battle.roomA,
          engagement: battle.stats.engagementA,
          tracks: battle.tracks.roomA.length
        },
        roomB: {
          name: battle.roomB,
          engagement: battle.stats.engagementB,
          tracks: battle.tracks.roomB.length
        },
        moodMovement: battle.stats.moodMovement,
        finishedAt: battle.finishedAt
      }
    });

  } catch (error) {
    console.error('Battle results retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Battle results retrieval failed'
    });
  }
});

// === AMBIENT MATCHING ENDPOINTS ===

// Register room for ambient matching
router.post('/ambient/register', requireServices, async (req, res) => {
  try {
    const { roomId, options = {} } = req.body;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        error: 'roomId is required'
      });
    }

    const result = await ambientMatchingService.registerRoomForMatching(roomId, options);

    res.json({
      success: true,
      data: result,
      message: 'Room registered for ambient matching'
    });

  } catch (error) {
    console.error('Ambient registration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Ambient registration failed'
    });
  }
});

// Find ambient matches
router.get('/ambient/matches/:roomId', requireServices, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { threshold } = req.query;

    const customThreshold = threshold ? parseFloat(threshold) : null;
    const result = await ambientMatchingService.findMatches(roomId, customThreshold);

    res.json({
      success: true,
      data: result,
      message: `Found ${result.matches?.length || 0} potential matches`
    });

  } catch (error) {
    console.error('Match finding failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Match finding failed'
    });
  }
});

// Suggest connections to user
router.post('/ambient/suggest', requireServices, async (req, res) => {
  try {
    const { roomId, userId } = req.body;

    if (!roomId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'roomId and userId are required'
      });
    }

    const result = await ambientMatchingService.suggestConnections(roomId, userId);

    res.json({
      success: true,
      data: result,
      message: result.message || 'Suggestions generated'
    });

  } catch (error) {
    console.error('Connection suggestion failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Connection suggestion failed'
    });
  }
});

// Request connection to matched room
router.post('/ambient/request', requireServices, async (req, res) => {
  try {
    const { fromRoomId, toAnonymousId, userId, message = '' } = req.body;

    if (!fromRoomId || !toAnonymousId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'fromRoomId, toAnonymousId, and userId are required'
      });
    }

    const result = await ambientMatchingService.requestConnection(
      fromRoomId, 
      toAnonymousId, 
      userId, 
      message
    );

    res.json({
      success: true,
      data: result,
      message: 'Connection request sent'
    });

  } catch (error) {
    console.error('Connection request failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Connection request failed'
    });
  }
});

// Respond to connection request
router.post('/ambient/respond', requireServices, async (req, res) => {
  try {
    const { requestId, roomId, userId, response, message = '' } = req.body;

    if (!requestId || !roomId || !userId || !response) {
      return res.status(400).json({
        success: false,
        error: 'requestId, roomId, userId, and response are required'
      });
    }

    if (!['accepted', 'rejected'].includes(response)) {
      return res.status(400).json({
        success: false,
        error: 'response must be "accepted" or "rejected"'
      });
    }

    const result = await ambientMatchingService.respondToConnectionRequest(
      requestId, 
      roomId, 
      userId, 
      response, 
      message
    );

    res.json({
      success: true,
      data: result,
      message: `Connection request ${response}`
    });

  } catch (error) {
    console.error('Connection response failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Connection response failed'
    });
  }
});

// Update room mood for matching
router.post('/ambient/update-mood', requireServices, async (req, res) => {
  try {
    const { roomId, moodData } = req.body;

    if (!roomId || !moodData) {
      return res.status(400).json({
        success: false,
        error: 'roomId and moodData are required'
      });
    }

    const result = await ambientMatchingService.updateRoomMood(roomId, moodData);

    res.json({
      success: true,
      data: result,
      message: 'Room mood updated for matching'
    });

  } catch (error) {
    console.error('Mood update failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Mood update failed'
    });
  }
});

// Get ambient matching stats
router.get('/ambient/stats', requireServices, async (req, res) => {
  try {
    const stats = {
      activeRooms: ambientMatchingService.activeRooms.size,
      totalMatches: Array.from(ambientMatchingService.activeRooms.values())
        .reduce((total, room) => total + (room.lastMatches?.length || 0), 0),
      averageSimilarity: 0.75, // Calculate actual average
      matchingEnabled: Array.from(ambientMatchingService.activeRooms.values())
        .filter(room => room.allowMatching).length,
      recentConnections: 0 // Count recent connections
    };

    res.json({
      success: true,
      stats,
      message: 'Ambient matching statistics'
    });

  } catch (error) {
    console.error('Stats retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Stats retrieval failed'
    });
  }
});

// === UTILITY ENDPOINTS ===

// Health check for connection services
router.get('/health', (req, res) => {
  try {
    const health = {
      roomConnection: {
        active: roomConnectionManager !== null,
        connectedRooms: roomConnectionManager?.connectedRooms?.size || 0,
        sharedRooms: roomConnectionManager?.sharedRooms?.size || 0,
        activeBattles: roomConnectionManager?.djBattles?.size || 0
      },
      ambientMatching: {
        active: ambientMatchingService !== null,
        registeredRooms: ambientMatchingService?.activeRooms?.size || 0,
        matchingEnabled: Array.from(ambientMatchingService?.activeRooms?.values() || [])
          .filter(room => room.allowMatching).length
      },
      timestamp: new Date()
    };

    res.json({
      success: true,
      health,
      message: 'Connection services health check'
    });

  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Health check failed'
    });
  }
});

// Initialize services with socket.io instance
router.init = (io) => {
  initializeServices(io);
};

module.exports = router;
