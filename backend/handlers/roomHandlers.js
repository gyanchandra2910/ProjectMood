// Socket.IO room handlers for room management, mood tracking, and messaging
// Handles createRoom, joinRoom, leaveRoom, updateMood, and chat functionality

const Room = require('../models/Room');
const { v4: uuidv4 } = require('uuid');

// Generate unique room ID
const generateRoomId = () => {
  return uuidv4().slice(0, 8).toUpperCase();
};

// Generate unique message ID
const generateMessageId = () => {
  return uuidv4();
};

// Create a new room
const handleCreateRoom = async (socket, data) => {
  try {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required to create rooms' });
      return;
    }

    const { name, description = '' } = data;
    
    if (!name || name.trim().length === 0) {
      socket.emit('error', { message: 'Room name is required' });
      return;
    }

    const roomId = generateRoomId();
    
    // Create new room in database
    const room = new Room({
      roomId,
      name: name.trim(),
      description: description.trim(),
      createdBy: socket.user.uid,
      participants: [{
        userId: socket.user.uid,
        displayName: socket.user.displayName,
        email: socket.user.email,
        photoURL: socket.user.photoURL || '',
        mood: '😊',
        joinedAt: new Date(),
        lastSeen: new Date(),
        isOnline: true
      }]
    });

    await room.save();

    // Join the socket to the room
    socket.join(roomId);
    socket.currentRoom = roomId;

    console.log(`Room created: ${roomId} by ${socket.user.email}`);

    // Emit success to creator
    socket.emit('room:created', {
      roomId,
      name: room.name,
      description: room.description,
      participants: room.participants,
      messages: []
    });

    // Broadcast room update
    socket.to(roomId).emit('room:update', {
      roomId,
      participants: room.participants,
      messages: room.getRecentMessages()
    });

  } catch (error) {
    console.error('Error creating room:', error);
    socket.emit('error', { message: 'Failed to create room' });
  }
};

// Join an existing room
const handleJoinRoom = async (socket, data) => {
  try {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required to join rooms' });
      return;
    }

    const { roomId } = data;
    
    if (!roomId) {
      socket.emit('error', { message: 'Room ID is required' });
      return;
    }

    // Find the room
    const room = await Room.findByRoomId(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Check if room is full
    const onlineParticipants = room.getOnlineParticipants();
    if (onlineParticipants.length >= room.maxParticipants) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    // Add participant to room
    await room.addParticipant({
      userId: socket.user.uid,
      displayName: socket.user.displayName,
      email: socket.user.email,
      photoURL: socket.user.photoURL || '',
      mood: '😊'
    });

    // Join the socket to the room
    socket.join(roomId);
    socket.currentRoom = roomId;

    console.log(`User ${socket.user.email} joined room: ${roomId}`);

    // Emit success to user
    socket.emit('room:joined', {
      roomId,
      name: room.name,
      description: room.description,
      participants: room.participants.filter(p => p.isOnline),
      messages: room.getRecentMessages()
    });

    // Broadcast to other participants
    socket.to(roomId).emit('room:update', {
      roomId,
      participants: room.participants.filter(p => p.isOnline),
      messages: room.getRecentMessages()
    });

    // Send system message
    const systemMessage = {
      messageId: generateMessageId(),
      type: 'system',
      message: `${socket.user.displayName} joined the room`,
      timestamp: new Date()
    };

    socket.to(roomId).emit('message:received', systemMessage);

  } catch (error) {
    console.error('Error joining room:', error);
    socket.emit('error', { message: 'Failed to join room' });
  }
};

// Leave a room
const handleLeaveRoom = async (socket, data) => {
  try {
    const { roomId } = data || {};
    const targetRoomId = roomId || socket.currentRoom;
    
    if (!targetRoomId) {
      return;
    }

    if (socket.isAuthenticated) {
      // Find and update room
      const room = await Room.findByRoomId(targetRoomId);
      
      if (room) {
        await room.removeParticipant(socket.user.uid);
        
        console.log(`User ${socket.user.email} left room: ${targetRoomId}`);
        
        // Broadcast to other participants
        socket.to(targetRoomId).emit('room:update', {
          roomId: targetRoomId,
          participants: room.participants.filter(p => p.isOnline),
          messages: room.getRecentMessages()
        });

        // Send system message
        const systemMessage = {
          messageId: generateMessageId(),
          type: 'system',
          message: `${socket.user.displayName} left the room`,
          timestamp: new Date()
        };

        socket.to(targetRoomId).emit('message:received', systemMessage);
      }
    }

    // Leave the socket room
    socket.leave(targetRoomId);
    socket.currentRoom = null;

    socket.emit('room:left', { roomId: targetRoomId });

  } catch (error) {
    console.error('Error leaving room:', error);
    socket.emit('error', { message: 'Failed to leave room' });
  }
};

// Update user mood in room
const handleUpdateMood = async (socket, data) => {
  try {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required to update mood' });
      return;
    }

    const { roomId, mood, moodSource = 'manual', confidence = 1.0 } = data;
    
    if (!roomId || !mood) {
      socket.emit('error', { message: 'Room ID and mood are required' });
      return;
    }

    const validMoods = ['😊', '😢', '😠', '😴', '🤔', '😍', '🤯', '🎉', 'happy', 'sad', 'angry', 'sleepy', 'thoughtful', 'excited', 'surprised', 'calm', 'neutral'];
    const validSources = ['manual', 'voice', 'face'];
    
    if (!validMoods.includes(mood)) {
      socket.emit('error', { message: 'Invalid mood' });
      return;
    }

    if (!validSources.includes(moodSource)) {
      socket.emit('error', { message: 'Invalid mood source' });
      return;
    }

    // Find and update room
    const room = await Room.findByRoomId(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    await room.updateParticipantMood(socket.user.uid, mood, moodSource, confidence);

    console.log(`User ${socket.user.email} updated mood to ${mood} (${moodSource}, ${Math.round(confidence * 100)}%) in room: ${roomId}`);

    // Broadcast mood update to all participants
    const updatedParticipant = room.participants.find(p => p.userId === socket.user.uid);
    
    socket.to(roomId).emit('participantMoodUpdated', {
      userId: socket.user.uid,
      mood,
      moodSource,
      confidence,
      timestamp: new Date().toISOString()
    });

    socket.emit('mood:updated', { 
      roomId, 
      mood, 
      moodSource, 
      confidence,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating mood:', error);
    socket.emit('error', { message: 'Failed to update mood' });
  }
};

// Send message to room
const handleSendMessage = async (socket, data) => {
  try {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required to send messages' });
      return;
    }

    const { roomId, message } = data;
    
    if (!roomId || !message || message.trim().length === 0) {
      socket.emit('error', { message: 'Room ID and message are required' });
      return;
    }

    if (message.length > 1000) {
      socket.emit('error', { message: 'Message too long (max 1000 characters)' });
      return;
    }

    // Find room
    const room = await Room.findByRoomId(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Check if user is in room
    const participant = room.participants.find(p => p.userId === socket.user.uid && p.isOnline);
    if (!participant) {
      socket.emit('error', { message: 'You are not in this room' });
      return;
    }

    const messageData = {
      messageId: generateMessageId(),
      userId: socket.user.uid,
      displayName: socket.user.displayName,
      message: message.trim(),
      timestamp: new Date()
    };

    // Save message to room
    await room.addMessage(messageData);

    console.log(`Message sent in room ${roomId} by ${socket.user.email}`);

    // Broadcast message to all participants
    const messageToSend = {
      ...messageData,
      type: 'user',
      user: {
        userId: socket.user.uid,
        displayName: socket.user.displayName,
        photoURL: socket.user.photoURL || ''
      }
    };

    // Send to room participants (including sender)
    socket.to(roomId).emit('message:received', messageToSend);
    socket.emit('message:sent', messageToSend);

  } catch (error) {
    console.error('Error sending message:', error);
    socket.emit('error', { message: 'Failed to send message' });
  }
};

// Get room list
const handleGetRooms = async (socket) => {
  try {
    const rooms = await Room.findActiveRooms();
    
    const roomList = rooms.map(room => ({
      roomId: room.roomId,
      name: room.name,
      description: room.description,
      participantCount: room.participants ? room.participants.filter(p => p.isOnline).length : 0,
      lastActivity: room.lastActivity
    }));

    socket.emit('rooms:list', roomList);

  } catch (error) {
    console.error('Error getting rooms:', error);
    socket.emit('error', { message: 'Failed to get room list' });
  }
};

// Handle disconnect
const handleDisconnect = async (socket, reason) => {
  try {
    if (socket.currentRoom && socket.isAuthenticated) {
      await handleLeaveRoom(socket, { roomId: socket.currentRoom });
    }
    
    console.log(`Client disconnected: ${socket.id}, Reason: ${reason}`);
    if (socket.isAuthenticated) {
      console.log(`User disconnected: ${socket.user.email}`);
    }
  } catch (error) {
    console.error('Error handling disconnect:', error);
  }
};

module.exports = {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handleUpdateMood,
  handleSendMessage,
  handleGetRooms,
  handleDisconnect
};
