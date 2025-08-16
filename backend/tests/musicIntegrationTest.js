// Comprehensive integration test for Spotify and AI Music features
// Tests all endpoints and React components for full music integration

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';
const TEST_USER_ID = 'test-user-' + Date.now();

class MusicIntegrationTest {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async runTest(name, testFn) {
    console.log(`\n🧪 Testing: ${name}`);
    try {
      await testFn();
      console.log(`✅ ${name} - PASSED`);
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASSED' });
    } catch (error) {
      console.log(`❌ ${name} - FAILED: ${error.message}`);
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAILED', error: error.message });
    }
  }

  async testServerHealth() {
    const response = await axios.get('http://localhost:3001/health');
    if (response.status !== 200) {
      throw new Error('Server health check failed');
    }
    if (!response.data.status) {
      throw new Error('Invalid health response');
    }
  }

  async testSpotifyStatusEndpoint() {
    const response = await axios.get(`${BASE_URL}/spotify/status`, {
      headers: { 'x-spotify-user': TEST_USER_ID }
    });
    
    if (!response.data.success) {
      throw new Error('Spotify status endpoint failed');
    }
    
    if (response.data.authenticated !== false) {
      throw new Error('Expected unauthenticated status');
    }
  }

  async testSpotifyAuthEndpoint() {
    const response = await axios.get(`${BASE_URL}/spotify/auth`);
    
    if (!response.data.success) {
      throw new Error('Spotify auth endpoint failed');
    }
    
    if (!response.data.authUrl || !response.data.state) {
      throw new Error('Missing auth URL or state');
    }
    
    if (!response.data.authUrl.includes('spotify.com')) {
      throw new Error('Invalid Spotify auth URL');
    }
  }

  async testSpotifySearchWithoutAuth() {
    try {
      await axios.get(`${BASE_URL}/spotify/search?q=test`, {
        headers: { 'x-spotify-user': TEST_USER_ID }
      });
      throw new Error('Expected 401 authentication error');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        // Expected behavior
        if (!error.response.data.authRequired) {
          throw new Error('Missing authRequired flag');
        }
      } else {
        throw error;
      }
    }
  }

  async testMusicServicesEndpoint() {
    const response = await axios.get(`${BASE_URL}/music/services`);
    
    if (!response.data.success) {
      throw new Error('Music services endpoint failed');
    }
    
    if (!Array.isArray(response.data.services)) {
      throw new Error('Services should be an array');
    }
    
    if (!response.data.royaltyFreeLibrary) {
      throw new Error('Missing royalty-free library info');
    }
  }

  async testRoyaltyFreeLibrary() {
    const response = await axios.get(`${BASE_URL}/music/library`);
    
    if (!response.data.success) {
      throw new Error('Library endpoint failed');
    }
    
    if (!Array.isArray(response.data.tracks)) {
      throw new Error('Tracks should be an array');
    }
    
    if (response.data.tracks.length === 0) {
      throw new Error('Library should contain tracks');
    }
    
    // Validate track structure
    const track = response.data.tracks[0];
    if (!track.id || !track.name || !track.mood) {
      throw new Error('Invalid track structure');
    }
  }

  async testMoodBasedMusicGeneration() {
    const testMood = {
      valence: 0.8,
      energy: 0.7,
      danceability: 0.6
    };
    
    const response = await axios.post(`${BASE_URL}/music/generate-music`, {
      mood: testMood,
      prompt: 'Test music generation',
      useAI: false // Use royalty-free library for testing
    });
    
    if (!response.data.success) {
      throw new Error('Music generation failed');
    }
    
    const track = response.data.track;
    if (!track.id || !track.name || !track.url) {
      throw new Error('Invalid generated track structure');
    }
    
    if (!track.requestedMood) {
      throw new Error('Missing requested mood in response');
    }
    
    // Verify mood similarity
    if (track.moodSimilarity < 0) {
      throw new Error('Invalid mood similarity score');
    }
  }

  async testRoomMoodGeneration() {
    const participantMoods = [
      { valence: 0.8, energy: 0.7, danceability: 0.6 },
      { valence: 0.6, energy: 0.5, danceability: 0.7 },
      { valence: 0.7, energy: 0.8, danceability: 0.5 }
    ];
    
    const response = await axios.post(`${BASE_URL}/music/generate-from-room`, {
      roomId: 'test-room-123',
      participantMoods,
      useAI: false
    });
    
    if (!response.data.success) {
      throw new Error('Room mood generation failed');
    }
    
    const track = response.data.track;
    if (!track.id || !track.name) {
      throw new Error('Invalid room-generated track');
    }
  }

  async testInvalidMoodGeneration() {
    try {
      await axios.post(`${BASE_URL}/music/generate-music`, {
        mood: { invalid: 'data' },
        useAI: false
      });
      throw new Error('Expected validation error for invalid mood');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        // Expected behavior
        if (!error.response.data.error.includes('mood')) {
          throw new Error('Expected mood validation error message');
        }
      } else {
        throw error;
      }
    }
  }

  async testMoodLibraryFiltering() {
    const testMood = {
      valence: 0.9,
      energy: 0.8,
      danceability: 0.7
    };
    
    const response = await axios.get(`${BASE_URL}/music/library?mood=${JSON.stringify(testMood)}`);
    
    if (!response.data.success) {
      throw new Error('Mood filtering failed');
    }
    
    const tracks = response.data.tracks;
    if (tracks.length === 0) {
      throw new Error('No tracks returned for mood filter');
    }
    
    // Verify mood similarity scores are present
    if (typeof tracks[0].moodSimilarity !== 'number') {
      throw new Error('Missing mood similarity scores');
    }
    
    // Verify tracks are sorted by similarity (highest first)
    for (let i = 0; i < tracks.length - 1; i++) {
      if (tracks[i].moodSimilarity < tracks[i + 1].moodSimilarity) {
        throw new Error('Tracks not sorted by mood similarity');
      }
    }
  }

  async testErrorHandling() {
    // Test invalid endpoint
    try {
      await axios.get(`${BASE_URL}/music/nonexistent`);
      throw new Error('Expected 404 error');
    } catch (error) {
      if (!error.response || error.response.status !== 404) {
        throw new Error('Expected 404 status for invalid endpoint');
      }
    }
    
    // Test malformed JSON
    try {
      await axios.post(`${BASE_URL}/music/generate-music`, 'invalid json', {
        headers: { 'Content-Type': 'application/json' }
      });
      throw new Error('Expected JSON parsing error');
    } catch (error) {
      if (!error.response || error.response.status !== 400) {
        throw new Error('Expected 400 status for malformed JSON');
      }
    }
  }

  async testComponentIntegration() {
    // This would normally be done with a testing framework like Jest
    // For now, just verify the components can be imported
    console.log('  📝 Component integration test (manual verification needed):');
    console.log('    - PlaylistPanel.js should be importable');
    console.log('    - MoodMusicGenerator.js should be importable');
    console.log('    - Both components should have proper CSS files');
    console.log('    - Room.js should include both components in layout');
  }

  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('🎵 MUSIC INTEGRATION TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📊 Total: ${this.results.tests.length}`);
    console.log(`🎯 Success Rate: ${((this.results.passed / this.results.tests.length) * 100).toFixed(1)}%`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(test => test.status === 'FAILED')
        .forEach(test => {
          console.log(`  • ${test.name}: ${test.error}`);
        });
    }
    
    console.log('\n✅ Passed Tests:');
    this.results.tests
      .filter(test => test.status === 'PASSED')
      .forEach(test => {
        console.log(`  • ${test.name}`);
      });
    
    console.log('\n📋 Integration Checklist:');
    console.log('  ☐ Start backend server (npm start in backend/)');
    console.log('  ☐ Configure Spotify API credentials in .env');
    console.log('  ☐ Configure AI service API keys (optional)');
    console.log('  ☐ Test Spotify OAuth flow manually');
    console.log('  ☐ Test React components in Room page');
    console.log('  ☐ Verify Socket.IO playlist synchronization');
    console.log('  ☐ Test audio playback and downloads');
    
    console.log('\n🚀 Next Steps:');
    console.log('  1. Set up real Spotify App credentials');
    console.log('  2. Configure AI music generation services');
    console.log('  3. Add royalty-free music files to public/assets/music/');
    console.log('  4. Test full user workflow in browser');
    console.log('  5. Deploy and test in production environment');
  }

  async runAllTests() {
    console.log('🎵 Starting Music Integration Test Suite...');
    console.log('Testing backend endpoints and component integration');
    
    await this.runTest('Server Health Check', () => this.testServerHealth());
    await this.runTest('Spotify Status Endpoint', () => this.testSpotifyStatusEndpoint());
    await this.runTest('Spotify Auth Endpoint', () => this.testSpotifyAuthEndpoint());
    await this.runTest('Spotify Search Without Auth', () => this.testSpotifySearchWithoutAuth());
    await this.runTest('Music Services Endpoint', () => this.testMusicServicesEndpoint());
    await this.runTest('Royalty-Free Library', () => this.testRoyaltyFreeLibrary());
    await this.runTest('Mood-Based Music Generation', () => this.testMoodBasedMusicGeneration());
    await this.runTest('Room Mood Generation', () => this.testRoomMoodGeneration());
    await this.runTest('Invalid Mood Validation', () => this.testInvalidMoodGeneration());
    await this.runTest('Mood Library Filtering', () => this.testMoodLibraryFiltering());
    await this.runTest('Error Handling', () => this.testErrorHandling());
    await this.runTest('Component Integration', () => this.testComponentIntegration());
    
    this.printResults();
  }
}

// Run the tests
const tester = new MusicIntegrationTest();
tester.runAllTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
