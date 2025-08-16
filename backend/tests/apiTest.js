// API Test Script for MoodFusion Endpoints
// Tests the complete Stage 4 implementation with real HTTP requests

const fs = require('fs');
const path = require('path');

// Simple HTTP client function (no external dependencies)
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const http = require('http');
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'api-test-user',
        'x-user-name': 'API Tester',
        ...options.headers
      }
    };
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ 
            status: res.statusCode, 
            data: jsonData, 
            headers: res.headers 
          });
        } catch (error) {
          resolve({ 
            status: res.statusCode, 
            data: data, 
            headers: res.headers 
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.data) {
      req.write(JSON.stringify(options.data));
    }
    
    req.end();
  });
}

class APITestRunner {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.results = [];
    this.passCount = 0;
    this.failCount = 0;
  }
  
  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${timestamp.slice(11, 19)}] ${message}`);
  }
  
  async test(name, testFn) {
    try {
      this.log(`Testing: ${name}...`);
      await testFn();
      this.log(`PASS: ${name}`, 'pass');
      this.passCount++;
      this.results.push({ test: name, status: 'PASS', details: null });
    } catch (error) {
      this.log(`FAIL: ${name} - ${error.message}`, 'fail');
      this.failCount++;
      this.results.push({ test: name, status: 'FAIL', details: error.message });
    }
  }
  
  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }
  
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    return await makeRequest(url, options);
  }
  
  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('API TEST SUMMARY');
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

async function runAPITests() {
  console.log('🧪 Starting MoodFusion API Tests...\n');
  
  const tester = new APITestRunner();
  
  // Test 1: Health Check
  await tester.test('Health Check Endpoint', async () => {
    const response = await tester.request('/api/health');
    tester.assert(response.status === 200, `Expected status 200, got ${response.status}`);
    tester.assert(response.data.status === 'healthy', 'Server should report healthy status');
    tester.assert(response.data.features.moodFusion === '✅ Enabled', 'MoodFusion feature should be enabled');
  });
  
  // Test 2: Mood Fusion Examples
  await tester.test('Mood Fusion Examples Endpoint', async () => {
    const response = await tester.request('/api/mood/examples');
    tester.assert(response.status === 200, `Expected status 200, got ${response.status}`);
    tester.assert(response.data.success === true, 'Examples endpoint should return success');
    tester.assert(Array.isArray(response.data.examples), 'Should return array of examples');
    tester.assert(response.data.examples.length >= 3, 'Should have at least 3 examples');
  });
  
  // Test 3: Simple Mood Fusion
  await tester.test('Basic Mood Fusion', async () => {
    const response = await tester.request('/api/mood/fuse', {
      method: 'POST',
      data: {
        moodInputs: ['happy', 'excited']
      }
    });
    tester.assert(response.status === 200, `Expected status 200, got ${response.status}`);
    tester.assert(response.data.success === true, 'Mood fusion should succeed');
    tester.assert(response.data.result.vector, 'Should return mood vector');
    tester.assert(response.data.result.confidence >= 0 && response.data.result.confidence <= 1, 
      'Confidence should be between 0 and 1');
  });
  
  // Test 4: Complex Mood Fusion with Confidence
  await tester.test('Complex Mood Fusion', async () => {
    const response = await tester.request('/api/mood/fuse', {
      method: 'POST',
      data: {
        moodInputs: [
          { mood: 'happy', confidence: 0.9, weight: 2.0 },
          { mood: 'calm', confidence: 0.7, weight: 1.0 },
          { mood: 'content', confidence: 0.8, weight: 1.5 }
        ]
      }
    });
    tester.assert(response.status === 200, `Expected status 200, got ${response.status}`);
    tester.assert(response.data.success === true, 'Complex fusion should succeed');
    tester.assert(response.data.result.vector.valence > 0, 'Positive moods should have positive valence');
    tester.assert(response.data.input.moodCount === 3, 'Should process all 3 mood inputs');
  });
  
  // Test 5: Calm + Excited Stage 4 Requirement
  await tester.test('Stage 4: Calm + Excited Fusion', async () => {
    const response = await tester.request('/api/mood/fuse', {
      method: 'POST',
      data: {
        moodInputs: ['calm', 'excited']
      }
    });
    tester.assert(response.status === 200, `Expected status 200, got ${response.status}`);
    tester.assert(response.data.success === true, 'Calm + Excited fusion should succeed');
    
    const result = response.data.result;
    tester.assert(result.vector.valence > 0.5, 'Calm + Excited should have positive valence');
    tester.assert(Math.abs(result.vector.arousal) < 0.5, 'Arousal should be moderate (calm vs excited balance)');
    console.log(`   📊 Calm + Excited Result: ${result.label} (${result.vector.valence.toFixed(3)}, ${result.vector.arousal.toFixed(3)})`);
  });
  
  // Test 6: Sad + Anxious Combination
  await tester.test('Stage 4: Sad + Anxious Fusion', async () => {
    const response = await tester.request('/api/mood/fuse', {
      method: 'POST',
      data: {
        moodInputs: ['sad', 'anxious']
      }
    });
    tester.assert(response.status === 200, `Expected status 200, got ${response.status}`);
    tester.assert(response.data.success === true, 'Sad + Anxious fusion should succeed');
    
    const result = response.data.result;
    tester.assert(result.vector.valence < 0, 'Sad + Anxious should have negative valence');
    tester.assert(result.vector.arousal > -0.5, 'Should maintain some arousal from anxious component');
    console.log(`   📊 Sad + Anxious Result: ${result.label} (${result.vector.valence.toFixed(3)}, ${result.vector.arousal.toFixed(3)})`);
  });
  
  // Test 7: Invalid Input Handling
  await tester.test('Invalid Input Handling', async () => {
    const response = await tester.request('/api/mood/fuse', {
      method: 'POST',
      data: {
        moodInputs: []
      }
    });
    tester.assert(response.status === 400, 'Empty input should return 400 status');
    tester.assert(response.data.error, 'Should return error message for invalid input');
  });
  
  // Test 8: Unknown Mood Handling
  await tester.test('Unknown Mood Handling', async () => {
    const response = await tester.request('/api/mood/fuse', {
      method: 'POST',
      data: {
        moodInputs: ['nonexistent-mood', 'happy']
      }
    });
    // This might succeed with a fallback or fail gracefully
    tester.assert([200, 400].includes(response.status), 'Should handle unknown mood gracefully');
  });
  
  // Test 9: Memory System Test (Mock Room Creation)
  await tester.test('Room Memory System Integration', async () => {
    // Since we don't have a real room, let's test the general structure
    // This would typically require setting up a mock room first
    const roomId = 'test-room-' + Date.now();
    
    // Test the memory creation endpoint structure
    const response = await tester.request(`/api/rooms/${roomId}/memory`, {
      method: 'POST',
      data: {
        trigger: 'api-test',
        tags: ['test', 'api-validation']
      }
    });
    
    // Expect it to fail gracefully since room doesn't exist
    tester.assert([404, 400, 401].includes(response.status), 
      'Should handle non-existent room appropriately');
    console.log(`   📊 Memory Test: Expected room-not-found (status ${response.status})`);
  });
  
  // Test 10: Performance and Response Time
  await tester.test('Performance Test', async () => {
    const startTime = Date.now();
    
    const response = await tester.request('/api/mood/fuse', {
      method: 'POST',
      data: {
        moodInputs: [
          'happy', 'excited', 'calm', 'content', 'optimistic',
          'peaceful', 'energetic', 'focused', 'enthusiastic'
        ]
      }
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    tester.assert(response.status === 200, 'Complex fusion should succeed');
    tester.assert(duration < 1000, `Response should be under 1s (was ${duration}ms)`);
    console.log(`   ⏱️  Complex 9-mood fusion: ${duration}ms`);
  });
  
  tester.printSummary();
  
  // Generate API test report
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: tester.baseUrl,
    summary: {
      total: tester.passCount + tester.failCount,
      passed: tester.passCount,
      failed: tester.failCount,
      successRate: ((tester.passCount / (tester.passCount + tester.failCount)) * 100).toFixed(1)
    },
    results: tester.results,
    endpoints: {
      health: '✅ Tested',
      moodFusion: '✅ Tested with multiple scenarios',
      examples: '✅ Tested',
      memorySystem: '🔄 Structure validated',
      errorHandling: '✅ Tested'
    }
  };
  
  const reportPath = path.join(__dirname, 'api-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📊 API test report saved to: ${reportPath}`);
  
  return tester.failCount === 0;
}

// Export for use in other test files
module.exports = {
  runAPITests,
  APITestRunner
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAPITests()
    .then(success => {
      console.log(success ? '🎉 All API tests passed!' : '❌ Some API tests failed.');
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ API test suite failed:', error);
      process.exit(1);
    });
}
