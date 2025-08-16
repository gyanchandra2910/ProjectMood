# ProjectMood

A real-time communication application built with React, Tailwind CSS, Node.js, Express, Socket.IO, and Firebase Authentication.

## 🚀 Features

### Core Features
- **🔐 Firebase Authentication**: Email/password and Google sign-in
- **👤 User Profiles**: Personalized profiles stored in Firestore
- **🏠 Room System**: Create and join mood-sharing rooms with real-time updates
- **💬 Real-time Chat**: Authenticated instant messaging using Socket.IO
- **😊 Traditional Mood Selection**: 8 emoji-based mood options

### Stage 3: Advanced AI-Powered Mood Detection
- **🎤 Voice Mood Analysis**: 6-second audio recording with emotion detection
- **📷 Face Emotion Recognition**: Camera-based facial expression analysis
- **🔒 GDPR-Compliant Privacy**: Comprehensive consent management system
- **🤖 AI Integration Ready**: Extensible architecture for Whisper API and computer vision
- **📊 Mood Confidence Tracking**: AI-generated confidence scores for detected emotions
- **🛡️ Privacy-First Design**: Local processing with optional server enhancement

### Stage 4: Music Integration & Room Connections
- **🎵 Music Streaming Platform**: Mood-based music discovery and streaming
- **🏠 Room Connection System**: Connect multiple rooms with intelligent mood blending
- **🎯 DJ Battle Engine**: Real-time competitive music experiences with live voting
- **🔍 Ambient Room Matching**: Discover compatible rooms using cosine similarity algorithms
- **🌍 Cross-Room Communication**: Real-time chat and interaction between connected rooms
- **🎨 Mood Blending Algorithms**: Sophisticated audio analysis and mood fusion
- **👤 Anonymous Profile System**: Privacy-protected room discovery
- **📊 Engagement Analytics**: Track user engagement and battle performance

### Technical Features
- **🎨 Modern UI**: Clean and responsive design with Tailwind CSS
- **🛡️ Secure Backend**: Firebase JWT validation middleware
- **🚀 CI/CD Ready**: GitHub Actions workflow included
- **📊 Health Monitoring**: Built-in health check endpoints
- **📱 Progressive Enhancement**: Graceful fallbacks for unsupported features

## 🎵 Quick Start for Room Connections

For the new music integration and room connection features:

### Installation with Room Connections
```bash
# Use the handy starter script
node start.js install-deps

# Or manually:
cd backend && npm install
cd ../frontend && npm install --legacy-peer-deps
```

### Start with Music Features
```bash
# Terminal 1: Start Backend (includes Socket.IO for room connections)
node start.js start-server

# Terminal 2: Start Frontend (includes room connection UI)
node start.js start-frontend

# Terminal 3: Test the room connection demo
node start.js run-demo
```

### Room Connection Features
- **Room Merging**: Connect rooms and blend their moods intelligently
- **DJ Battles**: 90-second competitive music experiences
- **Ambient Matching**: Find compatible rooms automatically
- **Real-Time Collaboration**: Socket.IO powered interactions

For detailed documentation on room connections, see [Room Connections Documentation](docs/ROOM_CONNECTIONS.md).

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager
- Firebase project (free tier available)
- MongoDB (for room connections and music data)
- Optional: Spotify API keys for enhanced music features

## � Firebase Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Follow the setup wizard

### 2. Enable Authentication
1. In Firebase Console, go to **Authentication > Sign-in method**
2. Enable **Email/Password** and **Google** providers
3. For Google sign-in, configure OAuth consent screen

### 3. Create Firestore Database
1. Go to **Firestore Database**
2. Click "Create database"
3. Choose "Start in test mode" (configure security rules later)

### 4. Get Configuration Keys
1. Go to **Project Settings > General**
2. Scroll to "Your apps" section
3. Click "Web app" icon to create a web app
4. Copy the configuration object

### 5. Setup Service Account (Backend)
1. Go to **Project Settings > Service accounts**
2. Click "Generate new private key"
3. Download the JSON file
4. Keep it secure (never commit to version control)

## �🛠️ Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/gyanchandra2910/ProjectMood.git
cd ProjectMood
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
```

**Configure backend environment variables:**
```bash
# Edit .env file with your Firebase configuration
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
FIREBASE_PROJECT_ID=your-firebase-project-id

# Add your Firebase service account key (one line, escaped JSON)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}

# MongoDB for room connections and music data
MONGODB_URI=mongodb://localhost:27017/moodfusion

# Optional: Spotify API for enhanced music features
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
```

**Configure frontend environment variables:**
```bash
# Edit .env file with your Firebase web config
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abcdef

# Backend API endpoints
REACT_APP_API_URL=http://localhost:3001
REACT_APP_SOCKET_URL=http://localhost:3001
```

## 🏃‍♂️ Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

### Production Mode

**Backend:**
```bash
cd backend
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
# Serve the build folder with your preferred static server
```

## 📁 Project Structure

```
ProjectMood/
├── frontend/                     # React application
│   ├── public/                   # Static files
│   ├── src/
│   │   ├── components/           # React components
│   │   │   ├── Home.js          # Main dashboard with chat
│   │   │   ├── Login.js         # Authentication component
│   │   │   ├── Profile.js       # User profile management
│   │   │   ├── Room.js          # Room interface with music features
│   │   │   ├── RoomConnectionPanel.js # Room connection UI
│   │   │   ├── RoomConnectionPanel.css # Styling for connections
│   │   │   └── ProtectedRoute.js # Route protection
│   │   ├── contexts/
│   │   │   └── AuthContext.js   # Firebase auth context
│   │   ├── firebase.js          # Firebase client config
│   │   ├── App.js               # Main app with routing
│   │   ├── index.js             # Entry point
│   │   └── index.css            # Tailwind CSS imports
│   ├── .env.example             # Frontend environment template
│   └── package.json
├── backend/                      # Node.js/Express server
│   ├── middleware/
│   │   └── auth.js              # Firebase JWT middleware
│   ├── services/                # Business logic services
│   │   ├── roomConnection.js    # Room merging & DJ battles
│   │   ├── ambientMatching.js   # Room discovery algorithm
│   │   └── roomConnectionSockets.js # Real-time Socket.IO events
│   ├── routes/                  # API endpoints
│   │   └── roomConnectionRoutes.js # Room connection REST API
│   ├── models/                  # MongoDB schemas
│   ├── tests/                   # Test suites
│   │   └── roomConnectionTest.js # Comprehensive testing
│   ├── demo/                    # Demo scripts
│   │   └── roomConnectionDemo.js # Feature demonstration
│   ├── firebase-admin.js        # Firebase Admin SDK config
│   ├── app.js                   # Main server file with Socket.IO
│   ├── .env.example             # Backend environment template
│   └── package.json
├── docs/                        # Documentation
│   └── ROOM_CONNECTIONS.md     # Detailed room connection docs
├── .github/workflows/ci.yml      # GitHub Actions CI/CD
├── start.js                     # Project starter utility
├── README.md
└── LICENSE
```

## 🔌 API Endpoints

### Public Routes
- `GET /` - API information
- `GET /health` - Health check endpoint
- `GET /api/health` - Enhanced health check with system status

### Room Connection Routes
- `POST /api/rooms/connect` - Connect two rooms together
- `POST /api/rooms/disconnect` - Disconnect rooms
- `POST /api/rooms/battle/start` - Start a DJ battle between rooms
- `POST /api/rooms/battle/vote` - Vote in an active DJ battle
- `GET /api/rooms/ambient/matches/:roomId` - Find compatible rooms
- `POST /api/rooms/ambient/register` - Register room for ambient matching
- `POST /api/rooms/ambient/request` - Request connection to a room

### Protected Routes (require Firebase JWT)
- `GET /api/profile` - Get user profile from Firestore
- `GET /api/users` - Get list of users (limited data)

### Socket.IO Events

#### Original Events
- `connection` - Client connects (with optional authentication)
- `message` - Send/receive messages (enhanced with user info)
- `join-room` - Join a specific room (authenticated users only)
- `leave-room` - Leave a room (authenticated users only)
- `disconnect` - Client disconnects

#### Room Connection Events
**Client → Server:**
- `join-room` - Join a music room
- `battle-vote` - Vote in a DJ battle
- `request-connection` - Request room connection
- `send-cross-room-message` - Send message to connected room

**Server → Client:**
- `room-connected` - Room connection established
- `battle-started` - DJ battle has begun
- `battle-vote-update` - Vote count updates
- `battle-ended` - DJ battle finished with results
- `ambient-match-found` - New compatible room discovered
- `cross-room-message` - Message from connected room
- `connection-request` - Incoming connection request

## 🔐 Authentication Flow

1. **Frontend**: User signs in with email/password or Google
2. **Firebase**: Issues JWT ID token
3. **Frontend**: Stores token and user state in React context
4. **API Calls**: Include `Authorization: Bearer <token>` header
5. **Backend**: Validates JWT with Firebase Admin SDK
6. **Socket.IO**: Authenticates connection with token

## 🧪 Testing

**Frontend:**
```bash
cd frontend
npm test
```

**Backend:**
```bash
cd backend
npm test
```

**Room Connection Features:**
```bash
# Run comprehensive room connection tests
node start.js run-tests

# Run interactive demo
node start.js run-demo

# Check system health
node start.js health-check
```

**Test Authentication:**
```bash
# Test health endpoint
curl http://localhost:3001/health

# Test enhanced health endpoint
curl http://localhost:3001/api/health

# Test protected endpoint (requires valid JWT)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:3001/api/profile

# Test room connection (requires authentication)
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"sourceRoomId":"room1","targetRoomId":"room2","connectionType":"merge"}' \
  http://localhost:3001/api/rooms/connect
```

## 🚀 Deployment

### Frontend Deployment (Vercel/Netlify)
1. Connect your GitHub repository
2. Set environment variables in deployment settings
3. Deploy automatically on push to main branch

### Backend Deployment (Railway/Heroku)
1. Connect your GitHub repository
2. Set environment variables including Firebase service account
3. Deploy automatically on push to main branch

### Environment Variables for Production

**Frontend:**
- All `REACT_APP_FIREBASE_*` variables
- Update `REACT_APP_API_URL` to your backend URL

**Backend:**
- `PORT`, `NODE_ENV=production`
- `CORS_ORIGIN` (your frontend URL)
- `FIREBASE_SERVICE_ACCOUNT_KEY` (complete JSON as string)
- `FIREBASE_PROJECT_ID`

## 🛡️ Security Considerations

- **Firebase Security Rules**: Configure Firestore security rules for production
- **CORS**: Update CORS settings for production domains
- **JWT Validation**: All protected routes validate Firebase JWT tokens
- **Environment Variables**: Never commit `.env` files or Firebase keys
- **Service Account**: Keep Firebase service account key secure

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🛠️ Built With

- **Frontend**: React, Tailwind CSS, Socket.IO Client, Firebase Auth
- **Backend**: Node.js, Express, Socket.IO, Firebase Admin SDK
- **Database**: Firebase Firestore
- **Authentication**: Firebase Authentication
- **Development**: ESLint, Prettier, Nodemon
- **CI/CD**: GitHub Actions

## 🆘 Troubleshooting

### Common Issues

1. **Firebase Authentication not working**
   - Check if Firebase config is correct
   - Ensure Firebase project has Authentication enabled
   - Verify API keys are not restricted

2. **Backend Firebase errors**
   - Ensure service account key is valid JSON
   - Check if Firebase project ID is correct
   - Verify service account has necessary permissions

3. **CORS errors**
   - Update CORS_ORIGIN in backend .env
   - Check if frontend URL matches CORS settings

4. **Socket.IO connection issues**
   - Verify backend server is running
   - Check if CORS is properly configured for Socket.IO
   - Ensure authentication tokens are valid

5. **Room connection issues**
   - Verify MongoDB is running and connected
   - Check Socket.IO client-server connection
   - Ensure rooms exist before attempting connections

6. **npm install issues with room connections**
   - Use `--legacy-peer-deps` flag: `npm install --legacy-peer-deps`
   - This resolves React version conflicts with Socket.IO

## � Privacy & GDPR Compliance

ProjectMood takes user privacy seriously and implements GDPR-compliant features:

### Privacy Features
- **🛡️ Consent Management**: Clear opt-in for camera and microphone access
- **📋 Granular Permissions**: Session-only vs. persistent data storage options
- **🗑️ Data Deletion**: Users can request deletion of all stored data
- **📤 Data Export**: GDPR-compliant data portability features
- **🔄 Withdrawal Rights**: Users can withdraw consent at any time

### Data Processing
- **🏠 Local-First**: Face detection runs client-side by default
- **🎤 Audio Privacy**: Voice recordings processed and deleted immediately
- **📷 Image Privacy**: Photos never stored unless explicitly consented
- **📊 Anonymized Analytics**: Only aggregated, non-personal data stored

### Default Settings
- Audio files: **Not stored** (processing only)
- Face images: **Not stored** (local processing)
- Mood data: **Session-only** unless user opts for personalization

## 🤖 AI Integration (Optional)

The application is designed to be enhanced with third-party AI services:

### Voice Processing
- **OpenAI Whisper**: Speech-to-text and emotion analysis
- **Google Speech API**: Alternative speech recognition
- **Custom Models**: Extensible for any speech processing API

### Computer Vision
- **Google Vision API**: Advanced facial emotion detection
- **Azure Face API**: Microsoft's emotion recognition service
- **AWS Rekognition**: Amazon's computer vision platform
- **face-api.js**: Client-side face detection library

## �📞 Support

If you have any questions or need help:
1. Check the troubleshooting section above
2. Review Firebase documentation
3. Open an issue in the GitHub repository

---

Made with ❤️ by the ProjectMood team
