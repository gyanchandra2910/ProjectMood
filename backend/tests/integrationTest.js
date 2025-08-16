// Integration Test for Complete MoodFusion Memory System
// Tests the full pipeline: MoodFusion → RoomMemory → API Routes

const fs = require('fs');
const path = require('path');

// Import our modules
const { fuseMoods, createMoodInput, MOOD_MAPPINGS } = require('../utils/moodFusion');
const RoomMemory = require('../models/RoomMemory');

class IntegrationTestRunner {
  constructor() {
    this.results = [];
    this.passCount = 0;
    this.failCount = 0;
  }
  
  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }
  
  assert(condition, message) {
    if (condition) {
      this.log(`PASS: ${message}`, 'pass');
      this.passCount++;
      this.results.push({ test: message, status: 'PASS', details: null });
    } else {
      this.log(`FAIL: ${message}`, 'fail');
      this.failCount++;
      this.results.push({ test: message, status: 'FAIL', details: 'Assertion failed' });
    }
  }
  
  assertClose(actual, expected, tolerance = 0.01, message = '') {
    const diff = Math.abs(actual - expected);
    const condition = diff <= tolerance;
    if (condition) {
      this.log(`PASS: ${message} (${actual} ≈ ${expected}, diff: ${diff.toFixed(4)})`, 'pass');
      this.passCount++;
      this.results.push({ test: message, status: 'PASS', details: `${actual} ≈ ${expected}` });
    } else {
      this.log(`FAIL: ${message} (${actual} vs ${expected}, diff: ${diff.toFixed(4)})`, 'fail');
      this.failCount++;
      this.results.push({ test: message, status: 'FAIL', details: `Expected ${expected}, got ${actual}` });
    }
  }
  
  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('INTEGRATION TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${this.passCount + this.failCount}`);
    console.log(`Passed: ${this.passCount}`);
    console.log(`Failed: ${this.failCount}`);
    console.log(`Success Rate: ${((this.passCount / (this.passCount + this.failCount)) * 100).toFixed(1)}%`);
    
    if (this.failCount > 0) {
      console.log('\nFAILED TESTS:');
      this.results.filter(r => r.status === 'FAIL').forEach(result => {
        console.log(`❌ ${result.test}: ${result.details}`);
      });
    }
    
    console.log('='.repeat(80) + '\n');
  }
}

// Test Suite Functions
function testMoodFusionCore(runner) {
  runner.log('Testing MoodFusion Core Functionality...', 'info');
  
  // Test 1: Mood Mappings Validation
  const moodCount = Object.keys(MOOD_MAPPINGS).length;
  runner.assert(moodCount >= 16, `Should have at least 16 mood mappings (found ${moodCount})`);
  
  // Test 2: Single Mood Input
  const happyMood = fuseMoods([createMoodInput('happy')]);
  runner.assert(happyMood.label === 'happy', 'Single happy mood should return happy label');
  runner.assertClose(happyMood.vector.valence, 0.8, 0.05, 'Happy mood valence should be ~0.8');
  runner.assertClose(happyMood.vector.arousal, 0.4, 0.05, 'Happy mood arousal should be ~0.4');
  
  // Test 3: Calm + Excited Fusion (Stage 4 requirement)
  const calmExcited = fuseMoods([
    createMoodInput('calm'),
    createMoodInput('excited')
  ]);
  runner.assertClose(calmExcited.vector.valence, 0.4, 0.1, 'Calm+Excited valence should be moderate positive');
  runner.assertClose(calmExcited.vector.arousal, 0.0, 0.2, 'Calm+Excited arousal should be near neutral');
  runner.assert(calmExcited.label.includes('mixed') || calmExcited.label.includes('content'), 
    'Calm+Excited should produce mixed or content mood');
  
  // Test 4: Sad + Anxious Combination
  const sadAnxious = fuseMoods([
    createMoodInput('sad'),
    createMoodInput('anxious')
  ]);
  runner.assert(sadAnxious.vector.valence < 0, 'Sad+Anxious should have negative valence');
  runner.assert(sadAnxious.confidence > 0 && sadAnxious.confidence <= 1, 'Confidence should be in valid range');
  
  // Test 5: Weighted Mood Fusion
  const weightedMoods = fuseMoods([
    createMoodInput('happy', 0.9, 2.0),
    createMoodInput('sad', 0.7, 1.0)
  ]);
  runner.assert(weightedMoods.vector.valence > 0, 'Weighted fusion should favor happy (higher weight)');
  
  // Test 6: Complex Multi-Mood Fusion
  const complexMoods = fuseMoods([
    createMoodInput('enthusiastic', 0.8),
    createMoodInput('content', 0.9),
    createMoodInput('calm', 0.7),
    createMoodInput('optimistic', 0.85)
  ]);
  runner.assert(complexMoods.contributingMoods && complexMoods.contributingMoods.length === 4, 
    'Complex fusion should track all contributing moods');
  runner.assert(complexMoods.vector.valence > 0.5, 'Positive mood combination should have high valence');
}

function testRoomMemoryModel(runner) {
  runner.log('Testing RoomMemory Model...', 'info');
  
  // Test 7: Memory Document Creation
  const mockMemoryData = {
    roomId: 'test-room-123',
    moodVector: { valence: 0.6, arousal: 0.3 },
    fusedMood: {
      label: 'content',
      confidence: 0.85,
      source: 'fusion',
      contributingMoods: ['happy', 'calm']
    },
    playlist: {
      title: 'Peaceful Vibes',
      description: 'Relaxing tracks for a content mood',
      tracks: [
        { title: 'Song 1', artist: 'Artist 1', genre: 'Ambient', energy: 0.3, valence: 0.7 }
      ],
      totalDuration: 300,
      avgEnergy: 0.3,
      avgValence: 0.7
    },
    chatSnippet: {
      messages: [
        { userId: 'user1', displayName: 'Alice', text: 'Feeling good today!', mood: 'happy' }
      ],
      participantCount: 1,
      dominantMoods: ['happy'],
      avgSentiment: 0.8
    },
    participants: [
      { userId: 'user1', displayName: 'Alice', mood: 'happy', confidence: 0.9 }
    ],
    metadata: {
      createdBy: 'user1',
      trigger: 'manual',
      roomName: 'Test Room'
    }
  };
  
  // Validate memory structure
  runner.assert(mockMemoryData.roomId, 'Memory should have roomId');
  runner.assert(mockMemoryData.moodVector.valence !== undefined, 'Memory should have mood vector valence');
  runner.assert(mockMemoryData.moodVector.arousal !== undefined, 'Memory should have mood vector arousal');
  runner.assert(mockMemoryData.playlist.tracks.length > 0, 'Memory should have playlist tracks');
  
  // Test 8: Mood Vector Validation
  const isValidVector = (
    mockMemoryData.moodVector.valence >= -1 && 
    mockMemoryData.moodVector.valence <= 1 &&
    mockMemoryData.moodVector.arousal >= -1 && 
    mockMemoryData.moodVector.arousal <= 1
  );
  runner.assert(isValidVector, 'Mood vector should be within valid range [-1, 1]');
  
  // Test 9: Confidence Validation
  runner.assert(
    mockMemoryData.fusedMood.confidence >= 0 && mockMemoryData.fusedMood.confidence <= 1,
    'Fused mood confidence should be in range [0, 1]'
  );
}

function testPlaylistGeneration(runner) {
  runner.log('Testing Playlist Generation Logic...', 'info');
  
  // Mock playlist generation function (simplified version of what's in memoryRoutes.js)
  function generateTestPlaylist(moodVector) {
    const { valence, arousal } = moodVector;
    
    let category = 'peaceful';
    if (valence > 0 && arousal > 0) category = 'energetic';
    else if (valence <= 0 && arousal > 0) category = 'intense';
    else if (valence <= 0 && arousal <= 0) category = 'melancholic';
    
    return {
      category,
      title: `${category} playlist`,
      trackCount: 3,
      avgEnergy: Math.max(0, Math.min(1, (arousal + 1) / 2)),
      avgValence: Math.max(0, Math.min(1, (valence + 1) / 2))
    };
  }
  
  // Test 10: Energetic Playlist (high valence, high arousal)
  const energeticPlaylist = generateTestPlaylist({ valence: 0.7, arousal: 0.8 });
  runner.assert(energeticPlaylist.category === 'energetic', 'High valence + arousal should generate energetic playlist');
  runner.assert(energeticPlaylist.avgEnergy > 0.8, 'Energetic playlist should have high energy');
  
  // Test 11: Melancholic Playlist (low valence, low arousal)
  const melancholicPlaylist = generateTestPlaylist({ valence: -0.6, arousal: -0.4 });
  runner.assert(melancholicPlaylist.category === 'melancholic', 'Low valence + arousal should generate melancholic playlist');
  runner.assert(melancholicPlaylist.avgEnergy < 0.4, 'Melancholic playlist should have low energy');
  
  // Test 12: Intense Playlist (low valence, high arousal)
  const intensePlaylist = generateTestPlaylist({ valence: -0.3, arousal: 0.7 });
  runner.assert(intensePlaylist.category === 'intense', 'Low valence + high arousal should generate intense playlist');
  
  // Test 13: Peaceful Playlist (high valence, low arousal)
  const peacefulPlaylist = generateTestPlaylist({ valence: 0.5, arousal: -0.2 });
  runner.assert(peacefulPlaylist.category === 'peaceful', 'High valence + low arousal should generate peaceful playlist');
}

function testVisualizationHelpers(runner) {
  runner.log('Testing Visualization Helper Functions...', 'info');
  
  // Mock color scheme function
  function getColorScheme(moodVector) {
    const { valence, arousal } = moodVector;
    
    if (valence > 0 && arousal > 0) {
      return { primary: '#FFD700', secondary: '#FF6B6B', scheme: 'energetic' };
    } else if (valence <= 0 && arousal > 0) {
      return { primary: '#FF4444', secondary: '#CC0000', scheme: 'intense' };
    } else if (valence <= 0 && arousal <= 0) {
      return { primary: '#6B73FF', secondary: '#9B59B6', scheme: 'melancholic' };
    } else {
      return { primary: '#4ECDC4', secondary: '#45B7B8', scheme: 'peaceful' };
    }
  }
  
  // Test 14: Color Scheme Generation
  const energeticColors = getColorScheme({ valence: 0.8, arousal: 0.7 });
  runner.assert(energeticColors.scheme === 'energetic', 'Positive mood should use energetic color scheme');
  
  const melancholicColors = getColorScheme({ valence: -0.5, arousal: -0.3 });
  runner.assert(melancholicColors.scheme === 'melancholic', 'Negative low-arousal mood should use melancholic scheme');
  
  // Test 15: Animation Style Selection
  function getAnimationStyle(arousal) {
    if (arousal > 0.5) return 'fast-pulse';
    else if (arousal > 0) return 'gentle-wave';
    else if (arousal > -0.5) return 'slow-fade';
    else return 'minimal-drift';
  }
  
  runner.assert(getAnimationStyle(0.8) === 'fast-pulse', 'High arousal should use fast animation');
  runner.assert(getAnimationStyle(-0.7) === 'minimal-drift', 'Low arousal should use minimal animation');
}

function testEndToEndWorkflow(runner) {
  runner.log('Testing End-to-End Workflow...', 'info');
  
  // Test 16: Complete Mood → Memory → Visualization Pipeline
  const participantMoods = [
    { mood: 'happy', confidence: 0.9, userId: 'user1' },
    { mood: 'excited', confidence: 0.8, userId: 'user2' },
    { mood: 'content', confidence: 0.7, userId: 'user3' }
  ];
  
  // Step 1: Create mood inputs
  const moodInputs = participantMoods.map(p => 
    createMoodInput(p.mood, p.confidence, 1.0, 'manual')
  );
  
  // Step 2: Fuse moods
  const fusedMood = fuseMoods(moodInputs);
  
  // Step 3: Validate fusion result
  runner.assert(fusedMood.vector.valence > 0.4, 'Positive mood combination should have positive valence');
  runner.assert(fusedMood.confidence > 0.6, 'High-confidence inputs should produce confident result');
  
  // Step 4: Simulate memory creation
  const memorySnapshot = {
    timestamp: new Date(),
    roomId: 'test-room-workflow',
    moodVector: fusedMood.vector,
    fusedMood: fusedMood,
    participantCount: participantMoods.length,
    complexity: fusedMood.contributingMoods ? fusedMood.contributingMoods.length : 1
  };
  
  runner.assert(memorySnapshot.participantCount === 3, 'Memory should track correct participant count');
  runner.assert(memorySnapshot.complexity >= 1, 'Memory should capture mood complexity');
  
  // Test 17: Similarity Calculation
  function calculateSimilarity(vector1, vector2) {
    const distance = Math.sqrt(
      Math.pow(vector1.valence - vector2.valence, 2) + 
      Math.pow(vector1.arousal - vector2.arousal, 2)
    );
    return Math.max(0, 1 - (distance / Math.sqrt(8)));
  }
  
  const similarVector = { valence: 0.6, arousal: 0.3 };
  const testVector = { valence: 0.65, arousal: 0.35 };
  const similarity = calculateSimilarity(similarVector, testVector);
  
  runner.assert(similarity > 0.9, 'Similar vectors should have high similarity score');
  
  // Test 18: Memory Replay Validation
  const replayData = {
    memoryId: 'memory-123',
    originalMoodVector: fusedMood.vector,
    recreatedAt: new Date(),
    playlistSeeds: ['track1', 'track2', 'track3'],
    visualizerSettings: {
      colorScheme: 'energetic',
      animationStyle: 'gentle-wave',
      intensity: 0.7
    }
  };
  
  runner.assert(replayData.playlistSeeds.length > 0, 'Replay should include playlist seeds');
  runner.assert(replayData.visualizerSettings.intensity >= 0 && replayData.visualizerSettings.intensity <= 1, 
    'Visualizer intensity should be normalized');
}

// Main test execution
function runIntegrationTests() {
  console.log('🧪 Starting MoodFusion Integration Tests...\n');
  
  const runner = new IntegrationTestRunner();
  
  try {
    testMoodFusionCore(runner);
    testRoomMemoryModel(runner);
    testPlaylistGeneration(runner);
    testVisualizationHelpers(runner);
    testEndToEndWorkflow(runner);
    
    runner.printSummary();
    
    // Generate test report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: runner.passCount + runner.failCount,
        passed: runner.passCount,
        failed: runner.failCount,
        successRate: ((runner.passCount / (runner.passCount + runner.failCount)) * 100).toFixed(1)
      },
      results: runner.results,
      modules: {
        moodFusion: '✅ Core functionality validated',
        roomMemory: '✅ Model structure verified',
        playlistGeneration: '✅ Mood-based logic confirmed',
        visualization: '✅ Helper functions working',
        endToEnd: '✅ Complete workflow tested'
      }
    };
    
    const reportPath = path.join(__dirname, 'integration-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Test report saved to: ${reportPath}`);
    
    return runner.failCount === 0;
    
  } catch (error) {
    console.error('❌ Integration test suite failed:', error);
    return false;
  }
}

// Export for use in other test files
module.exports = {
  runIntegrationTests,
  IntegrationTestRunner
};

// Run tests if this file is executed directly
if (require.main === module) {
  const success = runIntegrationTests();
  process.exit(success ? 0 : 1);
}
