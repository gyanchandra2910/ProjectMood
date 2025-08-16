// Room Memory Model for storing mood snapshots with context
// Includes mood vectors, playlists, chat snippets, and replay functionality

const mongoose = require('mongoose');

const memorySchema = new mongoose.Schema({
  memoryId: {
    type: String,
    required: true,
    unique: true
  },
  roomId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  // Mood vector data from MoodFusion
  moodVector: {
    valence: {
      type: Number,
      required: true,
      min: -1,
      max: 1
    },
    arousal: {
      type: Number,
      required: true,
      min: -1,
      max: 1
    }
  },
  fusedMood: {
    label: {
      type: String,
      required: true
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    source: {
      type: String,
      enum: ['single', 'fusion', 'default'],
      required: true
    },
    contributingMoods: [{
      mood: String,
      confidence: Number,
      weight: Number,
      source: String
    }]
  },
  // Generated playlist based on mood
  playlist: {
    title: {
      type: String,
      required: true
    },
    description: String,
    tracks: [{
      title: String,
      artist: String,
      genre: String,
      energy: Number, // 0-1 scale
      valence: Number, // 0-1 scale  
      danceability: Number, // 0-1 scale
      spotifyId: String,
      youtubeId: String,
      duration: Number // seconds
    }],
    totalDuration: Number, // seconds
    avgEnergy: Number,
    avgValence: Number
  },
  // Snapshot of recent chat messages
  chatSnippet: {
    messages: [{
      userId: String,
      displayName: String,
      text: String,
      timestamp: Date,
      mood: String
    }],
    participantCount: Number,
    dominantMoods: [String],
    avgSentiment: Number
  },
  // Participants at time of memory
  participants: [{
    userId: String,
    displayName: String,
    mood: String,
    moodSource: String,
    confidence: Number
  }],
  // Memory metadata
  metadata: {
    createdBy: String, // userId who triggered the memory
    trigger: {
      type: String,
      enum: ['manual', 'mood_consensus', 'time_interval', 'energy_peak'],
      default: 'manual'
    },
    roomName: String,
    tags: [String],
    isPublic: {
      type: Boolean,
      default: false
    },
    replayCount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
memorySchema.index({ roomId: 1, timestamp: -1 });
memorySchema.index({ 'moodVector.valence': 1, 'moodVector.arousal': 1 });
memorySchema.index({ 'metadata.trigger': 1 });

// Static method to find memories by room
memorySchema.statics.findByRoom = function(roomId, limit = 20) {
  return this.find({ roomId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Static method to find similar mood memories
memorySchema.statics.findSimilarMoods = function(targetVector, tolerance = 0.3, limit = 10) {
  return this.find({
    'moodVector.valence': {
      $gte: targetVector.valence - tolerance,
      $lte: targetVector.valence + tolerance
    },
    'moodVector.arousal': {
      $gte: targetVector.arousal - tolerance,
      $lte: targetVector.arousal + tolerance
    }
  })
  .sort({ timestamp: -1 })
  .limit(limit)
  .lean();
};

// Instance method to generate replay data
memorySchema.methods.getReplayData = function() {
  this.metadata.replayCount += 1;
  this.save();
  
  return {
    memoryId: this.memoryId,
    moodSeed: {
      vector: this.moodVector,
      label: this.fusedMood.label,
      confidence: this.fusedMood.confidence
    },
    playlist: this.playlist,
    visualizerSettings: {
      colorScheme: this.getColorScheme(),
      animation: this.getAnimationStyle(),
      intensity: Math.abs(this.moodVector.arousal),
      warmth: (this.moodVector.valence + 1) / 2 // Convert -1,1 to 0,1
    },
    context: {
      timestamp: this.timestamp,
      participantCount: this.participants.length,
      roomName: this.metadata.roomName,
      chatPreview: this.chatSnippet.messages.slice(0, 3)
    },
    replayCount: this.metadata.replayCount
  };
};

// Helper method to determine color scheme based on mood
memorySchema.methods.getColorScheme = function() {
  const { valence, arousal } = this.moodVector;
  
  // Quadrant-based color mapping
  if (valence > 0 && arousal > 0) {
    // High energy, positive: warm energetic colors
    return {
      primary: '#FF6B35', // Orange-red
      secondary: '#F7931E', // Orange
      accent: '#FFD23F', // Yellow
      name: 'energetic'
    };
  } else if (valence > 0 && arousal <= 0) {
    // Low energy, positive: calm warm colors
    return {
      primary: '#4ECDC4', // Teal
      secondary: '#44A08D', // Green-teal
      accent: '#96CEB4', // Light green
      name: 'peaceful'
    };
  } else if (valence <= 0 && arousal <= 0) {
    // Low energy, negative: muted cool colors
    return {
      primary: '#547980', // Dark teal
      secondary: '#45B7D1', // Blue
      accent: '#96B5B4', // Gray-blue
      name: 'melancholic'
    };
  } else {
    // High energy, negative: intense dark colors
    return {
      primary: '#E74C3C', // Red
      secondary: '#C0392B', // Dark red
      accent: '#F39C12', // Orange
      name: 'intense'
    };
  }
};

// Helper method to determine animation style
memorySchema.methods.getAnimationStyle = function() {
  const arousal = Math.abs(this.moodVector.arousal);
  const valence = this.moodVector.valence;
  
  if (arousal > 0.6) {
    return valence > 0 ? 'energetic_burst' : 'chaotic_storm';
  } else if (arousal > 0.3) {
    return valence > 0 ? 'gentle_waves' : 'slow_drift';
  } else {
    return 'minimal_pulse';
  }
};

// Pre-save middleware to generate memoryId
memorySchema.pre('save', function(next) {
  if (!this.memoryId) {
    this.memoryId = `memory_${this.roomId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

const RoomMemory = mongoose.model('RoomMemory', memorySchema);

module.exports = RoomMemory;
