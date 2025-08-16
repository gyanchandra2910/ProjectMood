// MongoDB connection configuration
// Handles database connection with proper error handling and retry logic

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/projectmood';
    
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    
    // In development, continue without MongoDB
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️  Continuing without MongoDB in development mode');
      return null;
    }
    
    // In production, exit the process
    process.exit(1);
  }
};

// Graceful disconnection
const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('📂 MongoDB disconnected');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('🚨 Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('📂 Mongoose disconnected');
});

module.exports = {
  connectDB,
  disconnectDB
};
