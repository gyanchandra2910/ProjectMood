// Firebase JWT authentication middleware for Express routes
// Validates Firebase ID tokens and attaches user info to requests

const { getFirebaseAuth } = require('../firebase-admin');

// Middleware to verify Firebase ID token
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header. Expected "Bearer <token>"'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    if (!idToken) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing ID token'
      });
    }

    const firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Firebase Auth not initialized'
      });
    }

    // Verify the ID token
    const decodedToken = await firebaseAuth.verifyIdToken(idToken);
    
    // Attach user info to request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      displayName: decodedToken.name,
      photoURL: decodedToken.picture,
      authTime: decodedToken.auth_time,
      issuedAt: decodedToken.iat,
      expiresAt: decodedToken.exp
    };

    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'Token Expired',
        message: 'ID token has expired. Please sign in again.'
      });
    }
    
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        error: 'Token Revoked',
        message: 'ID token has been revoked. Please sign in again.'
      });
    }

    return res.status(401).json({
      error: 'Invalid Token',
      message: 'Failed to verify ID token'
    });
  }
};

// Middleware for optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    if (!idToken) {
      req.user = null;
      return next();
    }

    const firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth) {
      req.user = null;
      return next();
    }

    const decodedToken = await firebaseAuth.verifyIdToken(idToken);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      displayName: decodedToken.name,
      photoURL: decodedToken.picture,
      authTime: decodedToken.auth_time,
      issuedAt: decodedToken.iat,
      expiresAt: decodedToken.exp
    };

    next();
  } catch (error) {
    console.error('Optional auth failed:', error);
    req.user = null;
    next();
  }
};

// Middleware to check if user has specific claims/roles
const requireRole = (requiredRole) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const firebaseAuth = getFirebaseAuth();
      if (!firebaseAuth) {
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Firebase Auth not initialized'
        });
      }

      const userRecord = await firebaseAuth.getUser(req.user.uid);
      const customClaims = userRecord.customClaims || {};

      if (!customClaims.role || customClaims.role !== requiredRole) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Required role: ${requiredRole}`
        });
      }

      req.userRole = customClaims.role;
      next();
    } catch (error) {
      console.error('Role verification failed:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to verify user role'
      });
    }
  };
};

module.exports = {
  verifyFirebaseToken,
  optionalAuth,
  requireRole
};
