// Firebase Admin SDK configuration for server-side authentication
// Used for validating Firebase JWT tokens and accessing Firestore

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
  try {
    // In production, use service account key file or environment variables
    // For development, you can use the emulator or service account key
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      // Use service account key from environment variable
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    } else {
      // Use default credentials (works in Google Cloud environments)
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'projectmood-default'
      });
    }
    
    console.log('✅ Firebase Admin SDK initialized successfully');
    return admin;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    console.log('ℹ️  To use Firebase features, set up your Firebase service account key');
    return null;
  }
};

// Get Firebase Auth instance
const getFirebaseAuth = () => {
  try {
    return admin.auth();
  } catch (error) {
    console.error('Failed to get Firebase Auth instance:', error);
    return null;
  }
};

// Get Firestore instance
const getFirestore = () => {
  try {
    return admin.firestore();
  } catch (error) {
    console.error('Failed to get Firestore instance:', error);
    return null;
  }
};

module.exports = {
  initializeFirebase,
  getFirebaseAuth,
  getFirestore,
  admin
};
