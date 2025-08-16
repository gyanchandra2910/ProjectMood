# Room Connection System Documentation

## Overview

The Room Connection System enables advanced real-time collaboration between MoodFusion rooms, including:

- **Room Connections**: Merge two rooms with mood blending and playlist fusion
- **DJ Battles**: 90-second competitive music experiences with real-time voting
- **Ambient Matching**: Find and connect rooms with similar mood vectors

## Architecture

### Core Components

1. **RoomConnectionManager** (`/services/roomConnection.js`)
   - Handles room connections and disconnections
   - Manages mood blending algorithms
   - Controls DJ battle orchestration

2. **AmbientMatchingService** (`/services/ambientMatching.js`)
   - Finds compatible rooms using cosine similarity
   - Maintains anonymous room profiles
   - Handles connection requests and responses

3. **RoomConnectionSocketHandler** (`/services/roomConnectionSockets.js`)
   - Real-time Socket.IO event handling
   - Cross-room communication
   - Live updates and notifications

4. **REST API Routes** (`/routes/roomConnectionRoutes.js`)
   - HTTP endpoints for room connection operations
   - Status checking and management
   - Integration with frontend applications

## API Endpoints

### Room Connections

#### Connect Rooms
```http
POST /api/room-connections/connect
Content-Type: application/json

{
  "roomA": "room-id-1",
  "roomB": "room-id-2",
  "userId": "user-id",
  "options": {
    "allowCrossChat": true,
    "sharePlaylist": true,
    "blendMoods": true,
    "duration": 1800000
  }
}
```

#### Get Connection Status
```http
GET /api/room-connections/status/{roomId}
```

#### Disconnect Rooms
```http
POST /api/room-connections/disconnect
Content-Type: application/json

{
  "sharedRoomId": "shared-room-id",
  "userId": "user-id"
}
```

### DJ Battles

#### Start DJ Battle
```http
POST /api/room-connections/dj-battle/start
Content-Type: application/json

{
  "sharedRoomId": "shared-room-id",
  "options": {
    "duration": 90000,
    "initiatedBy": "user-id"
  }
}
```

#### Get Battle Status
```http
GET /api/room-connections/dj-battle/status/{battleId}
```

#### Get Battle Results
```http
GET /api/room-connections/dj-battle/results/{battleId}
```

### Ambient Matching

#### Register Room for Matching
```http
POST /api/room-connections/ambient/register
Content-Type: application/json

{
  "roomId": "room-id",
  "options": {
    "allowMatching": true,
    "isPublic": true,
    "tags": ["music", "mood", "social"],
    "preferredSimilarity": 0.75
  }
}
```

#### Find Matches
```http
GET /api/room-connections/ambient/matches/{roomId}?threshold=0.8
```

#### Request Connection
```http
POST /api/room-connections/ambient/request
Content-Type: application/json

{
  "fromRoomId": "room-id",
  "toAnonymousId": "anonymous-room-id",
  "userId": "user-id",
  "message": "Let's blend our vibes!"
}
```

#### Respond to Connection Request
```http
POST /api/room-connections/ambient/respond
Content-Type: application/json

{
  "requestId": "request-id",
  "roomId": "room-id",
  "userId": "user-id",
  "response": "accepted",
  "message": "Looking forward to blending!"
}
```

## Socket.IO Events

### Client-to-Server Events

#### Join Room with Matching
```javascript
socket.emit('join-room', {
  roomId: 'room-id',
  userId: 'user-id',
  userInfo: { displayName: 'User Name' },
  matchingOptions: { 
    enableMatching: true,
    isPublic: true,
    tags: ['music', 'social']
  }
});
```

#### Request Room Connection
```javascript
socket.emit('request-room-connection', {
  targetRoomId: 'target-room-id',
  message: 'Connection request message',
  options: { duration: 1800000 }
});
```

#### Start DJ Battle
```javascript
socket.emit('start-dj-battle', {
  sharedRoomId: 'shared-room-id',
  options: { duration: 90000 }
});
```

#### Vote in DJ Battle
```javascript
socket.emit('dj-battle-vote', {
  battleId: 'battle-id',
  trackId: 'track-id',
  room: 'A',
  vote: 'fire' // 'fire', 'up', 'down'
});
```

#### Find Ambient Matches
```javascript
socket.emit('find-ambient-matches', {
  threshold: 0.8,
  tags: ['music', 'mood']
});
```

#### Request Ambient Connection
```javascript
socket.emit('request-ambient-connection', {
  toAnonymousId: 'anonymous-room-id',
  message: 'Connection request message'
});
```

### Server-to-Client Events

#### Room Connected
```javascript
socket.on('room-connected', (data) => {
  // data: { sharedRoomId, connectedRoom, blendedMood, playlist, participantCount, message }
});
```

#### DJ Battle Events
```javascript
socket.on('dj-battle-starting', (data) => {
  // data: { battleId, duration, tracksA, tracksB, schedule, message }
});

socket.on('dj-battle-track-change', (data) => {
  // data: { battleId, track, crossfade, timeline }
});

socket.on('dj-battle-finished', (data) => {
  // data: { battleId, winner, stats, summary, message }
});
```

#### Ambient Matching Events
```javascript
socket.on('ambient-matches-found', (data) => {
  // data: { roomId, matches, searchedRooms, timestamp }
});

socket.on('connection-request-received', (data) => {
  // data: { requestId, fromAnonymousId, similarity, message, expiresIn }
});

socket.on('high-quality-match-found', (data) => {
  // data: { match: { similarity, mood, participants }, message }
});
```

## Frontend Integration

### React Component Usage

```jsx
import RoomConnectionPanel from './components/RoomConnectionPanel';

function Room() {
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('my-room');
  const [userId, setUserId] = useState('user-123');
  const [currentMood, setCurrentMood] = useState({ label: 'happy', vector: { valence: 0.7, arousal: 0.6 } });

  return (
    <div className="room-layout">
      {/* Other room components */}
      
      <RoomConnectionPanel
        roomId={roomId}
        userId={userId}
        currentMood={currentMood}
        socket={socket}
      />
    </div>
  );
}
```

## Mood Blending Algorithm

The system uses a sophisticated mood blending algorithm that:

1. **Collects Mood Inputs**: Gathers mood data from all participants in both rooms
2. **Calculates Room Moods**: Uses the MoodFusion algorithm to determine each room's collective mood
3. **Blends Vectors**: Combines mood vectors using weighted averages based on participant count
4. **Generates Fusion**: Creates a new fused mood that represents the combined emotional state

### Mood Vector Space

Moods are represented in a 2D emotional space:
- **Valence**: Positive (-1) to Negative (+1) emotional tone
- **Arousal**: Low (-1) to High (+1) energy level

### Similarity Calculation

Room compatibility is determined using cosine similarity between mood vectors:

```javascript
similarity = (A·B) / (|A| × |B|)
```

Where A and B are mood vectors with valence and arousal components.

## DJ Battle System

### Battle Flow

1. **Initialization**: Two connected rooms prepare their top 3 tracks
2. **Rotation**: Tracks alternate between rooms every 15 seconds (90s total)
3. **Voting**: Participants vote with 🔥 (fire), 👍 (up), or 👎 (down)
4. **Crossfading**: Smooth audio transitions between tracks
5. **Results**: Calculate engagement scores and mood shift statistics

### Engagement Scoring

- **Fire Vote**: +3 points
- **Up Vote**: +1 point
- **Down Vote**: -1 point
- **Track Actions**: Share (+3), Like (+2), React (+1)

### Mood Tracking

The system tracks how mood shifts during battles:
- Captures mood snapshots at each track change
- Calculates total mood movement
- Determines which room had more influence

## Ambient Matching

### Privacy Features

- **Anonymous Profiles**: Rooms are identified by generated IDs, not real names
- **Opt-in Only**: Matching must be explicitly enabled
- **Filtered Information**: Only mood, participant count, and tags are shared

### Matching Criteria

1. **Mood Similarity**: Cosine similarity above threshold (default 0.75)
2. **Participant Compatibility**: Similar group sizes
3. **Tag Overlap**: Shared interests and room types
4. **Regional Preferences**: Language and location compatibility

### Connection Workflow

1. **Discovery**: Room A finds Room B through ambient matching
2. **Request**: Room A sends anonymous connection request to Room B
3. **Response**: Room B can accept or decline (5-minute expiry)
4. **Connection**: If accepted, rooms are connected automatically

## Configuration

### Environment Variables

```bash
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/moodfusion-db

# Spotify Integration
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# AI Music Services
SUNO_API_KEY=your_suno_api_key
HUGGINGFACE_API_KEY=your_huggingface_key
REPLICATE_API_TOKEN=your_replicate_token

# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:3000
```

### Default Settings

```javascript
const DEFAULT_CONFIG = {
  // Room Connection
  CONNECTION_DURATION: 1800000, // 30 minutes
  MAX_PARTICIPANTS_PER_ROOM: 50,
  
  // DJ Battle
  BATTLE_DURATION: 90000, // 90 seconds
  TRACKS_PER_ROOM: 3,
  CROSSFADE_DURATION: 2000, // 2 seconds
  
  // Ambient Matching
  SIMILARITY_THRESHOLD: 0.75,
  MATCHING_INTERVAL: 30000, // 30 seconds
  REQUEST_EXPIRY: 300000, // 5 minutes
  
  // Rate Limiting
  API_RATE_LIMIT: 100, // requests per 15 minutes
  WEBSOCKET_RATE_LIMIT: 1000 // events per minute
};
```

## Security Considerations

### Authentication
- All API endpoints require valid user authentication
- Socket.IO connections must provide valid auth tokens
- Cross-room communication is logged and monitored

### Rate Limiting
- API endpoints are rate-limited per IP address
- Socket.IO events are throttled per connection
- Connection requests are limited per user

### Data Privacy
- Room matching uses anonymous identifiers
- Personal information is never shared between rooms
- All cross-room messages are optionally logged

## Testing

### Running Tests

```bash
# Run all room connection tests
npm test:room-connections

# Run specific test suites
node tests/roomConnectionTest.js
node tests/ambientMatchingTest.js
node tests/djBattleTest.js

# Run integration tests
npm run test:integration
```

### Test Coverage

The test suite includes:
- API endpoint testing
- Socket.IO event handling
- Mood blending algorithms
- Playlist generation
- Error handling
- Performance testing

## Deployment

### Production Setup

1. **Environment Configuration**: Set all required environment variables
2. **Database**: Ensure MongoDB is running and accessible
3. **Redis**: Optional, for scaling Socket.IO across multiple servers
4. **Load Balancing**: Configure sticky sessions for Socket.IO
5. **Monitoring**: Set up logging and health checks

### Scaling Considerations

- Use Redis adapter for Socket.IO in multi-server deployments
- Implement database connection pooling
- Consider horizontal scaling for high traffic
- Monitor mood calculation performance under load

## Troubleshooting

### Common Issues

1. **Connection Refused**: Check if server is running on correct port
2. **MongoDB Connection Failed**: Verify database is running and accessible
3. **Socket.IO Disconnections**: Check network stability and CORS settings
4. **Mood Calculation Errors**: Validate input data format and ranges

### Debug Mode

Enable debug logging:
```bash
DEBUG=socket.io:* node app.js
```

## Future Enhancements

### Planned Features

1. **Multi-Room Battles**: Support for 3+ room competitions
2. **AI DJ**: Automated music selection based on crowd mood
3. **Global Mood Map**: Visualize worldwide mood patterns
4. **Voice Integration**: Voice commands for DJ battles
5. **VR Support**: Virtual reality room experiences

### API Versioning

The API follows semantic versioning. Current version: 2.0.0

- Major: Breaking changes to core functionality
- Minor: New features without breaking changes  
- Patch: Bug fixes and performance improvements

## Support

For technical support or feature requests:
- GitHub Issues: Report bugs and request features
- Documentation: Check API docs for latest updates
- Community: Join our Discord for real-time help

---

**Last Updated**: August 16, 2025
**API Version**: 2.0.0
**Compatibility**: Node.js 18+, React 18+
