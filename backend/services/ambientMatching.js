// Ambient Room Matching Service
// Finds rooms with similar mood vectors and suggests connections
// Ensures privacy, opt-in consent, and anonymized discovery

const { cosineSimilarity, vectorToMoodLabel } = require('../utils/moodFusion');
const RoomMemory = require('../models/RoomMemory');

class AmbientMatchingService {
  constructor(io) {
    this.io = io;
    this.activeRooms = new Map(); // roomId -> room data
    this.matchingQueue = new Map(); // userId -> matching preferences
    this.similarityThreshold = 0.75; // Cosine similarity threshold
    this.matchingInterval = 30000; // Check for matches every 30 seconds
    this.anonymousProfiles = new Map(); // roomId -> anonymous profile
    
    // Start background matching process
    this.startMatchingService();
  }

  // Register room for ambient matching
  async registerRoomForMatching(roomId, options = {}) {
    try {
      const roomData = await this.getRoomData(roomId);
      if (!roomData || !roomData.mood) {
        throw new Error('Room data or mood not available');
      }

      // Create anonymous profile for privacy
      const anonymousProfile = this.createAnonymousProfile(roomData);
      
      const matchingProfile = {
        roomId,
        fusedMoodVector: roomData.mood.vector,
        fusedMoodLabel: roomData.mood.label,
        participantCount: roomData.participants?.length || 0,
        isPublic: options.isPublic || false,
        allowMatching: options.allowMatching || false,
        preferredSimilarity: options.preferredSimilarity || this.similarityThreshold,
        maxRoomSize: options.maxRoomSize || 50,
        minRoomSize: options.minRoomSize || 2,
        anonymousProfile,
        tags: options.tags || [],
        language: options.language || 'en',
        region: options.region || 'global',
        createdAt: new Date(),
        lastUpdated: new Date(),
        matchHistory: []
      };

      this.activeRooms.set(roomId, matchingProfile);
      
      // If auto-matching enabled, start looking for matches
      if (options.allowMatching) {
        setTimeout(() => this.findMatches(roomId), 5000);
      }

      return {
        success: true,
        anonymousId: anonymousProfile.id,
        mood: roomData.mood.label,
        matchingEnabled: options.allowMatching
      };

    } catch (error) {
      console.error('Room registration for matching failed:', error);
      throw error;
    }
  }

  // Find similar rooms based on mood vectors
  async findMatches(roomId, customThreshold = null) {
    try {
      const sourceRoom = this.activeRooms.get(roomId);
      if (!sourceRoom || !sourceRoom.allowMatching) {
        return { matches: [] };
      }

      const threshold = customThreshold || sourceRoom.preferredSimilarity;
      const matches = [];

      // Compare with all other active rooms
      for (const [candidateRoomId, candidateRoom] of this.activeRooms) {
        if (candidateRoomId === roomId || !candidateRoom.allowMatching) {
          continue;
        }

        // Check basic compatibility
        if (!this.isCompatible(sourceRoom, candidateRoom)) {
          continue;
        }

        // Calculate mood similarity
        const similarity = cosineSimilarity(
          sourceRoom.fusedMoodVector,
          candidateRoom.fusedMoodVector
        );

        if (similarity >= threshold) {
          // Create anonymous match info
          const matchInfo = {
            anonymousId: candidateRoom.anonymousProfile.id,
            similarity: parseFloat(similarity.toFixed(3)),
            moodLabel: candidateRoom.fusedMoodLabel,
            participantCount: candidateRoom.participantCount,
            compatibilityScore: this.calculateCompatibility(sourceRoom, candidateRoom),
            tags: candidateRoom.tags,
            estimatedMoodBlend: this.estimateMoodBlend(sourceRoom, candidateRoom),
            region: candidateRoom.region,
            language: candidateRoom.language,
            lastActive: candidateRoom.lastUpdated
          };

          matches.push(matchInfo);
        }
      }

      // Sort by similarity and compatibility
      matches.sort((a, b) => {
        const scoreA = (a.similarity * 0.7) + (a.compatibilityScore * 0.3);
        const scoreB = (b.similarity * 0.7) + (b.compatibilityScore * 0.3);
        return scoreB - scoreA;
      });

      // Limit to top 5 matches
      const topMatches = matches.slice(0, 5);

      // Store match results
      sourceRoom.lastMatchSearch = new Date();
      sourceRoom.lastMatches = topMatches;

      return {
        success: true,
        matches: topMatches,
        searchedRooms: this.activeRooms.size - 1,
        threshold: threshold
      };

    } catch (error) {
      console.error('Match finding failed:', error);
      return { matches: [], error: error.message };
    }
  }

  // Suggest connections to room participants
  async suggestConnections(roomId, userId) {
    try {
      const matches = await this.findMatches(roomId);
      
      if (matches.matches.length === 0) {
        return {
          success: true,
          suggestions: [],
          message: 'No similar rooms found at the moment. Check back later!'
        };
      }

      // Create user-friendly suggestions
      const suggestions = matches.matches.map((match, index) => ({
        id: match.anonymousId,
        rank: index + 1,
        mood: match.moodLabel,
        similarity: `${(match.similarity * 100).toFixed(1)}%`,
        participants: match.participantCount,
        compatibility: this.getCompatibilityDescription(match.compatibilityScore),
        estimatedBlend: match.estimatedMoodBlend,
        tags: match.tags,
        reason: this.generateMatchReason(match),
        region: match.region,
        language: match.language
      }));

      // Emit suggestions to requesting user
      this.io.to(userId).emit('ambient-matches-found', {
        roomId,
        suggestions,
        totalFound: suggestions.length,
        searchTime: new Date(),
        message: `Found ${suggestions.length} compatible rooms with similar mood!`
      });

      return {
        success: true,
        suggestions,
        count: suggestions.length
      };

    } catch (error) {
      console.error('Connection suggestion failed:', error);
      throw error;
    }
  }

  // Request connection to a matched room
  async requestConnection(fromRoomId, toAnonymousId, userId, message = '') {
    try {
      // Find the target room by anonymous ID
      const targetRoom = this.findRoomByAnonymousId(toAnonymousId);
      if (!targetRoom) {
        throw new Error('Target room not found or no longer available');
      }

      const sourceRoom = this.activeRooms.get(fromRoomId);
      if (!sourceRoom) {
        throw new Error('Source room not found');
      }

      // Create connection request
      const requestId = `conn_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const connectionRequest = {
        id: requestId,
        fromRoomId,
        toRoomId: targetRoom.roomId,
        fromAnonymousId: sourceRoom.anonymousProfile.id,
        toAnonymousId,
        requestedBy: userId,
        message: message.substring(0, 200), // Limit message length
        similarity: cosineSimilarity(sourceRoom.fusedMoodVector, targetRoom.fusedMoodVector),
        estimatedBlend: this.estimateMoodBlend(sourceRoom, targetRoom),
        createdAt: new Date(),
        status: 'pending',
        expiresAt: new Date(Date.now() + 300000) // 5 minutes
      };

      // Send anonymous connection request to target room
      this.io.to(targetRoom.roomId).emit('connection-request-received', {
        requestId,
        fromAnonymousId: sourceRoom.anonymousProfile.id,
        fromMood: sourceRoom.fusedMoodLabel,
        fromParticipants: sourceRoom.participantCount,
        similarity: `${(connectionRequest.similarity * 100).toFixed(1)}%`,
        estimatedBlend: connectionRequest.estimatedBlend,
        message: connectionRequest.message,
        requestTime: connectionRequest.createdAt,
        expiresIn: 300, // seconds
        anonymousProfile: {
          mood: sourceRoom.fusedMoodLabel,
          energy: this.getMoodEnergy(sourceRoom.fusedMoodVector),
          vibe: this.getMoodVibe(sourceRoom.fusedMoodVector),
          tags: sourceRoom.tags
        }
      });

      // Confirm to requester
      this.io.to(fromRoomId).emit('connection-request-sent', {
        requestId,
        targetMood: targetRoom.fusedMoodLabel,
        similarity: `${(connectionRequest.similarity * 100).toFixed(1)}%`,
        message: 'Connection request sent! Waiting for response...'
      });

      // Store request for tracking
      this.storeConnectionRequest(connectionRequest);

      // Auto-expire request
      setTimeout(() => {
        this.expireConnectionRequest(requestId);
      }, 300000);

      return {
        success: true,
        requestId,
        similarity: connectionRequest.similarity,
        expiresAt: connectionRequest.expiresAt
      };

    } catch (error) {
      console.error('Connection request failed:', error);
      throw error;
    }
  }

  // Accept or reject connection request
  async respondToConnectionRequest(requestId, roomId, userId, response, message = '') {
    try {
      const request = await this.getConnectionRequest(requestId);
      if (!request || request.toRoomId !== roomId) {
        throw new Error('Connection request not found or invalid');
      }

      if (request.status !== 'pending') {
        throw new Error('Request already processed');
      }

      if (Date.now() > request.expiresAt.getTime()) {
        throw new Error('Request has expired');
      }

      // Update request status
      request.status = response; // 'accepted' or 'rejected'
      request.respondedBy = userId;
      request.respondedAt = new Date();
      request.responseMessage = message.substring(0, 200);

      if (response === 'accepted') {
        // Initiate room connection
        const RoomConnectionManager = require('./roomConnection').RoomConnectionManager;
        const connectionManager = new RoomConnectionManager(this.io);
        
        const connectionResult = await connectionManager.connectRooms(
          request.fromRoomId,
          request.toRoomId,
          userId,
          {
            allowCrossChat: true,
            sharePlaylist: true,
            blendMoods: true,
            duration: 1800000, // 30 minutes
            reason: 'ambient_match'
          }
        );

        // Notify both rooms
        this.io.to(request.fromRoomId).emit('connection-request-accepted', {
          requestId,
          sharedRoomId: connectionResult.sharedRoomId,
          message: `Connection accepted! Rooms are now connected.`,
          responseMessage: request.responseMessage
        });

        this.io.to(request.toRoomId).emit('connection-established', {
          requestId,
          sharedRoomId: connectionResult.sharedRoomId,
          message: `Successfully connected to another room!`
        });

        // Update room matching profiles
        this.updateMatchHistory(request.fromRoomId, request.toRoomId, 'connected');
        this.updateMatchHistory(request.toRoomId, request.fromRoomId, 'connected');

      } else {
        // Notify requester of rejection
        this.io.to(request.fromRoomId).emit('connection-request-rejected', {
          requestId,
          message: 'Connection request was declined.',
          responseMessage: request.responseMessage
        });
      }

      return {
        success: true,
        response,
        requestId
      };

    } catch (error) {
      console.error('Connection response failed:', error);
      throw error;
    }
  }

  // Update room mood and refresh matching profile
  async updateRoomMood(roomId, newMoodData) {
    try {
      const room = this.activeRooms.get(roomId);
      if (!room) {
        return { success: false, message: 'Room not registered for matching' };
      }

      // Update mood data
      room.fusedMoodVector = newMoodData.vector;
      room.fusedMoodLabel = newMoodData.label;
      room.lastUpdated = new Date();

      // Clear previous matches since mood changed
      room.lastMatches = [];

      // If room allows matching, find new matches
      if (room.allowMatching) {
        setTimeout(() => {
          this.findMatches(roomId).then(matches => {
            if (matches.matches.length > 0) {
              this.io.to(roomId).emit('new-matches-available', {
                count: matches.matches.length,
                message: 'Your mood updated! New room matches available.'
              });
            }
          });
        }, 2000);
      }

      return {
        success: true,
        newMood: newMoodData.label,
        matchingEnabled: room.allowMatching
      };

    } catch (error) {
      console.error('Room mood update failed:', error);
      throw error;
    }
  }

  // Start background matching service
  startMatchingService() {
    setInterval(() => {
      this.performBackgroundMatching();
    }, this.matchingInterval);

    // Clean up expired rooms
    setInterval(() => {
      this.cleanupExpiredRooms();
    }, 60000); // Every minute
  }

  // Perform background matching for all active rooms
  async performBackgroundMatching() {
    try {
      const roomsToMatch = Array.from(this.activeRooms.keys())
        .filter(roomId => {
          const room = this.activeRooms.get(roomId);
          return room.allowMatching && 
                 (!room.lastMatchSearch || 
                  Date.now() - room.lastMatchSearch.getTime() > this.matchingInterval);
        });

      for (const roomId of roomsToMatch) {
        try {
          const matches = await this.findMatches(roomId);
          
          // Notify room if new high-quality matches found
          if (matches.matches && matches.matches.length > 0) {
            const topMatch = matches.matches[0];
            if (topMatch.similarity >= 0.85) { // Very high similarity
              this.io.to(roomId).emit('high-quality-match-found', {
                match: {
                  similarity: `${(topMatch.similarity * 100).toFixed(1)}%`,
                  mood: topMatch.moodLabel,
                  participants: topMatch.participantCount,
                  anonymousId: topMatch.anonymousId
                },
                message: '🎯 Found a perfect mood match! Check suggestions.'
              });
            }
          }
        } catch (error) {
          console.error(`Background matching failed for room ${roomId}:`, error);
        }
      }
    } catch (error) {
      console.error('Background matching service error:', error);
    }
  }

  // Clean up expired rooms and requests
  cleanupExpiredRooms() {
    const now = Date.now();
    const expiredThreshold = 3600000; // 1 hour

    for (const [roomId, room] of this.activeRooms) {
      if (now - room.lastUpdated.getTime() > expiredThreshold) {
        this.activeRooms.delete(roomId);
        this.anonymousProfiles.delete(roomId);
      }
    }
  }

  // Utility methods
  createAnonymousProfile(roomData) {
    const anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const profile = {
      id: anonymousId,
      mood: roomData.mood.label,
      energy: this.getMoodEnergy(roomData.mood.vector),
      vibe: this.getMoodVibe(roomData.mood.vector),
      size: this.getRoomSizeCategory(roomData.participants?.length || 0),
      createdAt: new Date()
    };

    this.anonymousProfiles.set(roomData.id, profile);
    return profile;
  }

  isCompatible(roomA, roomB) {
    // Check participant count compatibility
    if (roomB.participantCount < roomA.minRoomSize || 
        roomB.participantCount > roomA.maxRoomSize) {
      return false;
    }

    // Check if already connected recently
    const recentConnection = roomA.matchHistory.find(h => 
      h.roomId === roomB.roomId && 
      Date.now() - h.timestamp.getTime() < 3600000 // 1 hour
    );
    
    if (recentConnection) {
      return false;
    }

    // Check language compatibility
    if (roomA.language !== 'global' && roomB.language !== 'global' && 
        roomA.language !== roomB.language) {
      return false;
    }

    return true;
  }

  calculateCompatibility(roomA, roomB) {
    let score = 0;

    // Participant count similarity
    const sizeDiff = Math.abs(roomA.participantCount - roomB.participantCount);
    const maxSize = Math.max(roomA.participantCount, roomB.participantCount);
    score += maxSize > 0 ? (1 - (sizeDiff / maxSize)) * 0.3 : 0.3;

    // Tag overlap
    const commonTags = roomA.tags.filter(tag => roomB.tags.includes(tag));
    score += (commonTags.length / Math.max(roomA.tags.length, roomB.tags.length, 1)) * 0.3;

    // Region compatibility
    if (roomA.region === roomB.region || roomA.region === 'global' || roomB.region === 'global') {
      score += 0.2;
    }

    // Language compatibility
    if (roomA.language === roomB.language || roomA.language === 'global' || roomB.language === 'global') {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  estimateMoodBlend(roomA, roomB) {
    const blendedValence = (roomA.fusedMoodVector.valence + roomB.fusedMoodVector.valence) / 2;
    const blendedArousal = (roomA.fusedMoodVector.arousal + roomB.fusedMoodVector.arousal) / 2;

    return vectorToMoodLabel({ valence: blendedValence, arousal: blendedArousal });
  }

  getMoodEnergy(vector) {
    if (vector.arousal > 0.5) return 'high';
    if (vector.arousal > 0) return 'medium';
    return 'low';
  }

  getMoodVibe(vector) {
    if (vector.valence > 0.5 && vector.arousal > 0.5) return 'energetic';
    if (vector.valence > 0.5 && vector.arousal <= 0.5) return 'peaceful';
    if (vector.valence <= 0.5 && vector.arousal > 0.5) return 'intense';
    return 'mellow';
  }

  getRoomSizeCategory(count) {
    if (count >= 20) return 'large';
    if (count >= 8) return 'medium';
    if (count >= 3) return 'small';
    return 'intimate';
  }

  getCompatibilityDescription(score) {
    if (score >= 0.8) return 'excellent';
    if (score >= 0.6) return 'good';
    if (score >= 0.4) return 'fair';
    return 'basic';
  }

  generateMatchReason(match) {
    const reasons = [];
    
    if (match.similarity >= 0.9) {
      reasons.push('Nearly identical mood');
    } else if (match.similarity >= 0.8) {
      reasons.push('Very similar mood');
    } else {
      reasons.push('Similar mood');
    }

    if (match.compatibilityScore >= 0.8) {
      reasons.push('excellent compatibility');
    }

    if (match.tags.length > 0) {
      reasons.push(`shared interests: ${match.tags.slice(0, 2).join(', ')}`);
    }

    return reasons.join(', ');
  }

  findRoomByAnonymousId(anonymousId) {
    for (const [roomId, room] of this.activeRooms) {
      if (room.anonymousProfile.id === anonymousId) {
        return room;
      }
    }
    return null;
  }

  async getRoomData(roomId) {
    // Interface with your room system
    // Return mock data for now
    return {
      id: roomId,
      mood: {
        label: 'happy',
        vector: { valence: 0.7, arousal: 0.6 }
      },
      participants: [],
      playlist: []
    };
  }

  storeConnectionRequest(request) {
    // Store in memory or database
    // For now, just log it
    console.log('Connection request stored:', request.id);
  }

  async getConnectionRequest(requestId) {
    // Retrieve from storage
    // Mock implementation
    return {
      id: requestId,
      status: 'pending',
      expiresAt: new Date(Date.now() + 300000)
    };
  }

  updateMatchHistory(roomId, connectedRoomId, action) {
    const room = this.activeRooms.get(roomId);
    if (room) {
      room.matchHistory.push({
        roomId: connectedRoomId,
        action,
        timestamp: new Date()
      });

      // Keep only last 10 connections
      if (room.matchHistory.length > 10) {
        room.matchHistory = room.matchHistory.slice(-10);
      }
    }
  }

  expireConnectionRequest(requestId) {
    // Mark request as expired
    console.log('Connection request expired:', requestId);
  }
}

module.exports = { AmbientMatchingService };
