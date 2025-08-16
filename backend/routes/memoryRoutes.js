// Room Memory Routes - Save and retrieve mood memories with context
// Includes playlist generation and replay functionality

const express = require('express');
const RoomMemory = require('../models/RoomMemory');
const Room = require('../models/Room');
const { fuseMoods, createMoodInput } = require('../utils/moodFusion');

const router = express.Router();

// Generate a mood-based playlist (mock implementation)
function generateMoodPlaylist(moodVector, fusedMood) {
  const { valence, arousal } = moodVector;
  const energy = (arousal + 1) / 2; // Convert -1,1 to 0,1
  const positivity = (valence + 1) / 2; // Convert -1,1 to 0,1
  
  // Mock playlist generation based on mood
  const playlistTemplates = {
    energetic: {
      title: "High Energy Vibes",
      description: "Upbeat tracks to match your energetic mood",
      tracks: [
        { title: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", genre: "Pop", energy: 0.9, valence: 0.8, danceability: 0.9 },
        { title: "Can't Stop the Feeling", artist: "Justin Timberlake", genre: "Pop", energy: 0.85, valence: 0.9, danceability: 0.8 },
        { title: "Good as Hell", artist: "Lizzo", genre: "Pop", energy: 0.8, valence: 0.85, danceability: 0.75 }
      ]
    },
    peaceful: {
      title: "Calm & Content",
      description: "Peaceful tracks for your relaxed state",
      tracks: [
        { title: "Weightless", artist: "Marconi Union", genre: "Ambient", energy: 0.1, valence: 0.6, danceability: 0.2 },
        { title: "Clair de Lune", artist: "Claude Debussy", genre: "Classical", energy: 0.2, valence: 0.7, danceability: 0.1 },
        { title: "River", artist: "Leon Bridges", genre: "Soul", energy: 0.3, valence: 0.6, danceability: 0.3 }
      ]
    },
    melancholic: {
      title: "Reflective Moments",
      description: "Contemplative music for introspective moods",
      tracks: [
        { title: "Mad World", artist: "Gary Jules", genre: "Alternative", energy: 0.2, valence: 0.3, danceability: 0.2 },
        { title: "The Night We Met", artist: "Lord Huron", genre: "Indie Folk", energy: 0.25, valence: 0.35, danceability: 0.25 },
        { title: "Hurt", artist: "Johnny Cash", genre: "Country", energy: 0.3, valence: 0.3, danceability: 0.2 }
      ]
    },
    intense: {
      title: "Intense Energy",
      description: "Powerful tracks for high-intensity emotions",
      tracks: [
        { title: "In the End", artist: "Linkin Park", genre: "Rock", energy: 0.8, valence: 0.4, danceability: 0.6 },
        { title: "The Pretender", artist: "Foo Fighters", genre: "Rock", energy: 0.85, valence: 0.45, danceability: 0.7 },
        { title: "Lose Yourself", artist: "Eminem", genre: "Hip Hop", energy: 0.9, valence: 0.5, danceability: 0.6 }
      ]
    }
  };
  
  // Select playlist template based on mood quadrant
  let templateKey = 'peaceful'; // default
  if (valence > 0 && arousal > 0) templateKey = 'energetic';
  else if (valence <= 0 && arousal > 0) templateKey = 'intense';
  else if (valence <= 0 && arousal <= 0) templateKey = 'melancholic';
  
  const template = playlistTemplates[templateKey];
  
  // Add some random variation and metadata
  const tracks = template.tracks.map(track => ({
    ...track,
    duration: 180 + Math.floor(Math.random() * 120), // 3-5 minutes
    spotifyId: `spotify_${Math.random().toString(36).substr(2, 9)}`,
    youtubeId: `youtube_${Math.random().toString(36).substr(2, 9)}`
  }));
  
  const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0);
  const avgEnergy = tracks.reduce((sum, track) => sum + track.energy, 0) / tracks.length;
  const avgValence = tracks.reduce((sum, track) => sum + track.valence, 0) / tracks.length;
  
  return {
    title: `${template.title} - ${fusedMood.label}`,
    description: `${template.description} (Generated for ${fusedMood.label} mood)`,
    tracks,
    totalDuration,
    avgEnergy: Math.round(avgEnergy * 100) / 100,
    avgValence: Math.round(avgValence * 100) / 100
  };
}

// Analyze recent chat messages for sentiment
function analyzeChatSnippet(messages) {
  if (!messages || messages.length === 0) {
    return {
      messages: [],
      participantCount: 0,
      dominantMoods: ['neutral'],
      avgSentiment: 0.5
    };
  }
  
  const recentMessages = messages.slice(-10); // Last 10 messages
  const moodCounts = {};
  let totalSentiment = 0;
  
  recentMessages.forEach(msg => {
    // Simple sentiment analysis based on keywords
    const text = msg.text.toLowerCase();
    let sentiment = 0.5; // neutral
    
    // Positive keywords
    if (text.match(/\b(good|great|awesome|love|happy|excited|amazing|perfect|wonderful)\b/)) {
      sentiment = 0.8;
    }
    // Negative keywords
    else if (text.match(/\b(bad|terrible|hate|sad|angry|awful|horrible|disappointed)\b/)) {
      sentiment = 0.2;
    }
    
    totalSentiment += sentiment;
    
    // Count moods if available
    if (msg.mood) {
      moodCounts[msg.mood] = (moodCounts[msg.mood] || 0) + 1;
    }
  });
  
  const dominantMoods = Object.entries(moodCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([mood]) => mood);
  
  const uniqueParticipants = new Set(recentMessages.map(msg => msg.userId)).size;
  
  return {
    messages: recentMessages.map(msg => ({
      userId: msg.userId,
      displayName: msg.displayName,
      text: msg.text,
      timestamp: msg.timestamp,
      mood: msg.mood || 'neutral'
    })),
    participantCount: uniqueParticipants,
    dominantMoods: dominantMoods.length > 0 ? dominantMoods : ['neutral'],
    avgSentiment: Math.round((totalSentiment / recentMessages.length) * 100) / 100
  };
}

// POST /api/rooms/:roomId/memory - Save current room state as memory
router.post('/:roomId/memory', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { trigger = 'manual', tags = [] } = req.body;
    const userId = req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Get current room state
    const room = await Room.findByRoomId(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Collect mood inputs from current participants
    const moodInputs = room.participants
      .filter(p => p.isOnline && p.mood)
      .map(p => createMoodInput(
        p.mood, 
        p.confidence || 0.8, 
        1.0, 
        p.moodSource || 'manual'
      ));
    
    if (moodInputs.length === 0) {
      return res.status(400).json({ 
        error: 'No mood data available',
        details: 'At least one participant must have a mood set to create a memory'
      });
    }
    
    // Fuse moods using MoodFusion
    const fusedMood = fuseMoods(moodInputs);
    
    // Generate playlist based on fused mood
    const playlist = generateMoodPlaylist(fusedMood.vector, fusedMood);
    
    // Analyze recent chat messages
    const chatSnippet = analyzeChatSnippet(room.messages);
    
    // Create memory document
    const memory = new RoomMemory({
      roomId,
      moodVector: fusedMood.vector,
      fusedMood: {
        label: fusedMood.label,
        confidence: fusedMood.confidence,
        source: fusedMood.source,
        contributingMoods: fusedMood.contributingMoods || []
      },
      playlist,
      chatSnippet,
      participants: room.participants.map(p => ({
        userId: p.userId,
        displayName: p.displayName,
        mood: p.mood || 'neutral',
        moodSource: p.moodSource || 'manual',
        confidence: p.confidence || 1.0
      })),
      metadata: {
        createdBy: userId,
        trigger,
        roomName: room.name,
        tags,
        isPublic: false // Default to private
      }
    });
    
    await memory.save();
    
    console.log(`Memory created for room ${roomId} by user ${userId}`);
    
    res.status(201).json({
      success: true,
      memory: {
        memoryId: memory.memoryId,
        timestamp: memory.timestamp,
        moodVector: memory.moodVector,
        fusedMood: memory.fusedMood,
        playlist: {
          title: memory.playlist.title,
          trackCount: memory.playlist.tracks.length,
          duration: memory.playlist.totalDuration
        },
        participantCount: memory.participants.length,
        trigger: memory.metadata.trigger
      }
    });
    
  } catch (error) {
    console.error('Error creating room memory:', error);
    res.status(500).json({
      error: 'Failed to create memory',
      details: error.message
    });
  }
});

// GET /api/rooms/:roomId/memories - Get room memories
router.get('/:roomId/memories', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 20, offset = 0, moodFilter } = req.query;
    const userId = req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Verify user has access to this room
    const room = await Room.findByRoomId(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Build query
    let query = { roomId };
    
    // Add mood filter if specified
    if (moodFilter) {
      query['fusedMood.label'] = new RegExp(moodFilter, 'i');
    }
    
    // Get memories
    const memories = await RoomMemory.find(query)
      .sort({ timestamp: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();
    
    // Get total count for pagination
    const totalCount = await RoomMemory.countDocuments(query);
    
    // Format response
    const formattedMemories = memories.map(memory => ({
      memoryId: memory.memoryId,
      timestamp: memory.timestamp,
      moodVector: memory.moodVector,
      fusedMood: memory.fusedMood,
      playlist: {
        title: memory.playlist.title,
        description: memory.playlist.description,
        trackCount: memory.playlist.tracks.length,
        totalDuration: memory.playlist.totalDuration,
        avgEnergy: memory.playlist.avgEnergy,
        avgValence: memory.playlist.avgValence
      },
      participantCount: memory.participants.length,
      chatPreview: memory.chatSnippet.messages.slice(0, 2),
      metadata: {
        trigger: memory.metadata.trigger,
        tags: memory.metadata.tags,
        replayCount: memory.metadata.replayCount
      }
    }));
    
    res.json({
      success: true,
      memories: formattedMemories,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
      },
      roomInfo: {
        roomId,
        name: room.name,
        currentParticipants: room.participants.filter(p => p.isOnline).length
      }
    });
    
  } catch (error) {
    console.error('Error retrieving memories:', error);
    res.status(500).json({
      error: 'Failed to retrieve memories',
      details: error.message
    });
  }
});

// GET /api/rooms/:roomId/memories/:memoryId/replay - Get replay data for memory
router.get('/:roomId/memories/:memoryId/replay', async (req, res) => {
  try {
    const { roomId, memoryId } = req.params;
    const userId = req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Find the memory
    const memory = await RoomMemory.findOne({ roomId, memoryId });
    if (!memory) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    
    // Get replay data (this increments replay count)
    const replayData = memory.getReplayData();
    
    res.json({
      success: true,
      replay: replayData
    });
    
  } catch (error) {
    console.error('Error getting replay data:', error);
    res.status(500).json({
      error: 'Failed to get replay data',
      details: error.message
    });
  }
});

// GET /api/rooms/:roomId/memories/similar - Find memories with similar mood vectors
router.get('/:roomId/memories/similar', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { valence, arousal, tolerance = 0.3, limit = 10 } = req.query;
    const userId = req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!valence || !arousal) {
      return res.status(400).json({ 
        error: 'Valence and arousal parameters required',
        details: 'Provide valence and arousal values between -1 and 1'
      });
    }
    
    const targetVector = {
      valence: parseFloat(valence),
      arousal: parseFloat(arousal)
    };
    
    // Find similar memories
    const similarMemories = await RoomMemory.findSimilarMoods(
      targetVector, 
      parseFloat(tolerance), 
      parseInt(limit)
    );
    
    // Filter to only this room or make it optional
    const roomMemories = similarMemories.filter(memory => memory.roomId === roomId);
    
    res.json({
      success: true,
      targetVector,
      tolerance: parseFloat(tolerance),
      similarMemories: roomMemories.map(memory => ({
        memoryId: memory.memoryId,
        roomId: memory.roomId,
        timestamp: memory.timestamp,
        moodVector: memory.moodVector,
        fusedMood: memory.fusedMood,
        similarity: calculateSimilarity(targetVector, memory.moodVector),
        playlist: {
          title: memory.playlist.title,
          trackCount: memory.playlist.tracks.length
        }
      }))
    });
    
  } catch (error) {
    console.error('Error finding similar memories:', error);
    res.status(500).json({
      error: 'Failed to find similar memories',
      details: error.message
    });
  }
});

// Helper function to calculate similarity between vectors
function calculateSimilarity(vector1, vector2) {
  const distance = Math.sqrt(
    Math.pow(vector1.valence - vector2.valence, 2) + 
    Math.pow(vector1.arousal - vector2.arousal, 2)
  );
  // Convert distance to similarity (0-1, where 1 is identical)
  return Math.max(0, 1 - (distance / Math.sqrt(8))); // sqrt(8) is max possible distance
}

module.exports = router;
