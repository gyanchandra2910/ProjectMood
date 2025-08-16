// Room Connection Socket Events
// Real-time socket handling for room connections, DJ battles, and ambient matching

const { RoomConnectionManager } = require('../services/roomConnection');
const { AmbientMatchingService } = require('../services/ambientMatching');

class RoomConnectionSocketHandler {
  constructor(io) {
    this.io = io;
    this.roomConnectionManager = new RoomConnectionManager(io);
    this.ambientMatchingService = new AmbientMatchingService(io);
    
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // === ROOM CONNECTION EVENTS ===

      // Join room and register for ambient matching
      socket.on('join-room', async (data) => {
        try {
          const { roomId, userId, userInfo = {}, matchingOptions = {} } = data;
          
          socket.join(roomId);
          socket.roomId = roomId;
          socket.userId = userId;

          // Register room for ambient matching if enabled
          if (matchingOptions.enableMatching) {
            try {
              await this.ambientMatchingService.registerRoomForMatching(roomId, {
                allowMatching: true,
                isPublic: matchingOptions.isPublic || false,
                tags: matchingOptions.tags || [],
                ...matchingOptions
              });
              
              socket.emit('ambient-matching-enabled', {
                roomId,
                message: 'Room registered for ambient matching'
              });
            } catch (error) {
              console.error('Ambient matching registration failed:', error);
            }
          }

          // Notify room of new participant
          socket.to(roomId).emit('user-joined', {
            userId,
            userInfo,
            timestamp: new Date()
          });

          // Send current room status
          const connectionStatus = this.roomConnectionManager.connectedRooms.has(roomId);
          socket.emit('room-status', {
            roomId,
            connected: connectionStatus,
            connectedRoom: connectionStatus ? this.roomConnectionManager.connectedRooms.get(roomId) : null
          });

        } catch (error) {
          console.error('Join room failed:', error);
          socket.emit('error', { message: 'Failed to join room', error: error.message });
        }
      });

      // Request room connection
      socket.on('request-room-connection', async (data) => {
        try {
          const { targetRoomId, message = '', options = {} } = data;
          const sourceRoomId = socket.roomId;
          const userId = socket.userId;

          if (!sourceRoomId || !targetRoomId || !userId) {
            socket.emit('error', { message: 'Missing required connection data' });
            return;
          }

          const result = await this.roomConnectionManager.connectRooms(
            sourceRoomId,
            targetRoomId,
            userId,
            {
              requestMessage: message,
              ...options
            }
          );

          socket.emit('connection-request-success', {
            sharedRoomId: result.sharedRoomId,
            targetRoom: targetRoomId,
            message: 'Room connection established successfully'
          });

        } catch (error) {
          console.error('Room connection request failed:', error);
          socket.emit('connection-request-failed', {
            error: error.message,
            targetRoom: data.targetRoomId
          });
        }
      });

      // === DJ BATTLE EVENTS ===

      // Start DJ battle
      socket.on('start-dj-battle', async (data) => {
        try {
          const { sharedRoomId, options = {} } = data;
          
          if (!sharedRoomId) {
            socket.emit('error', { message: 'Shared room ID required for DJ battle' });
            return;
          }

          const result = await this.roomConnectionManager.startDjBattle(sharedRoomId, {
            duration: options.duration || 90000,
            initiatedBy: socket.userId,
            ...options
          });

          socket.emit('dj-battle-start-success', {
            battleId: result.battleId,
            duration: result.duration,
            message: 'DJ Battle started successfully'
          });

        } catch (error) {
          console.error('DJ Battle start failed:', error);
          socket.emit('dj-battle-start-failed', {
            error: error.message,
            sharedRoomId: data.sharedRoomId
          });
        }
      });

      // DJ battle track vote
      socket.on('dj-battle-vote', async (data) => {
        try {
          const { battleId, trackId, room, vote } = data; // vote: 'up', 'down', 'fire'
          
          if (!battleId || !trackId || !room || !vote) {
            socket.emit('error', { message: 'Missing vote data' });
            return;
          }

          // Process vote (update engagement metrics)
          const battle = this.roomConnectionManager.djBattles.get(battleId);
          if (battle && battle.status === 'active') {
            const voteWeight = this.getVoteWeight(vote);
            
            if (room === 'A') {
              battle.stats.engagementA += voteWeight;
            } else {
              battle.stats.engagementB += voteWeight;
            }

            // Broadcast vote to all battle participants
            this.io.to(battle.sharedRoomId).emit('dj-battle-vote-received', {
              battleId,
              room,
              vote,
              userId: socket.userId,
              currentEngagement: {
                roomA: battle.stats.engagementA,
                roomB: battle.stats.engagementB
              }
            });
          }

        } catch (error) {
          console.error('DJ battle vote failed:', error);
          socket.emit('error', { message: 'Vote processing failed' });
        }
      });

      // === AMBIENT MATCHING EVENTS ===

      // Find ambient matches
      socket.on('find-ambient-matches', async (data) => {
        try {
          const { threshold, tags = [] } = data;
          const roomId = socket.roomId;

          if (!roomId) {
            socket.emit('error', { message: 'Must be in a room to find matches' });
            return;
          }

          const result = await this.ambientMatchingService.findMatches(roomId, threshold);
          
          socket.emit('ambient-matches-found', {
            roomId,
            matches: result.matches || [],
            searchedRooms: result.searchedRooms || 0,
            timestamp: new Date()
          });

        } catch (error) {
          console.error('Ambient match finding failed:', error);
          socket.emit('ambient-matches-error', {
            error: error.message
          });
        }
      });

      // Request ambient connection
      socket.on('request-ambient-connection', async (data) => {
        try {
          const { toAnonymousId, message = '' } = data;
          const fromRoomId = socket.roomId;
          const userId = socket.userId;

          if (!fromRoomId || !toAnonymousId || !userId) {
            socket.emit('error', { message: 'Missing connection request data' });
            return;
          }

          const result = await this.ambientMatchingService.requestConnection(
            fromRoomId,
            toAnonymousId,
            userId,
            message
          );

          socket.emit('ambient-connection-request-sent', {
            requestId: result.requestId,
            targetAnonymousId: toAnonymousId,
            similarity: result.similarity,
            message: 'Connection request sent successfully'
          });

        } catch (error) {
          console.error('Ambient connection request failed:', error);
          socket.emit('ambient-connection-request-failed', {
            error: error.message,
            targetAnonymousId: data.toAnonymousId
          });
        }
      });

      // Respond to ambient connection request
      socket.on('respond-ambient-connection', async (data) => {
        try {
          const { requestId, response, message = '' } = data; // response: 'accepted' or 'rejected'
          const roomId = socket.roomId;
          const userId = socket.userId;

          if (!requestId || !response || !roomId || !userId) {
            socket.emit('error', { message: 'Missing response data' });
            return;
          }

          const result = await this.ambientMatchingService.respondToConnectionRequest(
            requestId,
            roomId,
            userId,
            response,
            message
          );

          socket.emit('ambient-connection-response-sent', {
            requestId,
            response,
            message: `Connection request ${response} successfully`
          });

        } catch (error) {
          console.error('Ambient connection response failed:', error);
          socket.emit('ambient-connection-response-failed', {
            error: error.message,
            requestId: data.requestId
          });
        }
      });

      // Update mood for ambient matching
      socket.on('update-mood-for-matching', async (data) => {
        try {
          const { moodData } = data;
          const roomId = socket.roomId;

          if (!roomId || !moodData) {
            socket.emit('error', { message: 'Room ID and mood data required' });
            return;
          }

          const result = await this.ambientMatchingService.updateRoomMood(roomId, moodData);

          socket.emit('mood-updated-for-matching', {
            roomId,
            newMood: result.newMood,
            matchingEnabled: result.matchingEnabled,
            message: 'Mood updated for matching'
          });

          // Notify room members of mood update
          socket.to(roomId).emit('room-mood-updated', {
            newMood: result.newMood,
            updatedBy: socket.userId,
            timestamp: new Date()
          });

        } catch (error) {
          console.error('Mood update for matching failed:', error);
          socket.emit('mood-update-failed', {
            error: error.message
          });
        }
      });

      // === REAL-TIME INTERACTION EVENTS ===

      // Cross-room chat (when rooms are connected)
      socket.on('cross-room-message', (data) => {
        try {
          const { message, sharedRoomId } = data;
          const userId = socket.userId;
          const sourceRoom = socket.roomId;

          if (!message || !sharedRoomId || !userId) {
            socket.emit('error', { message: 'Missing message data' });
            return;
          }

          // Verify user is in connected rooms
          const sharedRoom = this.roomConnectionManager.sharedRooms.get(sharedRoomId);
          if (!sharedRoom || 
              (sourceRoom !== sharedRoom.roomA && sourceRoom !== sharedRoom.roomB)) {
            socket.emit('error', { message: 'Not authorized for cross-room chat' });
            return;
          }

          // Broadcast message to shared room
          this.io.to(sharedRoomId).emit('cross-room-message-received', {
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId,
            sourceRoom,
            message: message.substring(0, 500), // Limit message length
            timestamp: new Date(),
            sharedRoomId
          });

        } catch (error) {
          console.error('Cross-room message failed:', error);
          socket.emit('error', { message: 'Message sending failed' });
        }
      });

      // Mood synchronization between connected rooms
      socket.on('sync-mood-with-connected', (data) => {
        try {
          const { moodData } = data;
          const roomId = socket.roomId;
          const userId = socket.userId;

          if (!moodData || !roomId) {
            socket.emit('error', { message: 'Mood data and room ID required' });
            return;
          }

          // Check if room is connected
          const connectedRoomId = this.roomConnectionManager.connectedRooms.get(roomId);
          if (!connectedRoomId) {
            socket.emit('error', { message: 'Room not connected to another room' });
            return;
          }

          // Find shared room
          const sharedRoom = Array.from(this.roomConnectionManager.sharedRooms.values())
            .find(room => room.roomA === roomId || room.roomB === roomId);

          if (sharedRoom) {
            // Broadcast mood sync to shared room
            this.io.to(sharedRoom.id).emit('mood-sync-received', {
              userId,
              sourceRoom: roomId,
              moodData,
              timestamp: new Date(),
              sharedRoomId: sharedRoom.id
            });
          }

        } catch (error) {
          console.error('Mood sync failed:', error);
          socket.emit('error', { message: 'Mood synchronization failed' });
        }
      });

      // Real-time engagement tracking
      socket.on('track-engagement', (data) => {
        try {
          const { type, value, trackId, battleId } = data;
          const userId = socket.userId;
          const roomId = socket.roomId;

          // Track engagement for DJ battles
          if (battleId) {
            const battle = this.roomConnectionManager.djBattles.get(battleId);
            if (battle && battle.status === 'active') {
              const engagementValue = this.calculateEngagementValue(type, value);
              
              // Determine which room the user belongs to
              const userRoom = battle.roomA === roomId ? 'A' : 'B';
              
              if (userRoom === 'A') {
                battle.stats.engagementA += engagementValue;
              } else {
                battle.stats.engagementB += engagementValue;
              }

              // Broadcast engagement update
              this.io.to(battle.sharedRoomId).emit('engagement-updated', {
                battleId,
                type,
                userId,
                room: userRoom,
                currentStats: {
                  roomA: battle.stats.engagementA,
                  roomB: battle.stats.engagementB
                }
              });
            }
          }

        } catch (error) {
          console.error('Engagement tracking failed:', error);
        }
      });

      // === CONNECTION CLEANUP ===

      // Handle disconnection
      socket.on('disconnect', () => {
        try {
          console.log(`Socket disconnected: ${socket.id}`);
          
          const roomId = socket.roomId;
          const userId = socket.userId;

          if (roomId && userId) {
            // Notify room members
            socket.to(roomId).emit('user-left', {
              userId,
              timestamp: new Date()
            });

            // Clean up any pending requests or battles
            this.cleanupUserSessions(userId, roomId);
          }

        } catch (error) {
          console.error('Disconnect cleanup failed:', error);
        }
      });

      // Leave room
      socket.on('leave-room', () => {
        try {
          const roomId = socket.roomId;
          const userId = socket.userId;

          if (roomId) {
            socket.leave(roomId);
            
            if (userId) {
              socket.to(roomId).emit('user-left', {
                userId,
                timestamp: new Date()
              });
            }
          }

          socket.roomId = null;
          socket.userId = null;

        } catch (error) {
          console.error('Leave room failed:', error);
        }
      });
    });
  }

  // Utility methods
  getVoteWeight(vote) {
    switch (vote) {
      case 'fire': return 3;
      case 'up': return 1;
      case 'down': return -1;
      default: return 0;
    }
  }

  calculateEngagementValue(type, value) {
    switch (type) {
      case 'track_like': return 2;
      case 'track_share': return 3;
      case 'dance_move': return 1;
      case 'message': return 0.5;
      case 'reaction': return 1;
      default: return 0;
    }
  }

  cleanupUserSessions(userId, roomId) {
    try {
      // Clean up any connection requests
      // Clean up any battle votes
      // Remove from matching queues
      console.log(`Cleaned up sessions for user ${userId} in room ${roomId}`);
    } catch (error) {
      console.error('Session cleanup failed:', error);
    }
  }

  // Get service instances for external use
  getRoomConnectionManager() {
    return this.roomConnectionManager;
  }

  getAmbientMatchingService() {
    return this.ambientMatchingService;
  }
}

module.exports = { RoomConnectionSocketHandler };
