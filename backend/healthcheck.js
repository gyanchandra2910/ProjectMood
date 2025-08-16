/**
 * Health Check Script for Docker Container
 * Validates that the application is running correctly
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  console.log(`Health check status: ${res.statusCode}`);
  
  if (res.statusCode === 200) {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const health = JSON.parse(data);
        
        if (health.status === 'healthy') {
          console.log('✅ Application is healthy');
          process.exit(0);
        } else {
          console.log('❌ Application reports unhealthy status:', health);
          process.exit(1);
        }
      } catch (error) {
        console.log('❌ Invalid health check response:', error.message);
        process.exit(1);
      }
    });
  } else {
    console.log('❌ Health check failed with status:', res.statusCode);
    process.exit(1);
  }
});

req.on('error', (error) => {
  console.log('❌ Health check request failed:', error.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.log('❌ Health check timed out');
  req.destroy();
  process.exit(1);
});

req.end();
