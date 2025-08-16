// Room Connection and DJ Battle System
// Handles cross-room interactions, mood blending, and competitive music experiences

const { fuseMoods, vectorToMoodLabel } = require('../utils/moodFusion');
const RoomMemory = require('../models/RoomMemory');

class RoomConnectionManager {
  constructor(io) {
    this.io = io;
    this.connectedRooms = new Map(); // roomId -> connectedRoomId
    this.sharedRooms = new Map(); // sharedRoomId -> { roomA, roomB, participants, playlist }
    this.djBattles = new Map(); // battleId -> battle data
    this.crossfadeManager = new CrossfadeManager();
  }

  // Connect two rooms into a temporary shared space
  async connectRooms(roomA, roomB, initiatorUserId, options = {}) {
    try {
      // Validate rooms exist and are not already connected
      if (this.connectedRooms.has(roomA) || this.connectedRooms.has(roomB)) {
        throw new Error('One or both rooms are already connected');
      }

      // Get room data
      const roomAData = await this.getRoomData(roomA);
      const roomBData = await this.getRoomData(roomB);

      if (!roomAData || !roomBData) {
        throw new Error('One or both rooms not found');
      }

      // Create shared room
      const sharedRoomId = `shared_${roomA}_${roomB}_${Date.now()}`;
      const connectionData = {
        id: sharedRoomId,
        roomA: roomA,
        roomB: roomB,
        participants: {
          roomA: roomAData.participants || [],
          roomB: roomBData.participants || [],
          all: [...(roomAData.participants || []), ...(roomBData.participants || [])]
        },
        createdAt: new Date(),
        initiatedBy: initiatorUserId,
        status: 'connecting',
        options: {
          allowCrossChat: options.allowCrossChat || true,
          sharePlaylist: options.sharePlaylist || true,
          blendMoods: options.blendMoods || true,
          duration: options.duration || 1800000, // 30 minutes default
          ...options
        }
      };

      // Merge and blend participant moods
      const blendedMoodData = await this.blendRoomMoods(roomAData, roomBData);
      connectionData.blendedMood = blendedMoodData;

      // Create blended playlist
      const blendedPlaylist = await this.createBlendedPlaylist(roomAData, roomBData, blendedMoodData);
      connectionData.playlist = blendedPlaylist;

      // Store connection data
      this.connectedRooms.set(roomA, roomB);
      this.connectedRooms.set(roomB, roomA);
      this.sharedRooms.set(sharedRoomId, connectionData);

      // Join participants to shared room
      await this.joinParticipantsToSharedRoom(sharedRoomId, connectionData);

      // Emit connection events
      this.io.to(roomA).emit('room-connected', {
        sharedRoomId,
        connectedRoom: roomB,
        blendedMood: blendedMoodData,
        playlist: blendedPlaylist.slice(0, 5), // Preview
        participantCount: connectionData.participants.all.length,
        message: `Connected with room ${roomB}! Combined mood and playlist active.`
      });

      this.io.to(roomB).emit('room-connected', {
        sharedRoomId,
        connectedRoom: roomA,
        blendedMood: blendedMoodData,
        playlist: blendedPlaylist.slice(0, 5), // Preview
        participantCount: connectionData.participants.all.length,
        message: `Connected with room ${roomA}! Combined mood and playlist active.`
      });

      // Start shared session
      connectionData.status = 'connected';
      this.startSharedSession(sharedRoomId);

      return {
        success: true,
        sharedRoomId,
        blendedMood: blendedMoodData,
        participantCount: connectionData.participants.all.length,
        playlistCount: blendedPlaylist.length
      };

    } catch (error) {
      console.error('Room connection failed:', error);
      throw error;
    }
  }

  // Blend moods from two rooms using advanced fusion
  async blendRoomMoods(roomAData, roomBData) {
    try {
      // Get mood inputs from both rooms
      const moodInputsA = roomAData.participants?.map(p => ({
        userId: p.userId,
        mood: p.mood || 'neutral',
        weight: 1.0,
        timestamp: new Date(),
        room: roomAData.id
      })) || [];

      const moodInputsB = roomBData.participants?.map(p => ({
        userId: p.userId,
        mood: p.mood || 'neutral',
        weight: 1.0,
        timestamp: new Date(),
        room: roomBData.id
      })) || [];

      // Combine all mood inputs
      const allMoodInputs = [...moodInputsA, ...moodInputsB];

      if (allMoodInputs.length === 0) {
        return {
          fusedMood: { label: 'neutral', vector: { valence: 0, arousal: 0 }, confidence: 0 },
          roomAMood: { label: 'neutral', vector: { valence: 0, arousal: 0 } },
          roomBMood: { label: 'neutral', vector: { valence: 0, arousal: 0 } },
          blendRatio: 0.5,
          participantCount: 0
        };
      }

      // Calculate individual room moods
      const roomAMood = moodInputsA.length > 0 ? fuseMoods(moodInputsA) : null;
      const roomBMood = moodInputsB.length > 0 ? fuseMoods(moodInputsB) : null;

      // Calculate blended mood
      const blendedMood = fuseMoods(allMoodInputs);

      // Calculate blend ratio (how much each room contributes)
      const totalParticipants = allMoodInputs.length;
      const roomAWeight = moodInputsA.length / totalParticipants;
      const roomBWeight = moodInputsB.length / totalParticipants;

      return {
        fusedMood: blendedMood,
        roomAMood: roomAMood || { label: 'neutral', vector: { valence: 0, arousal: 0 } },
        roomBMood: roomBMood || { label: 'neutral', vector: { valence: 0, arousal: 0 } },
        blendRatio: roomAWeight,
        participantCount: totalParticipants,
        breakdown: {
          roomA: { participants: moodInputsA.length, weight: roomAWeight },
          roomB: { participants: moodInputsB.length, weight: roomBWeight }
        }
      };

    } catch (error) {
      console.error('Mood blending failed:', error);
      throw error;
    }
  }

  // Create a blended playlist from both rooms
  async createBlendedPlaylist(roomAData, roomBData, blendedMoodData) {
    try {
      const playlistA = roomAData.playlist || [];
      const playlistB = roomBData.playlist || [];

      // Get top tracks from each room based on play count, likes, etc.
      const topTracksA = this.getTopTracks(playlistA, 10);
      const topTracksB = this.getTopTracks(playlistB, 10);

      // Interleave tracks based on blend ratio
      const blendRatio = blendedMoodData.blendRatio;
      const blendedTracks = this.interleavePlaylist(topTracksA, topTracksB, blendRatio);

      // Add mood-matched tracks from Spotify/library
      const moodMatchedTracks = await this.findMoodMatchedTracks(blendedMoodData.fusedMood, 15);
      
      // Combine and shuffle intelligently
      const finalPlaylist = [
        ...blendedTracks.slice(0, 20), // Room favorites
        ...moodMatchedTracks.slice(0, 15), // Mood matches
      ].map((track, index) => ({
        ...track,
        blendedIndex: index,
        source: track.source || 'blended',
        addedAt: new Date(),
        blendedMood: blendedMoodData.fusedMood
      }));

      return finalPlaylist;

    } catch (error) {
      console.error('Playlist blending failed:', error);
      // Return fallback playlist
      return await this.getFallbackPlaylist(blendedMoodData.fusedMood);
    }
  }

  // Start a DJ Battle between connected rooms
  async startDjBattle(sharedRoomId, options = {}) {
    try {
      const sharedRoom = this.sharedRooms.get(sharedRoomId);
      if (!sharedRoom) {
        throw new Error('Shared room not found');
      }

      const battleId = `battle_${sharedRoomId}_${Date.now()}`;
      const battle = {
        id: battleId,
        sharedRoomId,
        roomA: sharedRoom.roomA,
        roomB: sharedRoom.roomB,
        status: 'starting',
        duration: options.duration || 90000, // 90 seconds
        createdAt: new Date(),
        tracks: {
          roomA: [],
          roomB: []
        },
        stats: {
          moodShifts: [],
          engagementA: 0,
          engagementB: 0,
          winner: null
        },
        currentTrack: null,
        timeline: []
      };

      // Get top 3 tracks from each room
      const roomAData = await this.getRoomData(sharedRoom.roomA);
      const roomBData = await this.getRoomData(sharedRoom.roomB);

      battle.tracks.roomA = this.getTopTracks(roomAData.playlist || [], 3);
      battle.tracks.roomB = this.getTopTracks(roomBData.playlist || [], 3);

      // Create battle rotation schedule
      const rotationSchedule = this.createBattleRotation(battle.tracks, battle.duration);
      battle.schedule = rotationSchedule;

      // Store battle
      this.djBattles.set(battleId, battle);

      // Notify participants
      this.io.to(sharedRoomId).emit('dj-battle-starting', {
        battleId,
        duration: battle.duration,
        tracksA: battle.tracks.roomA.map(t => ({ name: t.name, artist: t.artists?.[0]?.name })),
        tracksB: battle.tracks.roomB.map(t => ({ name: t.name, artist: t.artists?.[0]?.name })),
        schedule: rotationSchedule,
        message: '🎵 DJ Battle starting! Top tracks from both rooms will compete!'
      });

      // Start the battle
      setTimeout(() => this.executeDjBattle(battleId), 3000); // 3 second countdown

      return {
        success: true,
        battleId,
        duration: battle.duration,
        trackCount: battle.tracks.roomA.length + battle.tracks.roomB.length
      };

    } catch (error) {
      console.error('DJ Battle start failed:', error);
      throw error;
    }
  }

  // Execute the DJ battle with crossfading
  async executeDjBattle(battleId) {
    try {
      const battle = this.djBattles.get(battleId);
      if (!battle) return;

      battle.status = 'active';
      const sharedRoomId = battle.sharedRoomId;
      let currentTime = 0;
      let trackIndex = 0;

      // Start battle
      this.io.to(sharedRoomId).emit('dj-battle-started', {
        battleId,
        message: '🚀 DJ Battle is LIVE!'
      });

      // Execute each track in the schedule
      for (const slot of battle.schedule) {
        const track = slot.track;
        const room = slot.room;
        const duration = slot.duration;

        // Update current track
        battle.currentTrack = { ...track, room, startTime: Date.now() };

        // Emit track change with crossfade instructions
        this.io.to(sharedRoomId).emit('dj-battle-track-change', {
          battleId,
          track: {
            name: track.name,
            artist: track.artists?.[0]?.name || 'Unknown',
            room,
            duration,
            remainingTime: battle.duration - currentTime
          },
          crossfade: {
            fadeIn: slot.fadeIn || 2000,
            fadeOut: slot.fadeOut || 2000,
            overlap: slot.overlap || 1000
          },
          timeline: {
            current: currentTime,
            total: battle.duration,
            progress: (currentTime / battle.duration) * 100
          }
        });

        // Capture mood at track start
        const moodCapture = await this.captureBattleMood(sharedRoomId, track, room);
        battle.stats.moodShifts.push(moodCapture);

        // Wait for track duration
        await this.sleep(duration);
        currentTime += duration;

        // Update engagement stats
        this.updateBattleEngagement(battle, room, track);

        trackIndex++;
      }

      // Battle finished
      await this.finishDjBattle(battleId);

    } catch (error) {
      console.error('DJ Battle execution failed:', error);
      this.io.to(battle?.sharedRoomId).emit('dj-battle-error', {
        battleId,
        error: 'Battle encountered an error'
      });
    }
  }

  // Finish DJ battle and show results
  async finishDjBattle(battleId) {
    try {
      const battle = this.djBattles.get(battleId);
      if (!battle) return;

      battle.status = 'finished';
      battle.finishedAt = new Date();

      // Calculate battle statistics
      const stats = this.calculateBattleStats(battle);
      battle.stats = { ...battle.stats, ...stats };

      // Determine winner
      const winner = this.determineBattleWinner(battle);
      battle.stats.winner = winner;

      // Calculate mood movement
      const moodMovement = this.calculateMoodMovement(battle.stats.moodShifts);

      // Emit battle results
      this.io.to(battle.sharedRoomId).emit('dj-battle-finished', {
        battleId,
        duration: battle.duration,
        winner: winner.room,
        stats: {
          engagementA: battle.stats.engagementA,
          engagementB: battle.stats.engagementB,
          moodMovement: moodMovement,
          totalMoodShift: moodMovement.totalShift,
          dominantRoom: moodMovement.dominantRoom,
          trackCount: battle.tracks.roomA.length + battle.tracks.roomB.length
        },
        summary: {
          roomA: {
            name: battle.roomA,
            engagement: battle.stats.engagementA,
            moodInfluence: moodMovement.roomAInfluence,
            topTrack: this.getTopTrack(battle.tracks.roomA)
          },
          roomB: {
            name: battle.roomB,
            engagement: battle.stats.engagementB,
            moodInfluence: moodMovement.roomBInfluence,
            topTrack: this.getTopTrack(battle.tracks.roomB)
          }
        },
        message: `🏆 Battle complete! ${winner.room} wins with ${winner.score.toFixed(1)} engagement score!`
      });

      // Save battle results
      await this.saveBattleResults(battle);

      // Clean up
      setTimeout(() => {
        this.djBattles.delete(battleId);
      }, 300000); // Keep for 5 minutes

    } catch (error) {
      console.error('Battle finish failed:', error);
    }
  }

  // Utility methods
  async getRoomData(roomId) {
    // In a real implementation, this would query your room database
    // For now, return mock data or interface with your existing room system
    return {
      id: roomId,
      participants: [], // Get from your room system
      playlist: [], // Get from your room system
      currentMood: null
    };
  }

  getTopTracks(playlist, count) {
    return playlist
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, count)
      .map(track => ({
        ...track,
        source: 'room'
      }));
  }

  interleavePlaylist(tracksA, tracksB, blendRatio) {
    const result = [];
    const maxLength = Math.max(tracksA.length, tracksB.length);
    
    for (let i = 0; i < maxLength; i++) {
      // Add from room A based on blend ratio
      if (i < tracksA.length && (Math.random() < blendRatio || i >= tracksB.length)) {
        result.push({ ...tracksA[i], sourceRoom: 'A' });
      }
      // Add from room B
      if (i < tracksB.length && (Math.random() >= blendRatio || i >= tracksA.length)) {
        result.push({ ...tracksB[i], sourceRoom: 'B' });
      }
    }
    
    return result;
  }

  async findMoodMatchedTracks(fusedMood, count) {
    // Interface with your Spotify/music service
    // For now, return mock tracks
    return Array.from({ length: count }, (_, i) => ({
      id: `mood_track_${i}`,
      name: `Mood Track ${i + 1}`,
      artists: [{ name: 'AI Generated' }],
      source: 'mood-matched',
      moodScore: Math.random()
    }));
  }

  createBattleRotation(tracks, totalDuration) {
    const allTracks = [
      ...tracks.roomA.map(t => ({ ...t, room: 'A' })),
      ...tracks.roomB.map(t => ({ ...t, room: 'B' }))
    ];
    
    const trackDuration = Math.floor(totalDuration / allTracks.length);
    const schedule = [];
    
    // Alternate between rooms
    let roomToggle = true;
    let aIndex = 0, bIndex = 0;
    
    while (aIndex < tracks.roomA.length || bIndex < tracks.roomB.length) {
      if (roomToggle && aIndex < tracks.roomA.length) {
        schedule.push({
          track: tracks.roomA[aIndex],
          room: 'A',
          duration: trackDuration,
          fadeIn: 2000,
          fadeOut: 2000,
          overlap: 1000
        });
        aIndex++;
      } else if (!roomToggle && bIndex < tracks.roomB.length) {
        schedule.push({
          track: tracks.roomB[bIndex],
          room: 'B',
          duration: trackDuration,
          fadeIn: 2000,
          fadeOut: 2000,
          overlap: 1000
        });
        bIndex++;
      }
      roomToggle = !roomToggle;
    }
    
    return schedule;
  }

  async captureBattleMood(sharedRoomId, track, room) {
    // Capture current mood state during battle
    return {
      timestamp: new Date(),
      track: track.name,
      room,
      mood: { valence: Math.random(), arousal: Math.random() }, // Get actual mood
      participantCount: 0 // Get actual count
    };
  }

  calculateBattleStats(battle) {
    // Calculate engagement and other statistics
    return {
      totalDuration: battle.duration,
      trackChanges: battle.schedule.length,
      moodVariance: this.calculateMoodVariance(battle.stats.moodShifts),
      averageEngagement: (battle.stats.engagementA + battle.stats.engagementB) / 2
    };
  }

  determineBattleWinner(battle) {
    const scoreA = battle.stats.engagementA;
    const scoreB = battle.stats.engagementB;
    
    return scoreA > scoreB 
      ? { room: battle.roomA, score: scoreA }
      : { room: battle.roomB, score: scoreB };
  }

  calculateMoodMovement(moodShifts) {
    if (moodShifts.length < 2) {
      return {
        totalShift: 0,
        dominantRoom: null,
        roomAInfluence: 0,
        roomBInfluence: 0
      };
    }

    // Calculate how mood changed throughout battle
    const initial = moodShifts[0].mood;
    const final = moodShifts[moodShifts.length - 1].mood;
    
    const totalShift = Math.sqrt(
      Math.pow(final.valence - initial.valence, 2) +
      Math.pow(final.arousal - initial.arousal, 2)
    );

    // Calculate room influences
    let roomAInfluence = 0;
    let roomBInfluence = 0;
    
    for (let i = 1; i < moodShifts.length; i++) {
      const shift = this.calculateShiftMagnitude(moodShifts[i - 1].mood, moodShifts[i].mood);
      if (moodShifts[i].room === 'A') {
        roomAInfluence += shift;
      } else {
        roomBInfluence += shift;
      }
    }

    return {
      totalShift,
      dominantRoom: roomAInfluence > roomBInfluence ? 'A' : 'B',
      roomAInfluence,
      roomBInfluence
    };
  }

  calculateShiftMagnitude(mood1, mood2) {
    return Math.sqrt(
      Math.pow(mood2.valence - mood1.valence, 2) +
      Math.pow(mood2.arousal - mood1.arousal, 2)
    );
  }

  updateBattleEngagement(battle, room, track) {
    // Update engagement metrics based on track performance
    const engagement = Math.random() * 10; // Mock engagement
    if (room === 'A') {
      battle.stats.engagementA += engagement;
    } else {
      battle.stats.engagementB += engagement;
    }
  }

  async joinParticipantsToSharedRoom(sharedRoomId, connectionData) {
    // Move participants to shared room
    for (const participant of connectionData.participants.all) {
      this.io.sockets.sockets.forEach(socket => {
        if (socket.userId === participant.userId) {
          socket.join(sharedRoomId);
        }
      });
    }
  }

  startSharedSession(sharedRoomId) {
    // Start the shared session with periodic updates
    const interval = setInterval(() => {
      const sharedRoom = this.sharedRooms.get(sharedRoomId);
      if (!sharedRoom) {
        clearInterval(interval);
        return;
      }

      // Check if session should end
      const elapsed = Date.now() - sharedRoom.createdAt.getTime();
      if (elapsed > sharedRoom.options.duration) {
        this.disconnectRooms(sharedRoomId);
        clearInterval(interval);
        return;
      }

      // Send periodic updates
      this.io.to(sharedRoomId).emit('shared-session-update', {
        elapsed,
        remaining: sharedRoom.options.duration - elapsed,
        participantCount: sharedRoom.participants.all.length
      });
    }, 10000); // Every 10 seconds
  }

  async disconnectRooms(sharedRoomId) {
    const sharedRoom = this.sharedRooms.get(sharedRoomId);
    if (!sharedRoom) return;

    // Notify participants
    this.io.to(sharedRoomId).emit('rooms-disconnected', {
      message: 'Room connection ended. Returning to individual rooms.',
      duration: Date.now() - sharedRoom.createdAt.getTime()
    });

    // Remove connections
    this.connectedRooms.delete(sharedRoom.roomA);
    this.connectedRooms.delete(sharedRoom.roomB);
    this.sharedRooms.delete(sharedRoomId);

    // Move participants back to original rooms
    this.io.in(sharedRoomId).socketsLeave(sharedRoomId);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getFallbackPlaylist(mood) {
    return [
      {
        id: 'fallback_1',
        name: 'Fallback Track 1',
        artists: [{ name: 'System' }],
        source: 'fallback'
      }
    ];
  }

  calculateMoodVariance(moodShifts) {
    if (moodShifts.length < 2) return 0;
    
    const valences = moodShifts.map(m => m.mood.valence);
    const arousals = moodShifts.map(m => m.mood.arousal);
    
    const valenceVariance = this.variance(valences);
    const arousalVariance = this.variance(arousals);
    
    return Math.sqrt(valenceVariance + arousalVariance);
  }

  variance(array) {
    const mean = array.reduce((a, b) => a + b) / array.length;
    return array.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / array.length;
  }

  getTopTrack(tracks) {
    return tracks.reduce((top, track) => 
      (track.playCount || 0) > (top.playCount || 0) ? track : top
    , tracks[0] || { name: 'None' });
  }

  async saveBattleResults(battle) {
    // Save to database for analytics
    try {
      await RoomMemory.create({
        roomId: battle.sharedRoomId,
        type: 'dj_battle',
        data: {
          battleId: battle.id,
          roomA: battle.roomA,
          roomB: battle.roomB,
          winner: battle.stats.winner,
          duration: battle.duration,
          stats: battle.stats
        },
        timestamp: battle.finishedAt
      });
    } catch (error) {
      console.error('Failed to save battle results:', error);
    }
  }
}

// Crossfade Manager for smooth audio transitions
class CrossfadeManager {
  constructor() {
    this.activeFades = new Map();
  }

  startCrossfade(fromTrack, toTrack, duration = 3000) {
    const fadeId = `fade_${Date.now()}`;
    const fade = {
      id: fadeId,
      fromTrack,
      toTrack,
      duration,
      startTime: Date.now(),
      progress: 0
    };

    this.activeFades.set(fadeId, fade);

    // Simulate crossfade progression
    const interval = setInterval(() => {
      const elapsed = Date.now() - fade.startTime;
      fade.progress = elapsed / duration;

      if (fade.progress >= 1) {
        clearInterval(interval);
        this.activeFades.delete(fadeId);
        return;
      }

      // Emit crossfade progress
      // In real implementation, this would control audio levels
    }, 100);

    return fadeId;
  }

  stopCrossfade(fadeId) {
    this.activeFades.delete(fadeId);
  }
}

module.exports = { RoomConnectionManager, CrossfadeManager };
