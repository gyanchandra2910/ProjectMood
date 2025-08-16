/**
 * Integration Tests for Room Creation and Join Flow
 * Tests the complete user journey from room creation to joining and interactions
 */

const request = require('supertest');
const { app } = require('../app');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Mock Firebase Admin for testing
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  auth: () => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User'
    })
  })
}));

describe('Room Creation and Join Flow Integration Tests', () => {
  let server;
  let authToken;
  let createdRoomId;
  let testUserId = 'test-user-123';

  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/moodfusion_test';
    await mongoose.connect(mongoUri);
    
    // Generate test auth token
    authToken = 'mock-firebase-token';
    
    // Start server
    const port = process.env.TEST_PORT || 3002;
    server = app.listen(port);
  });

  afterAll(async () => {
    // Clean up database
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    
    // Close server
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // Clear relevant collections before each test
    const collections = await mongoose.connection.db.collections();
    await Promise.all(
      collections.map(collection => collection.deleteMany({}))
    );
  });

  describe('Room Creation Flow', () => {
    test('should create a new room successfully', async () => {
      const roomData = {
        name: 'Test Music Room',
        description: 'A room for testing music features',
        mood: {
          valence: 0.7,
          arousal: 0.6,
          dominance: 0.5,
          emotion: 'happy'
        },
        musicPreferences: {
          genres: ['pop', 'electronic'],
          tempo: 'medium',
          energy: 'high'
        },
        privacy: 'public',
        maxParticipants: 10
      };

      const response = await request(app)
        .post('/api/rooms/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(roomData)
        .expect(201);

      expect(response.body).toHaveProperty('roomId');
      expect(response.body).toHaveProperty('room');
      expect(response.body.room.name).toBe(roomData.name);
      expect(response.body.room.creator).toBe(testUserId);
      expect(response.body.room.participants).toHaveLength(1);
      expect(response.body.room.participants[0]).toBe(testUserId);

      createdRoomId = response.body.roomId;
    });

    test('should validate room data during creation', async () => {
      const invalidRoomData = {
        name: '', // Invalid empty name
        mood: {
          valence: 1.5, // Invalid range
          arousal: -0.1, // Invalid range
          emotion: 'invalid_emotion'
        }
      };

      const response = await request(app)
        .post('/api/rooms/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRoomData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContain('Room name is required');
      expect(response.body.errors.some(error => 
        error.includes('valence must be between 0 and 1')
      )).toBe(true);
    });

    test('should require authentication for room creation', async () => {
      const roomData = {
        name: 'Unauthorized Room',
        mood: { valence: 0.5, arousal: 0.5, dominance: 0.5, emotion: 'neutral' }
      };

      await request(app)
        .post('/api/rooms/create')
        .send(roomData)
        .expect(401);
    });

    test('should handle room creation with default values', async () => {
      const minimalRoomData = {
        name: 'Minimal Room'
      };

      const response = await request(app)
        .post('/api/rooms/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(minimalRoomData)
        .expect(201);

      expect(response.body.room.mood).toHaveProperty('valence');
      expect(response.body.room.mood).toHaveProperty('arousal');
      expect(response.body.room.mood).toHaveProperty('dominance');
      expect(response.body.room.privacy).toBe('public'); // Default
      expect(response.body.room.maxParticipants).toBe(50); // Default
    });
  });

  describe('Room Join Flow', () => {
    beforeEach(async () => {
      // Create a room for joining tests
      const roomData = {
        name: 'Join Test Room',
        mood: { valence: 0.6, arousal: 0.5, dominance: 0.7, emotion: 'calm' },
        privacy: 'public'
      };

      const response = await request(app)
        .post('/api/rooms/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(roomData);

      createdRoomId = response.body.roomId;
    });

    test('should allow user to join an existing room', async () => {
      // Create a second user for joining
      const secondUserToken = 'mock-firebase-token-2';
      
      // Mock second user verification
      require('firebase-admin').auth().verifyIdToken
        .mockResolvedValueOnce({
          uid: 'test-user-456',
          email: 'test2@example.com',
          name: 'Test User 2'
        });

      const response = await request(app)
        .post(`/api/rooms/${createdRoomId}/join`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('room');
      expect(response.body.room.participants).toHaveLength(2);
      expect(response.body.room.participants).toContain('test-user-456');
    });

    test('should prevent joining non-existent room', async () => {
      const fakeRoomId = '507f1f77bcf86cd799439011';

      await request(app)
        .post(`/api/rooms/${fakeRoomId}/join`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    test('should prevent joining room when already a participant', async () => {
      const response = await request(app)
        .post(`/api/rooms/${createdRoomId}/join`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toContain('already a participant');
    });

    test('should enforce room capacity limits', async () => {
      // Create room with capacity of 1
      const limitedRoomData = {
        name: 'Limited Capacity Room',
        maxParticipants: 1,
        mood: { valence: 0.5, arousal: 0.5, dominance: 0.5, emotion: 'neutral' }
      };

      const createResponse = await request(app)
        .post('/api/rooms/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(limitedRoomData);

      const limitedRoomId = createResponse.body.roomId;

      // Try to join with second user
      require('firebase-admin').auth().verifyIdToken
        .mockResolvedValueOnce({
          uid: 'test-user-789',
          email: 'test3@example.com',
          name: 'Test User 3'
        });

      await request(app)
        .post(`/api/rooms/${limitedRoomId}/join`)
        .set('Authorization', `Bearer mock-firebase-token-3`)
        .expect(400);
    });

    test('should handle private room join attempts', async () => {
      // Create private room
      const privateRoomData = {
        name: 'Private Room',
        privacy: 'private',
        mood: { valence: 0.5, arousal: 0.5, dominance: 0.5, emotion: 'neutral' }
      };

      const createResponse = await request(app)
        .post('/api/rooms/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(privateRoomData);

      const privateRoomId = createResponse.body.roomId;

      // Try to join with different user
      require('firebase-admin').auth().verifyIdToken
        .mockResolvedValueOnce({
          uid: 'test-user-999',
          email: 'test4@example.com',
          name: 'Test User 4'
        });

      await request(app)
        .post(`/api/rooms/${privateRoomId}/join`)
        .set('Authorization', `Bearer mock-firebase-token-4`)
        .expect(403);
    });
  });

  describe('Room Leave Flow', () => {
    test('should allow user to leave room', async () => {
      const response = await request(app)
        .post(`/api/rooms/${createdRoomId}/leave`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.room.participants).toHaveLength(0);
    });

    test('should handle leaving non-existent room', async () => {
      const fakeRoomId = '507f1f77bcf86cd799439011';

      await request(app)
        .post(`/api/rooms/${fakeRoomId}/leave`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    test('should handle leaving room user is not in', async () => {
      // Create room with different user
      require('firebase-admin').auth().verifyIdToken
        .mockResolvedValueOnce({
          uid: 'other-user-123',
          email: 'other@example.com',
          name: 'Other User'
        });

      const createResponse = await request(app)
        .post('/api/rooms/create')
        .set('Authorization', `Bearer mock-other-token`)
        .send({
          name: 'Other User Room',
          mood: { valence: 0.5, arousal: 0.5, dominance: 0.5, emotion: 'neutral' }
        });

      const otherRoomId = createResponse.body.roomId;

      // Try to leave with original user
      await request(app)
        .post(`/api/rooms/${otherRoomId}/leave`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Room List and Discovery', () => {
    test('should list public rooms', async () => {
      // Create multiple rooms
      const rooms = [
        { name: 'Public Room 1', privacy: 'public' },
        { name: 'Public Room 2', privacy: 'public' },
        { name: 'Private Room', privacy: 'private' }
      ];

      for (const roomData of rooms) {
        await request(app)
          .post('/api/rooms/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...roomData,
            mood: { valence: 0.5, arousal: 0.5, dominance: 0.5, emotion: 'neutral' }
          });
      }

      const response = await request(app)
        .get('/api/rooms/public')
        .expect(200);

      expect(response.body.rooms).toHaveLength(2); // Only public rooms
      expect(response.body.rooms.every(room => room.privacy === 'public')).toBe(true);
    });

    test('should filter rooms by mood similarity', async () => {
      const targetMood = { valence: 0.8, arousal: 0.7, dominance: 0.6 };

      const response = await request(app)
        .get('/api/rooms/discover')
        .query({
          mood: JSON.stringify(targetMood),
          similarity: 0.7
        })
        .expect(200);

      expect(response.body).toHaveProperty('rooms');
      expect(response.body).toHaveProperty('matchingCriteria');
    });

    test('should get user\'s joined rooms', async () => {
      const response = await request(app)
        .get('/api/rooms/my-rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('rooms');
      expect(Array.isArray(response.body.rooms)).toBe(true);
    });
  });

  describe('Room Mood Updates', () => {
    test('should update room mood based on participant moods', async () => {
      const newMood = {
        valence: 0.8,
        arousal: 0.6,
        dominance: 0.7,
        emotion: 'excited'
      };

      const response = await request(app)
        .post(`/api/rooms/${createdRoomId}/update-mood`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ mood: newMood })
        .expect(200);

      expect(response.body.room.mood.valence).toBeCloseTo(newMood.valence, 1);
      expect(response.body.room.moodHistory).toBeDefined();
      expect(response.body.room.moodHistory.length).toBeGreaterThan(0);
    });

    test('should validate mood update data', async () => {
      const invalidMood = {
        valence: 1.5, // Invalid
        arousal: -0.1, // Invalid
        emotion: 'invalid'
      };

      await request(app)
        .post(`/api/rooms/${createdRoomId}/update-mood`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ mood: invalidMood })
        .expect(400);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed room IDs', async () => {
      await request(app)
        .post('/api/rooms/invalid-id/join')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    test('should handle database connection errors gracefully', async () => {
      // Temporarily close database connection
      await mongoose.connection.close();

      await request(app)
        .post('/api/rooms/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Room',
          mood: { valence: 0.5, arousal: 0.5, dominance: 0.5, emotion: 'neutral' }
        })
        .expect(500);

      // Reconnect for cleanup
      await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/moodfusion_test');
    });

    test('should handle concurrent room operations', async () => {
      // Simulate concurrent join requests
      const joinPromises = Array(5).fill().map(() =>
        request(app)
          .post(`/api/rooms/${createdRoomId}/join`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.allSettled(joinPromises);
      
      // Only one should succeed (user already in room)
      const successCount = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;
      
      expect(successCount).toBeLessThanOrEqual(1);
    });
  });

  describe('Room Analytics and Metrics', () => {
    test('should track room engagement metrics', async () => {
      const response = await request(app)
        .get(`/api/rooms/${createdRoomId}/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('metrics');
      expect(response.body.metrics).toHaveProperty('participantCount');
      expect(response.body.metrics).toHaveProperty('moodStability');
      expect(response.body.metrics).toHaveProperty('engagementScore');
    });

    test('should calculate room mood evolution', async () => {
      // Add some mood updates
      const moods = [
        { valence: 0.5, arousal: 0.5, dominance: 0.5, emotion: 'neutral' },
        { valence: 0.7, arousal: 0.6, dominance: 0.6, emotion: 'happy' },
        { valence: 0.8, arousal: 0.7, dominance: 0.7, emotion: 'excited' }
      ];

      for (const mood of moods) {
        await request(app)
          .post(`/api/rooms/${createdRoomId}/update-mood`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ mood });
      }

      const response = await request(app)
        .get(`/api/rooms/${createdRoomId}/mood-evolution`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('evolution');
      expect(response.body.evolution).toHaveProperty('trend');
      expect(response.body.evolution.trend).toBe('improving');
    });
  });
});
