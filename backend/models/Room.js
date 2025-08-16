// MongoDB Room model for persisting room data and participants
// Stores room information, participants, and their current moods

const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  photoURL: {
    type: String,
    default: ''
  },
  mood: {
    type: String,
    enum: ['😊', '😢', '😠', '😴', '🤔', '😍', '🤯', '🎉', 'happy', 'sad', 'angry', 'sleepy', 'thoughtful', 'excited', 'surprised', 'calm', 'neutral'],
    default: '😊'
  },
  moodSource: {
    type: String,
    enum: ['manual', 'voice', 'face'],
    default: 'manual'
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 1.0
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isOnline: {
    type: Boolean,
    default: true
  }
});

const messageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  }
});

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500,
    default: ''
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  participants: [participantSchema],
  messages: [messageSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  maxParticipants: {
    type: Number,
    default: 50
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
roomSchema.index({ roomId: 1 });
roomSchema.index({ createdBy: 1 });
roomSchema.index({ 'participants.userId': 1 });
roomSchema.index({ lastActivity: -1 });

// Methods
roomSchema.methods.addParticipant = function(participant) {
  const existingParticipant = this.participants.find(p => p.userId === participant.userId);
  
  if (!existingParticipant) {
    this.participants.push(participant);
  } else {
    // Update existing participant
    existingParticipant.isOnline = true;
    existingParticipant.lastSeen = new Date();
    existingParticipant.displayName = participant.displayName;
    existingParticipant.email = participant.email;
    existingParticipant.photoURL = participant.photoURL;
  }
  
  this.lastActivity = new Date();
  return this.save();
};

roomSchema.methods.removeParticipant = function(userId) {
  const participant = this.participants.find(p => p.userId === userId);
  if (participant) {
    participant.isOnline = false;
    participant.lastSeen = new Date();
  }
  
  this.lastActivity = new Date();
  return this.save();
};

roomSchema.methods.updateParticipantMood = function(userId, mood, moodSource = 'manual', confidence = 1.0) {
  const participant = this.participants.find(p => p.userId === userId);
  if (participant) {
    participant.mood = mood;
    participant.moodSource = moodSource;
    participant.confidence = confidence;
    participant.lastSeen = new Date();
  }
  
  this.lastActivity = new Date();
  return this.save();
};

roomSchema.methods.addMessage = function(messageData) {
  this.messages.push({
    messageId: messageData.messageId,
    userId: messageData.userId,
    displayName: messageData.displayName,
    message: messageData.message,
    timestamp: new Date()
  });
  
  // Keep only last 100 messages to prevent document size issues
  if (this.messages.length > 100) {
    this.messages = this.messages.slice(-100);
  }
  
  this.lastActivity = new Date();
  return this.save();
};

roomSchema.methods.getOnlineParticipants = function() {
  return this.participants.filter(p => p.isOnline);
};

roomSchema.methods.getRecentMessages = function(limit = 50) {
  return this.messages
    .slice(-limit)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

// Static methods
roomSchema.statics.findByRoomId = function(roomId) {
  return this.findOne({ roomId, isActive: true });
};

roomSchema.statics.findActiveRooms = function() {
  return this.find({ isActive: true })
    .select('roomId name description createdBy createdAt participants.length lastActivity')
    .sort({ lastActivity: -1 });
};

roomSchema.statics.findUserRooms = function(userId) {
  return this.find({
    'participants.userId': userId,
    'participants.isOnline': true,
    isActive: true
  }).select('roomId name description lastActivity participants');
};

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;
