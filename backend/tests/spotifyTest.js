// Simple API test client for Spotify routes
// Tests the Spotify OAuth and search endpoints

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testSpotifyAPI() {
  console.log('🎵 Testing Spotify API Integration...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing server health...');
    const healthResponse = await axios.get('http://localhost:3001/health');
    console.log('✅ Health check passed:', healthResponse.data.status);
    
    // Test 2: Spotify status (should show not authenticated)
    console.log('\n2. Testing Spotify status...');
    const statusResponse = await axios.get(`${BASE_URL}/spotify/status`);
    console.log('✅ Spotify status:', statusResponse.data);
    
    // Test 3: Get Spotify auth URL
    console.log('\n3. Getting Spotify authorization URL...');
    const authResponse = await axios.get(`${BASE_URL}/spotify/auth`);
    console.log('✅ Auth URL generated:', authResponse.data.success);
    console.log('📍 Authorization URL:', authResponse.data.authUrl);
    
    // Test 4: Test search without authentication (should fail gracefully)
    console.log('\n4. Testing search without authentication...');
    try {
      await axios.get(`${BASE_URL}/spotify/search?q=happy`);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Search correctly requires authentication:', error.response.data.error);
      } else {
        throw error;
      }
    }
    
    // Test 5: Test mood search without authentication (should fail gracefully)
    console.log('\n5. Testing mood search without authentication...');
    try {
      await axios.get(`${BASE_URL}/spotify/search-by-mood?valence=0.8&energy=0.7`);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Mood search correctly requires authentication:', error.response.data.error);
      } else {
        throw error;
      }
    }
    
    console.log('\n🎉 All Spotify API tests passed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Visit the authorization URL to complete OAuth flow');
    console.log('   2. Test authenticated endpoints with valid tokens');
    console.log('   3. Implement playlist management features');
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the tests
testSpotifyAPI();
