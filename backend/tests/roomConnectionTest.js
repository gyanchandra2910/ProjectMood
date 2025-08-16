// Comprehensive Room Connection Test Suite
// Tests room connections, DJ battles, ambient matching, and real-time features

const fetch = require('node-fetch');
const io = require('socket.io-client');

class RoomConnectionTestSuite {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.testResults = [];
    this.sockets = [];
  }

  async runAllTests() {
    console.log('🧪 Starting Room Connection Test Suite...\n');
    
    const tests = [
      'testHealthEndpoint',
      'testRoomConnectionAPI',
      'testAmbientMatchingAPI',
      'testDjBattleAPI',
      'testSocketIOConnections',
      'testRoomConnectionFlow',
      'testAmbientMatchingFlow',
      'testDjBattleFlow',
      'testMoodBlending',
      'testPlaylistGeneration',
      'testErrorHandling',
      'testPerformance'
    ];

    for (const testName of tests) {
      try {
        console.log(`▶️  Running ${testName}...`);
        await this[testName]();
        this.logResult(testName, 'PASS', null);
      } catch (error) {
        this.logResult(testName, 'FAIL', error.message);
        console.error(`❌ ${testName} failed:`, error.message);
      }
    }

    this.printSummary();
    await this.cleanup();
  }

  // Health and basic connectivity tests
  async testHealthEndpoint() {
    const response = await fetch(`${this.baseUrl}/api/health`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    if (!data.features.roomConnections || !data.features.ambientMatching) {
      throw new Error('Room connection features not enabled');
    }

    console.log('✅ Health endpoint passed');
  }

  // Room Connection API tests
  async testRoomConnectionAPI() {
    // Test connection status (no rooms connected)
    const statusResponse = await fetch(`${this.baseUrl}/api/room-connections/status/test-room-1`);
    const statusData = await statusResponse.json();
    
    if (!statusResponse.ok || statusData.connected) {
      throw new Error('Status endpoint failed or unexpected connection');
    }

    // Test connection attempt (should fail without proper setup)
    const connectResponse = await fetch(`${this.baseUrl}/api/room-connections/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomA: 'test-room-1',
        roomB: 'test-room-2',
        userId: 'test-user-1'
      })
    });

    // Should either connect or fail gracefully
    if (!connectResponse.ok && connectResponse.status !== 500) {
      throw new Error(`Unexpected connection response: ${connectResponse.status}`);
    }

    console.log('✅ Room Connection API tests passed');
  }

  // Ambient Matching API tests
  async testAmbientMatchingAPI() {
    // Test room registration for matching
    const registerResponse = await fetch(`${this.baseUrl}/api/room-connections/ambient/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: 'test-room-1',
        options: {
          allowMatching: true,
          isPublic: true,
          tags: ['music', 'test'],
          preferredSimilarity: 0.75
        }
      })
    });

    if (!registerResponse.ok) {
      throw new Error(`Registration failed: ${registerResponse.status}`);
    }

    // Test finding matches
    const matchesResponse = await fetch(`${this.baseUrl}/api/room-connections/ambient/matches/test-room-1`);
    const matchesData = await matchesResponse.json();

    if (!matchesResponse.ok) {
      throw new Error(`Matches endpoint failed: ${matchesResponse.status}`);
    }

    if (!Array.isArray(matchesData.data.matches)) {
      throw new Error('Matches data format invalid');
    }

    console.log('✅ Ambient Matching API tests passed');
  }

  // DJ Battle API tests
  async testDjBattleAPI() {
    // Test battle status (no active battles)
    const statusResponse = await fetch(`${this.baseUrl}/api/room-connections/dj-battle/status/non-existent-battle`);
    
    if (statusResponse.status !== 404) {
      throw new Error('Expected 404 for non-existent battle');
    }

    // Test battle start (should fail without shared room)
    const startResponse = await fetch(`${this.baseUrl}/api/room-connections/dj-battle/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sharedRoomId: 'non-existent-shared-room'
      })
    });

    if (startResponse.status !== 500) {
      throw new Error('Expected error for invalid shared room');
    }

    console.log('✅ DJ Battle API tests passed');
  }

  // Socket.IO connection tests
  async testSocketIOConnections() {
    return new Promise((resolve, reject) => {
      const socket = io(this.baseUrl, {
        timeout: 5000,
        forceNew: true
      });

      socket.on('connect', () => {
        this.sockets.push(socket);
        console.log('✅ Socket.IO connection established');
        
        // Test room join
        socket.emit('join-room', {
          roomId: 'test-room-socket',
          userId: 'test-user-socket',
          userInfo: { displayName: 'Test User' },
          matchingOptions: { enableMatching: true }
        });

        setTimeout(() => {
          socket.disconnect();
          resolve();
        }, 2000);
      });

      socket.on('connect_error', (error) => {
        reject(new Error(`Socket connection failed: ${error.message}`));
      });

      socket.on('error', (error) => {
        reject(new Error(`Socket error: ${error.message}`));
      });
    });
  }

  // Full room connection flow test
  async testRoomConnectionFlow() {
    // Simulate full connection workflow
    const roomA = 'flow-test-room-a';
    const roomB = 'flow-test-room-b';
    const userId = 'flow-test-user';

    // 1. Register rooms for matching
    await fetch(`${this.baseUrl}/api/room-connections/ambient/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: roomA,
        options: { allowMatching: true, tags: ['flow-test'] }
      })
    });

    await fetch(`${this.baseUrl}/api/room-connections/ambient/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: roomB,
        options: { allowMatching: true, tags: ['flow-test'] }
      })
    });

    // 2. Find matches
    const matchesResponse = await fetch(`${this.baseUrl}/api/room-connections/ambient/matches/${roomA}`);
    const matchesData = await matchesResponse.json();

    if (!matchesResponse.ok) {
      throw new Error('Matches finding failed in flow test');
    }

    // 3. Test connection request (mock)
    const requestResponse = await fetch(`${this.baseUrl}/api/room-connections/ambient/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromRoomId: roomA,
        toAnonymousId: 'mock-anonymous-id',
        userId,
        message: 'Flow test connection'
      })
    });

    // Should handle gracefully even if target doesn't exist
    if (!requestResponse.ok && requestResponse.status !== 500) {
      throw new Error(`Unexpected request response: ${requestResponse.status}`);
    }

    console.log('✅ Room Connection Flow test passed');
  }

  // Ambient matching flow test
  async testAmbientMatchingFlow() {
    const roomId = 'ambient-flow-test';
    const userId = 'ambient-test-user';

    // Test complete ambient matching workflow
    const response = await fetch(`${this.baseUrl}/api/room-connections/ambient/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        userId
      })
    });

    if (!response.ok) {
      throw new Error(`Suggestions failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.data || !Array.isArray(data.data.suggestions)) {
      throw new Error('Suggestions data format invalid');
    }

    console.log('✅ Ambient Matching Flow test passed');
  }

  // DJ Battle flow test
  async testDjBattleFlow() {
    // Test battle workflow with mock data
    const battleData = {
      battleId: 'mock-battle-' + Date.now(),
      sharedRoomId: 'mock-shared-room',
      roomA: 'battle-room-a',
      roomB: 'battle-room-b'
    };

    // Test battle results endpoint (should return 404 for non-existent)
    const resultsResponse = await fetch(`${this.baseUrl}/api/room-connections/dj-battle/results/${battleData.battleId}`);
    
    if (resultsResponse.status !== 404) {
      throw new Error('Expected 404 for non-existent battle results');
    }

    console.log('✅ DJ Battle Flow test passed');
  }

  // Mood blending algorithm test
  async testMoodBlending() {
    // Test mood fusion with multiple inputs
    const moodInputs = [
      { mood: 'happy', confidence: 0.8, weight: 1.0, source: 'user1' },
      { mood: 'excited', confidence: 0.9, weight: 1.0, source: 'user2' },
      { mood: 'calm', confidence: 0.7, weight: 0.8, source: 'user3' }
    ];

    const response = await fetch(`${this.baseUrl}/api/mood/fuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moodInputs })
    });

    if (!response.ok) {
      throw new Error(`Mood fusion failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.result || !data.result.vector) {
      throw new Error('Mood fusion result invalid');
    }

    const { valence, arousal } = data.result.vector;
    if (valence < -1 || valence > 1 || arousal < -1 || arousal > 1) {
      throw new Error('Mood vector values out of range');
    }

    console.log('✅ Mood Blending test passed');
  }

  // Playlist generation test
  async testPlaylistGeneration() {
    // Test music generation endpoints
    const moodData = {
      valence: 0.7,
      arousal: 0.6
    };

    const response = await fetch(`${this.baseUrl}/api/music/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mood: moodData,
        service: 'fallback', // Use fallback for testing
        style: 'ambient',
        duration: 30
      })
    });

    if (!response.ok && response.status !== 503) {
      throw new Error(`Music generation failed unexpectedly: ${response.status}`);
    }

    console.log('✅ Playlist Generation test passed');
  }

  // Error handling tests
  async testErrorHandling() {
    // Test various error conditions
    const errorTests = [
      {
        url: '/api/room-connections/connect',
        method: 'POST',
        body: {}, // Missing required fields
        expectedStatus: 400
      },
      {
        url: '/api/room-connections/ambient/register',
        method: 'POST',
        body: { invalidField: 'test' }, // Invalid body
        expectedStatus: 400
      },
      {
        url: '/api/room-connections/status/invalid-room-id-very-long-string-that-should-not-exist',
        method: 'GET',
        expectedStatus: [200, 404, 500] // Various acceptable responses
      }
    ];

    for (const test of errorTests) {
      const response = await fetch(`${this.baseUrl}${test.url}`, {
        method: test.method,
        headers: { 'Content-Type': 'application/json' },
        body: test.body ? JSON.stringify(test.body) : undefined
      });

      const expectedStatuses = Array.isArray(test.expectedStatus) 
        ? test.expectedStatus 
        : [test.expectedStatus];

      if (!expectedStatuses.includes(response.status)) {
        throw new Error(`Error test failed for ${test.url}: expected ${test.expectedStatus}, got ${response.status}`);
      }
    }

    console.log('✅ Error Handling tests passed');
  }

  // Performance tests
  async testPerformance() {
    const iterations = 10;
    const startTime = Date.now();

    // Test rapid requests to health endpoint
    const promises = Array.from({ length: iterations }, () =>
      fetch(`${this.baseUrl}/api/health`)
    );

    await Promise.all(promises);
    
    const endTime = Date.now();
    const avgResponseTime = (endTime - startTime) / iterations;

    if (avgResponseTime > 1000) { // Should respond within 1 second on average
      throw new Error(`Performance test failed: avg response time ${avgResponseTime}ms`);
    }

    console.log(`✅ Performance test passed (avg: ${avgResponseTime.toFixed(2)}ms)`);
  }

  // Utility methods
  logResult(testName, status, error) {
    this.testResults.push({
      test: testName,
      status,
      error,
      timestamp: new Date()
    });
  }

  printSummary() {
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const total = this.testResults.length;

    console.log('\n' + '='.repeat(60));
    console.log('🧪 ROOM CONNECTION TEST SUITE SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          console.log(`   • ${result.test}: ${result.error}`);
        });
    }

    console.log('\n📋 TEST DETAILS:');
    this.testResults.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      console.log(`   ${icon} ${result.test}`);
    });

    console.log('\n🚀 Room Connection System Tests Complete!\n');
  }

  async cleanup() {
    // Clean up sockets
    this.sockets.forEach(socket => {
      if (socket.connected) {
        socket.disconnect();
      }
    });
    this.sockets = [];
  }
}

// Run tests if called directly
if (require.main === module) {
  const testSuite = new RoomConnectionTestSuite();
  testSuite.runAllTests().catch(error => {
    console.error('Test suite execution failed:', error);
    process.exit(1);
  });
}

module.exports = { RoomConnectionTestSuite };
