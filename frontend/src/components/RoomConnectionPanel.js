// Room Connection Panel
// React component for managing room connections, DJ battles, and ambient matching

import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import './RoomConnectionPanel.css';

const RoomConnectionPanel = ({ roomId, userId, currentMood, socket }) => {
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    connectedRoom: null,
    sharedRoomId: null
  });
  
  const [ambientMatches, setAmbientMatches] = useState([]);
  const [ambientMatchingEnabled, setAmbientMatchingEnabled] = useState(false);
  const [djBattle, setDjBattle] = useState(null);
  const [connectionRequests, setConnectionRequests] = useState([]);
  
  const [searchingMatches, setSearchingMatches] = useState(false);
  const [showMatchingModal, setShowMatchingModal] = useState(false);
  const [showBattleModal, setShowBattleModal] = useState(false);

  // Initialize socket listeners
  useEffect(() => {
    if (!socket) return;

    // Connection status events
    socket.on('room-status', (data) => {
      setConnectionStatus({
        connected: data.connected,
        connectedRoom: data.connectedRoom,
        sharedRoomId: data.sharedRoomId
      });
    });

    socket.on('room-connected', (data) => {
      setConnectionStatus({
        connected: true,
        connectedRoom: data.connectedRoom,
        sharedRoomId: data.sharedRoomId
      });
      
      // Show connection success message
      showNotification(`Connected with ${data.connectedRoom}! 🎵`, 'success');
    });

    socket.on('rooms-disconnected', (data) => {
      setConnectionStatus({
        connected: false,
        connectedRoom: null,
        sharedRoomId: null
      });
      setDjBattle(null);
      showNotification('Rooms disconnected', 'info');
    });

    // Ambient matching events
    socket.on('ambient-matching-enabled', (data) => {
      setAmbientMatchingEnabled(true);
      showNotification('Ambient matching enabled! 🔍', 'success');
    });

    socket.on('ambient-matches-found', (data) => {
      setAmbientMatches(data.matches || []);
      setSearchingMatches(false);
      
      if (data.matches.length > 0) {
        showNotification(`Found ${data.matches.length} compatible rooms!`, 'success');
      } else {
        showNotification('No matches found at the moment', 'info');
      }
    });

    socket.on('high-quality-match-found', (data) => {
      showNotification(`🎯 Perfect match found! ${data.match.similarity} similar`, 'highlight');
      // Auto-refresh matches
      setTimeout(() => findAmbientMatches(), 1000);
    });

    socket.on('connection-request-received', (data) => {
      setConnectionRequests(prev => [...prev, data]);
      showNotification(`Connection request from ${data.fromMood} room`, 'request');
    });

    socket.on('connection-request-sent', (data) => {
      showNotification('Connection request sent!', 'success');
    });

    socket.on('connection-request-accepted', (data) => {
      showNotification('Connection request accepted! 🎉', 'success');
      setConnectionRequests([]);
    });

    socket.on('connection-request-rejected', (data) => {
      showNotification('Connection request declined', 'info');
    });

    // DJ Battle events
    socket.on('dj-battle-starting', (data) => {
      setDjBattle({
        id: data.battleId,
        status: 'starting',
        duration: data.duration,
        tracksA: data.tracksA,
        tracksB: data.tracksB,
        stats: { roomA: 0, roomB: 0 }
      });
      showNotification('🎵 DJ Battle starting!', 'battle');
    });

    socket.on('dj-battle-started', (data) => {
      setDjBattle(prev => prev ? { ...prev, status: 'active' } : null);
    });

    socket.on('dj-battle-track-change', (data) => {
      setDjBattle(prev => prev ? {
        ...prev,
        currentTrack: data.track,
        timeline: data.timeline
      } : null);
    });

    socket.on('dj-battle-vote-received', (data) => {
      setDjBattle(prev => prev ? {
        ...prev,
        stats: {
          roomA: data.currentEngagement.roomA,
          roomB: data.currentEngagement.roomB
        }
      } : null);
    });

    socket.on('dj-battle-finished', (data) => {
      setDjBattle(prev => prev ? {
        ...prev,
        status: 'finished',
        winner: data.winner,
        finalStats: data.stats
      } : null);
      showNotification(`🏆 Battle finished! ${data.winner} wins!`, 'victory');
    });

    return () => {
      // Cleanup listeners
      socket.off('room-status');
      socket.off('room-connected');
      socket.off('rooms-disconnected');
      socket.off('ambient-matching-enabled');
      socket.off('ambient-matches-found');
      socket.off('high-quality-match-found');
      socket.off('connection-request-received');
      socket.off('connection-request-sent');
      socket.off('connection-request-accepted');
      socket.off('connection-request-rejected');
      socket.off('dj-battle-starting');
      socket.off('dj-battle-started');
      socket.off('dj-battle-track-change');
      socket.off('dj-battle-vote-received');
      socket.off('dj-battle-finished');
    };
  }, [socket]);

  // Enable ambient matching
  const enableAmbientMatching = useCallback(async () => {
    try {
      const response = await fetch('/api/room-connections/ambient/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          options: {
            allowMatching: true,
            isPublic: true,
            tags: ['music', 'mood', currentMood?.label || 'neutral'],
            preferredSimilarity: 0.75
          }
        })
      });

      if (response.ok) {
        setAmbientMatchingEnabled(true);
        findAmbientMatches();
      }
    } catch (error) {
      console.error('Failed to enable ambient matching:', error);
      showNotification('Failed to enable matching', 'error');
    }
  }, [roomId, currentMood]);

  // Find ambient matches
  const findAmbientMatches = useCallback(async () => {
    if (!ambientMatchingEnabled) return;

    setSearchingMatches(true);
    try {
      const response = await fetch(`/api/room-connections/ambient/matches/${roomId}`);
      const data = await response.json();
      
      if (data.success) {
        setAmbientMatches(data.data.matches || []);
      }
    } catch (error) {
      console.error('Failed to find matches:', error);
      showNotification('Failed to find matches', 'error');
    } finally {
      setSearchingMatches(false);
    }
  }, [roomId, ambientMatchingEnabled]);

  // Request connection to matched room
  const requestConnection = useCallback(async (targetAnonymousId, message = '') => {
    try {
      const response = await fetch('/api/room-connections/ambient/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromRoomId: roomId,
          toAnonymousId: targetAnonymousId,
          userId,
          message
        })
      });

      if (response.ok) {
        showNotification('Connection request sent!', 'success');
      }
    } catch (error) {
      console.error('Failed to request connection:', error);
      showNotification('Failed to send request', 'error');
    }
  }, [roomId, userId]);

  // Respond to connection request
  const respondToRequest = useCallback(async (requestId, response, message = '') => {
    try {
      const apiResponse = await fetch('/api/room-connections/ambient/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          roomId,
          userId,
          response,
          message
        })
      });

      if (apiResponse.ok) {
        setConnectionRequests(prev => prev.filter(req => req.requestId !== requestId));
        showNotification(`Request ${response}`, 'success');
      }
    } catch (error) {
      console.error('Failed to respond to request:', error);
      showNotification('Failed to respond', 'error');
    }
  }, [roomId, userId]);

  // Start DJ battle
  const startDjBattle = useCallback(async () => {
    if (!connectionStatus.connected || !connectionStatus.sharedRoomId) return;

    try {
      const response = await fetch('/api/room-connections/dj-battle/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sharedRoomId: connectionStatus.sharedRoomId,
          options: {
            duration: 90000, // 90 seconds
            initiatedBy: userId
          }
        })
      });

      if (response.ok) {
        showNotification('DJ Battle starting!', 'battle');
      }
    } catch (error) {
      console.error('Failed to start DJ battle:', error);
      showNotification('Failed to start battle', 'error');
    }
  }, [connectionStatus, userId]);

  // Vote in DJ battle
  const voteInBattle = useCallback((vote) => {
    if (!djBattle || djBattle.status !== 'active') return;

    socket.emit('dj-battle-vote', {
      battleId: djBattle.id,
      trackId: djBattle.currentTrack?.id,
      room: connectionStatus.connectedRoom === djBattle.roomA ? 'B' : 'A',
      vote
    });
  }, [djBattle, connectionStatus, socket]);

  // Disconnect rooms
  const disconnectRooms = useCallback(async () => {
    if (!connectionStatus.sharedRoomId) return;

    try {
      const response = await fetch('/api/room-connections/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sharedRoomId: connectionStatus.sharedRoomId,
          userId
        })
      });

      if (response.ok) {
        showNotification('Disconnecting rooms...', 'info');
      }
    } catch (error) {
      console.error('Failed to disconnect rooms:', error);
      showNotification('Failed to disconnect', 'error');
    }
  }, [connectionStatus, userId]);

  // Show notification
  const showNotification = (message, type) => {
    // Implement your notification system here
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  return (
    <div className="room-connection-panel">
      {/* Connection Status */}
      <div className="connection-status">
        <h3>Room Connections</h3>
        {connectionStatus.connected ? (
          <div className="connected-status">
            <div className="status-indicator connected"></div>
            <span>Connected to {connectionStatus.connectedRoom}</span>
            <button 
              className="disconnect-btn"
              onClick={disconnectRooms}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="disconnected-status">
            <div className="status-indicator disconnected"></div>
            <span>Not connected</span>
          </div>
        )}
      </div>

      {/* Ambient Matching */}
      <div className="ambient-matching">
        <h4>Find Similar Rooms</h4>
        {!ambientMatchingEnabled ? (
          <button 
            className="enable-matching-btn"
            onClick={enableAmbientMatching}
          >
            Enable Room Matching
          </button>
        ) : (
          <div className="matching-controls">
            <button 
              className="find-matches-btn"
              onClick={findAmbientMatches}
              disabled={searchingMatches}
            >
              {searchingMatches ? 'Searching...' : 'Find Matches'}
            </button>
            
            {ambientMatches.length > 0 && (
              <div className="matches-list">
                <h5>Compatible Rooms ({ambientMatches.length})</h5>
                {ambientMatches.slice(0, 3).map((match, index) => (
                  <div key={match.id} className="match-item">
                    <div className="match-info">
                      <div className="match-mood">{match.moodLabel}</div>
                      <div className="match-similarity">{match.similarity} similar</div>
                      <div className="match-participants">{match.participantCount} people</div>
                    </div>
                    <button 
                      className="request-connection-btn"
                      onClick={() => requestConnection(match.anonymousId, `Let's blend our ${currentMood?.label || 'mood'} vibes!`)}
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connection Requests */}
      {connectionRequests.length > 0 && (
        <div className="connection-requests">
          <h4>Connection Requests</h4>
          {connectionRequests.map((request) => (
            <div key={request.requestId} className="request-item">
              <div className="request-info">
                <div className="request-mood">{request.fromMood} room</div>
                <div className="request-similarity">{request.similarity} similar</div>
                <div className="request-participants">{request.fromParticipants} people</div>
                {request.message && (
                  <div className="request-message">"{request.message}"</div>
                )}
              </div>
              <div className="request-actions">
                <button 
                  className="accept-btn"
                  onClick={() => respondToRequest(request.requestId, 'accepted', 'Looking forward to blending our vibes!')}
                >
                  Accept
                </button>
                <button 
                  className="decline-btn"
                  onClick={() => respondToRequest(request.requestId, 'rejected', 'Maybe another time!')}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DJ Battle Section */}
      {connectionStatus.connected && (
        <div className="dj-battle-section">
          <h4>DJ Battle</h4>
          {!djBattle ? (
            <button 
              className="start-battle-btn"
              onClick={startDjBattle}
            >
              Start DJ Battle
            </button>
          ) : (
            <div className="battle-controls">
              {djBattle.status === 'starting' && (
                <div className="battle-starting">
                  <div className="battle-countdown">Battle starting...</div>
                  <div className="battle-tracks">
                    <div className="room-tracks">
                      <h5>Room A Tracks</h5>
                      {djBattle.tracksA.map((track, i) => (
                        <div key={i} className="track-item">
                          {track.name} - {track.artist}
                        </div>
                      ))}
                    </div>
                    <div className="room-tracks">
                      <h5>Room B Tracks</h5>
                      {djBattle.tracksB.map((track, i) => (
                        <div key={i} className="track-item">
                          {track.name} - {track.artist}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {djBattle.status === 'active' && (
                <div className="battle-active">
                  <div className="battle-timeline">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${djBattle.timeline?.progress || 0}%` }}
                      ></div>
                    </div>
                    <div className="time-remaining">
                      {Math.floor((djBattle.timeline?.total - djBattle.timeline?.current) / 1000)}s
                    </div>
                  </div>

                  {djBattle.currentTrack && (
                    <div className="current-track">
                      <div className="track-info">
                        <div className="track-name">{djBattle.currentTrack.name}</div>
                        <div className="track-artist">{djBattle.currentTrack.artist}</div>
                        <div className="track-room">Room {djBattle.currentTrack.room}</div>
                      </div>
                      
                      <div className="vote-buttons">
                        <button 
                          className="vote-btn fire"
                          onClick={() => voteInBattle('fire')}
                        >
                          🔥
                        </button>
                        <button 
                          className="vote-btn up"
                          onClick={() => voteInBattle('up')}
                        >
                          👍
                        </button>
                        <button 
                          className="vote-btn down"
                          onClick={() => voteInBattle('down')}
                        >
                          👎
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="battle-stats">
                    <div className="room-stat">
                      <span>Room A: {djBattle.stats?.roomA?.toFixed(1) || 0}</span>
                    </div>
                    <div className="room-stat">
                      <span>Room B: {djBattle.stats?.roomB?.toFixed(1) || 0}</span>
                    </div>
                  </div>
                </div>
              )}

              {djBattle.status === 'finished' && (
                <div className="battle-finished">
                  <div className="battle-winner">
                    <h5>🏆 {djBattle.winner} Wins!</h5>
                  </div>
                  <div className="final-stats">
                    <div>Room A: {djBattle.finalStats?.roomA?.engagement}</div>
                    <div>Room B: {djBattle.finalStats?.roomB?.engagement}</div>
                    <div>Mood Shift: {djBattle.finalStats?.totalMoodShift?.toFixed(2)}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RoomConnectionPanel;
