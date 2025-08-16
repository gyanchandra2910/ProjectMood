// Simple server test to verify basic Express functionality
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);
const PORT = 8080;

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Simple server is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/spotify/status', (req, res) => {
  res.json({
    success: true,
    authenticated: false,
    message: 'Not authenticated with Spotify'
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Simple server running on port ${PORT}`);
  console.log(`🌐 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔍 Server listening on 127.0.0.1:${PORT}`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
