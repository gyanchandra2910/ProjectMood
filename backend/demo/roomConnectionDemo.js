// Room Connection Demo and Documentation
// Comprehensive demonstration of the room connection, DJ battle, and ambient matching features

console.log('🎵 Room Connection System Demo\n');
console.log('This demo showcases the advanced room connection features:');
console.log('1. connectRooms() - Merges two rooms with mood blending');
console.log('2. DJ Battle - 90s competitive music experience');
console.log('3. Ambient Matching - Find similar mood rooms\n');

// Demo Configuration
const DEMO_CONFIG = {
  roomA: 'happy-vibes-room',
  roomB: 'chill-lounge-room',
  users: [
    { id: 'user1', name: 'Alice', mood: 'happy' },
    { id: 'user2', name: 'Bob', mood: 'excited' },
    { id: 'user3', name: 'Charlie', mood: 'calm' },
    { id: 'user4', name: 'Diana', mood: 'peaceful' }
  ]
};

// Mock Room Data for Demo
const MOCK_ROOMS = {
  [DEMO_CONFIG.roomA]: {
    id: DEMO_CONFIG.roomA,
    participants: [
      { userId: 'user1', displayName: 'Alice', mood: 'happy' },
      { userId: 'user2', displayName: 'Bob', mood: 'excited' }
    ],
    playlist: [
      { id: 'track1', name: 'Uplifting Song', artists: [{ name: 'Happy Band' }], playCount: 15 },
      { id: 'track2', name: 'Energy Boost', artists: [{ name: 'Pump It Up' }], playCount: 12 },
      { id: 'track3', name: 'Good Vibes', artists: [{ name: 'Positive Waves' }], playCount: 8 }
    ],
    mood: {
      label: 'happy',
      vector: { valence: 0.8, arousal: 0.7 },
      confidence: 0.9
    }
  },
  [DEMO_CONFIG.roomB]: {
    id: DEMO_CONFIG.roomB,
    participants: [
      { userId: 'user3', displayName: 'Charlie', mood: 'calm' },
      { userId: 'user4', displayName: 'Diana', mood: 'peaceful' }
    ],
    playlist: [
      { id: 'track4', name: 'Relaxing Melody', artists: [{ name: 'Zen Masters' }], playCount: 20 },
      { id: 'track5', name: 'Peaceful Waters', artists: [{ name: 'Calm Collective' }], playCount: 18 },
      { id: 'track6', name: 'Ambient Dreams', artists: [{ name: 'Chill Zone' }], playCount: 14 }
    ],
    mood: {
      label: 'calm',
      vector: { valence: 0.6, arousal: 0.3 },
      confidence: 0.85
    }
  }
};

// Room Connection System Demo
class RoomConnectionDemo {
  constructor() {
    this.connectedRooms = new Map();
    this.sharedRooms = new Map();
    this.djBattles = new Map();
    this.ambientMatches = new Map();
  }

  // Demo 1: Room Connection with Mood Blending
  async demonstrateRoomConnection() {
    console.log('🔗 DEMO 1: Room Connection with Mood Blending');
    console.log('=' .repeat(50));

    const roomA = MOCK_ROOMS[DEMO_CONFIG.roomA];
    const roomB = MOCK_ROOMS[DEMO_CONFIG.roomB];

    console.log(`Connecting "${roomA.id}" with "${roomB.id}"`);
    console.log(`Room A Mood: ${roomA.mood.label} (valence: ${roomA.mood.vector.valence}, arousal: ${roomA.mood.vector.arousal})`);
    console.log(`Room B Mood: ${roomB.mood.label} (valence: ${roomB.mood.vector.valence}, arousal: ${roomB.mood.vector.arousal})`);

    // Blend moods
    const blendedMood = this.blendMoods(roomA.mood.vector, roomB.mood.vector);
    console.log(`\n🎭 Blended Mood: ${this.vectorToMoodLabel(blendedMood)}`);
    console.log(`   Valence: ${blendedMood.valence.toFixed(3)}`);
    console.log(`   Arousal: ${blendedMood.arousal.toFixed(3)}`);

    // Merge participant lists
    const allParticipants = [...roomA.participants, ...roomB.participants];
    console.log(`\n👥 Combined Participants (${allParticipants.length}):`);
    allParticipants.forEach(p => console.log(`   • ${p.displayName} (${p.mood})`));

    // Create blended playlist
    const blendedPlaylist = this.createBlendedPlaylist(roomA.playlist, roomB.playlist);
    console.log(`\n🎵 Blended Playlist (${blendedPlaylist.length} tracks):`);
    blendedPlaylist.slice(0, 5).forEach((track, i) => {
      console.log(`   ${i + 1}. ${track.name} - ${track.artists[0].name} (${track.source})`);
    });

    const sharedRoomId = `shared_${roomA.id}_${roomB.id}_${Date.now()}`;
    this.sharedRooms.set(sharedRoomId, {
      id: sharedRoomId,
      roomA: roomA.id,
      roomB: roomB.id,
      participants: allParticipants,
      blendedMood,
      playlist: blendedPlaylist,
      createdAt: new Date()
    });

    console.log(`\n✅ Rooms connected! Shared Room ID: ${sharedRoomId}`);
    return sharedRoomId;
  }

  // Demo 2: DJ Battle System
  async demonstrateDjBattle(sharedRoomId) {
    console.log('\n🎵 DEMO 2: DJ Battle System');
    console.log('=' .repeat(50));

    const sharedRoom = this.sharedRooms.get(sharedRoomId);
    if (!sharedRoom) {
      console.log('❌ No shared room found for DJ battle');
      return;
    }

    const roomA = MOCK_ROOMS[sharedRoom.roomA];
    const roomB = MOCK_ROOMS[sharedRoom.roomB];

    console.log(`🎤 Starting DJ Battle: ${roomA.id} vs ${roomB.id}`);
    console.log(`Duration: 90 seconds`);

    // Get top 3 tracks from each room
    const tracksA = this.getTopTracks(roomA.playlist, 3);
    const tracksB = this.getTopTracks(roomB.playlist, 3);

    console.log(`\n🎶 ${roomA.id} Tracks:`);
    tracksA.forEach((track, i) => console.log(`   ${i + 1}. ${track.name} - ${track.artists[0].name}`));

    console.log(`\n🎶 ${roomB.id} Tracks:`);
    tracksB.forEach((track, i) => console.log(`   ${i + 1}. ${track.name} - ${track.artists[0].name}`));

    // Create battle rotation
    const battleDuration = 90000; // 90 seconds
    const trackDuration = battleDuration / (tracksA.length + tracksB.length);
    
    console.log(`\n⏱️  Battle Timeline (${trackDuration.toFixed(0)}ms per track):`);
    
    let currentTime = 0;
    let engagementA = 0;
    let engagementB = 0;

    // Simulate battle progression
    const allTracks = [];
    for (let i = 0; i < Math.max(tracksA.length, tracksB.length); i++) {
      if (i < tracksA.length) {
        allTracks.push({ ...tracksA[i], room: 'A', time: currentTime });
        currentTime += trackDuration;
      }
      if (i < tracksB.length) {
        allTracks.push({ ...tracksB[i], room: 'B', time: currentTime });
        currentTime += trackDuration;
      }
    }

    allTracks.forEach((track, index) => {
      const timeStr = `${Math.floor(track.time / 1000)}s`;
      console.log(`   ${timeStr}: Room ${track.room} - ${track.name}`);
      
      // Simulate engagement (random for demo)
      const engagement = Math.random() * 10;
      if (track.room === 'A') {
        engagementA += engagement;
      } else {
        engagementB += engagement;
      }
    });

    // Battle results
    const winner = engagementA > engagementB ? roomA.id : roomB.id;
    const moodShift = Math.random() * 0.3; // Mock mood movement

    console.log(`\n🏆 Battle Results:`);
    console.log(`   Winner: ${winner}`);
    console.log(`   ${roomA.id} Engagement: ${engagementA.toFixed(1)}`);
    console.log(`   ${roomB.id} Engagement: ${engagementB.toFixed(1)}`);
    console.log(`   Mood Shift: ${(moodShift * 100).toFixed(1)}% toward ${winner}`);

    return { winner, engagementA, engagementB, moodShift };
  }

  // Demo 3: Ambient Room Matching
  demonstrateAmbientMatching() {
    console.log('\n🔍 DEMO 3: Ambient Room Matching');
    console.log('=' .repeat(50));

    // Create additional mock rooms for matching
    const additionalRooms = [
      {
        id: 'energetic-party',
        mood: { valence: 0.9, arousal: 0.8 },
        participants: 8,
        tags: ['party', 'energetic', 'dance']
      },
      {
        id: 'mellow-jazz',
        mood: { valence: 0.7, arousal: 0.4 },
        participants: 5,
        tags: ['jazz', 'mellow', 'sophisticated']
      },
      {
        id: 'chill-study',
        mood: { valence: 0.5, arousal: 0.2 },
        participants: 12,
        tags: ['study', 'focus', 'ambient']
      }
    ];

    const sourceRoom = MOCK_ROOMS[DEMO_CONFIG.roomA];
    console.log(`Finding matches for: ${sourceRoom.id}`);
    console.log(`Source mood: valence=${sourceRoom.mood.vector.valence}, arousal=${sourceRoom.mood.vector.arousal}`);

    console.log(`\n🎯 Potential Matches:`);
    const matches = additionalRooms.map(room => {
      const similarity = this.calculateCosineSimilarity(sourceRoom.mood.vector, room.mood);
      return {
        ...room,
        similarity,
        compatibilityScore: this.calculateCompatibility(sourceRoom.participants.length, room.participants, room.tags)
      };
    }).sort((a, b) => b.similarity - a.similarity);

    matches.forEach((match, index) => {
      console.log(`   ${index + 1}. ${match.id}`);
      console.log(`      Similarity: ${(match.similarity * 100).toFixed(1)}%`);
      console.log(`      Participants: ${match.participants}`);
      console.log(`      Compatibility: ${this.getCompatibilityDescription(match.compatibilityScore)}`);
      console.log(`      Tags: ${match.tags.join(', ')}`);
      console.log('');
    });

    return matches;
  }

  // Utility Methods
  blendMoods(vectorA, vectorB) {
    return {
      valence: (vectorA.valence + vectorB.valence) / 2,
      arousal: (vectorA.arousal + vectorB.arousal) / 2
    };
  }

  vectorToMoodLabel(vector) {
    if (vector.valence > 0.6 && vector.arousal > 0.6) return 'excited';
    if (vector.valence > 0.6 && vector.arousal <= 0.6) return 'content';
    if (vector.valence <= 0.6 && vector.arousal > 0.6) return 'energetic';
    return 'calm';
  }

  createBlendedPlaylist(playlistA, playlistB) {
    const topA = this.getTopTracks(playlistA, 5);
    const topB = this.getTopTracks(playlistB, 5);
    
    const blended = [];
    const maxLength = Math.max(topA.length, topB.length);
    
    for (let i = 0; i < maxLength; i++) {
      if (i < topA.length) blended.push({ ...topA[i], source: 'Room A' });
      if (i < topB.length) blended.push({ ...topB[i], source: 'Room B' });
    }
    
    return blended;
  }

  getTopTracks(playlist, count) {
    return playlist
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, count);
  }

  calculateCosineSimilarity(vectorA, vectorB) {
    const dotProduct = vectorA.valence * vectorB.valence + vectorA.arousal * vectorB.arousal;
    const magnitudeA = Math.sqrt(vectorA.valence ** 2 + vectorA.arousal ** 2);
    const magnitudeB = Math.sqrt(vectorB.valence ** 2 + vectorB.arousal ** 2);
    return dotProduct / (magnitudeA * magnitudeB);
  }

  calculateCompatibility(sourceParticipants, targetParticipants, tags) {
    let score = 0;
    
    // Participant count similarity
    const sizeDiff = Math.abs(sourceParticipants - targetParticipants);
    const maxSize = Math.max(sourceParticipants, targetParticipants);
    score += maxSize > 0 ? (1 - (sizeDiff / maxSize)) * 0.7 : 0.7;
    
    // Tag bonus
    if (tags.includes('music') || tags.includes('social')) score += 0.3;
    
    return Math.min(score, 1.0);
  }

  getCompatibilityDescription(score) {
    if (score >= 0.8) return 'excellent';
    if (score >= 0.6) return 'good';
    if (score >= 0.4) return 'fair';
    return 'basic';
  }
}

// Run the comprehensive demo
async function runDemo() {
  const demo = new RoomConnectionDemo();
  
  try {
    // Demo 1: Room Connection
    const sharedRoomId = await demo.demonstrateRoomConnection();
    
    // Demo 2: DJ Battle
    await demo.demonstrateDjBattle(sharedRoomId);
    
    // Demo 3: Ambient Matching
    demo.demonstrateAmbientMatching();
    
    console.log('\n🎉 Room Connection System Demo Complete!');
    console.log('Ready for real-time implementation with Socket.IO');
    
  } catch (error) {
    console.error('Demo failed:', error);
  }
}

// Export for testing
module.exports = { RoomConnectionDemo, MOCK_ROOMS, DEMO_CONFIG };

// Run demo if called directly
if (require.main === module) {
  runDemo();
}
