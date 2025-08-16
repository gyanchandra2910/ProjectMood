// PlaylistPanel - React component for Spotify playlist management
// Handles track queuing, playback control, and Socket.IO synchronization

import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './PlaylistPanel.css';

const PlaylistPanel = ({ roomId, userId, onMoodChange }) => {
  // State management
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [playlist, setPlaylist] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [moodFilters, setMoodFilters] = useState({
    valence: 0.5,
    energy: 0.5,
    danceability: 0.5
  });

  // Socket and audio refs
  const socketRef = useRef(null);
  const audioRef = useRef(null);

  // API base URL
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

  // Initialize socket connection
  useEffect(() => {
    if (roomId) {
      socketRef.current = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001');
      
      socketRef.current.emit('join-room', { roomId, userId });
      
      // Socket event listeners
      socketRef.current.on('track-added', handleTrackAdded);
      socketRef.current.on('track-removed', handleTrackRemoved);
      socketRef.current.on('playback-changed', handlePlaybackChanged);
      socketRef.current.on('playlist-synced', handlePlaylistSync);
      
      return () => {
        socketRef.current?.disconnect();
      };
    }
  }, [roomId, userId]);

  // Check Spotify authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Socket event handlers
  const handleTrackAdded = (data) => {
    setPlaylist(prev => [...prev, data.track]);
  };

  const handleTrackRemoved = (data) => {
    setPlaylist(prev => prev.filter(track => track.id !== data.trackId));
  };

  const handlePlaybackChanged = (data) => {
    setCurrentTrack(data.track);
    setIsPlaying(data.isPlaying);
  };

  const handlePlaylistSync = (data) => {
    setPlaylist(data.playlist);
    setCurrentTrack(data.currentTrack);
    setIsPlaying(data.isPlaying);
  };

  // API calls
  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/spotify/status`, {
        headers: {
          'x-spotify-user': userId
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setIsAuthenticated(data.authenticated);
        setUserInfo(data.user);
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
    }
  };

  const initiateSpotifyAuth = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/spotify/auth`);
      const data = await response.json();
      
      if (data.success) {
        setAuthUrl(data.authUrl);
        window.open(data.authUrl, 'spotify-auth', 'width=600,height=800');
        
        // Poll for authentication completion
        const pollInterval = setInterval(async () => {
          await checkAuthStatus();
          if (isAuthenticated) {
            clearInterval(pollInterval);
            setAuthUrl('');
          }
        }, 2000);
        
        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 300000);
      }
    } catch (error) {
      setError('Failed to initiate Spotify authentication');
      console.error('Auth initiation failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const searchTracks = async (query = searchQuery) => {
    if (!query.trim()) return;
    
    try {
      setIsLoading(true);
      setError('');
      
      const response = await fetch(
        `${API_BASE}/spotify/search?q=${encodeURIComponent(query)}&limit=10`,
        {
          headers: {
            'x-spotify-user': userId
          }
        }
      );
      
      if (response.status === 401) {
        setIsAuthenticated(false);
        setError('Spotify authentication required');
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.tracks);
      } else {
        setError(data.error || 'Search failed');
      }
    } catch (error) {
      setError('Search request failed');
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const searchByMood = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const params = new URLSearchParams({
        valence: moodFilters.valence,
        energy: moodFilters.energy,
        danceability: moodFilters.danceability,
        limit: 10
      });
      
      const response = await fetch(
        `${API_BASE}/spotify/search-by-mood?${params}`,
        {
          headers: {
            'x-spotify-user': userId
          }
        }
      );
      
      if (response.status === 401) {
        setIsAuthenticated(false);
        setError('Spotify authentication required');
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.tracks);
        setSearchQuery(''); // Clear text search when using mood search
      } else {
        setError(data.error || 'Mood search failed');
      }
    } catch (error) {
      setError('Mood search request failed');
      console.error('Mood search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addToPlaylist = (track) => {
    // Add to local playlist
    setPlaylist(prev => [...prev, track]);
    
    // Broadcast to room
    socketRef.current?.emit('add-track', {
      roomId,
      track: {
        id: track.id,
        name: track.name,
        uri: track.uri,
        artists: track.artists,
        album: track.album,
        duration: track.duration,
        previewUrl: track.previewUrl,
        addedBy: userId,
        addedAt: new Date().toISOString()
      }
    });
  };

  const removeFromPlaylist = (trackId) => {
    setPlaylist(prev => prev.filter(track => track.id !== trackId));
    
    socketRef.current?.emit('remove-track', {
      roomId,
      trackId
    });
  };

  const playTrack = (track) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    setCurrentTrack(track);
    
    if (track.previewUrl) {
      audioRef.current = new Audio(track.previewUrl);
      audioRef.current.play();
      setIsPlaying(true);
      
      audioRef.current.onended = () => {
        setIsPlaying(false);
        playNextTrack();
      };
    }
    
    // Broadcast playback change
    socketRef.current?.emit('playback-change', {
      roomId,
      track,
      isPlaying: true
    });
    
    // Report mood change if available
    if (track.audioFeatures && onMoodChange) {
      onMoodChange({
        valence: track.audioFeatures.valence,
        energy: track.audioFeatures.energy,
        danceability: track.audioFeatures.danceability
      });
    }
  };

  const pauseTrack = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    
    socketRef.current?.emit('playback-change', {
      roomId,
      track: currentTrack,
      isPlaying: false
    });
  };

  const playNextTrack = () => {
    if (playlist.length === 0) return;
    
    const currentIndex = playlist.findIndex(track => track.id === currentTrack?.id);
    const nextIndex = (currentIndex + 1) % playlist.length;
    playTrack(playlist[nextIndex]);
  };

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds.padStart(2, '0')}`;
  };

  // Render authentication section
  const renderAuthSection = () => {
    if (isAuthenticated) {
      return (
        <div className="auth-status authenticated">
          <div className="user-info">
            <span className="status-indicator">🎵</span>
            <span>Connected as {userInfo?.displayName || 'Spotify User'}</span>
          </div>
        </div>
      );
    }
    
    return (
      <div className="auth-status not-authenticated">
        <p>Connect to Spotify to search and play music</p>
        <button 
          onClick={initiateSpotifyAuth}
          disabled={isLoading}
          className="auth-button"
        >
          {isLoading ? 'Connecting...' : 'Connect Spotify'}
        </button>
        {authUrl && (
          <p className="auth-instruction">
            Click the button above to authorize Spotify access
          </p>
        )}
      </div>
    );
  };

  // Render search section
  const renderSearchSection = () => {
    if (!isAuthenticated) return null;
    
    return (
      <div className="search-section">
        <div className="search-controls">
          <div className="text-search">
            <input
              type="text"
              placeholder="Search for songs, artists, albums..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchTracks()}
              className="search-input"
            />
            <button 
              onClick={() => searchTracks()}
              disabled={isLoading || !searchQuery.trim()}
              className="search-button"
            >
              {isLoading ? '⏳' : '🔍'}
            </button>
          </div>
          
          <div className="mood-search">
            <h4>Search by Mood</h4>
            <div className="mood-sliders">
              <div className="slider-group">
                <label>Happiness: {(moodFilters.valence * 100).toFixed(0)}%</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={moodFilters.valence}
                  onChange={(e) => setMoodFilters(prev => ({
                    ...prev,
                    valence: parseFloat(e.target.value)
                  }))}
                />
              </div>
              <div className="slider-group">
                <label>Energy: {(moodFilters.energy * 100).toFixed(0)}%</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={moodFilters.energy}
                  onChange={(e) => setMoodFilters(prev => ({
                    ...prev,
                    energy: parseFloat(e.target.value)
                  }))}
                />
              </div>
              <div className="slider-group">
                <label>Danceability: {(moodFilters.danceability * 100).toFixed(0)}%</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={moodFilters.danceability}
                  onChange={(e) => setMoodFilters(prev => ({
                    ...prev,
                    danceability: parseFloat(e.target.value)
                  }))}
                />
              </div>
            </div>
            <button 
              onClick={searchByMood}
              disabled={isLoading}
              className="mood-search-button"
            >
              {isLoading ? 'Searching...' : 'Find Mood Music 🎭'}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}
        
        {searchResults.length > 0 && (
          <div className="search-results">
            <h4>Search Results</h4>
            <div className="track-list">
              {searchResults.map(track => (
                <div key={track.id} className="track-item search-result">
                  <div className="track-info">
                    {track.album?.images?.[2] && (
                      <img 
                        src={track.album.images[2].url} 
                        alt={track.album.name}
                        className="track-image"
                      />
                    )}
                    <div className="track-details">
                      <div className="track-name">{track.name}</div>
                      <div className="track-artist">
                        {track.artists?.map(artist => artist.name).join(', ')}
                      </div>
                      <div className="track-album">{track.album?.name}</div>
                      {track.moodScore && (
                        <div className="mood-score">
                          Mood Match: {(track.moodScore * 100).toFixed(0)}%
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="track-actions">
                    {track.previewUrl && (
                      <button 
                        onClick={() => playTrack(track)}
                        className="play-button"
                        title="Preview"
                      >
                        ▶️
                      </button>
                    )}
                    <button 
                      onClick={() => addToPlaylist(track)}
                      className="add-button"
                      title="Add to Playlist"
                    >
                      ➕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render playlist section
  const renderPlaylistSection = () => {
    return (
      <div className="playlist-section">
        <div className="playlist-header">
          <h3>Room Playlist ({playlist.length})</h3>
          {currentTrack && (
            <div className="now-playing">
              <span>Now Playing: {currentTrack.name}</span>
              <button 
                onClick={isPlaying ? pauseTrack : () => playTrack(currentTrack)}
                className="playback-button"
              >
                {isPlaying ? '⏸️' : '▶️'}
              </button>
            </div>
          )}
        </div>
        
        <div className="playlist">
          {playlist.length === 0 ? (
            <div className="empty-playlist">
              <p>No tracks in playlist</p>
              <p>Search and add some music to get started! 🎵</p>
            </div>
          ) : (
            <div className="track-list">
              {playlist.map((track, index) => (
                <div 
                  key={`${track.id}-${index}`} 
                  className={`track-item ${currentTrack?.id === track.id ? 'current' : ''}`}
                >
                  <div className="track-info">
                    {track.album?.images?.[2] && (
                      <img 
                        src={track.album.images[2].url} 
                        alt={track.album.name}
                        className="track-image"
                      />
                    )}
                    <div className="track-details">
                      <div className="track-name">{track.name}</div>
                      <div className="track-artist">
                        {track.artists?.map(artist => artist.name).join(', ')}
                      </div>
                      <div className="track-meta">
                        {track.duration && (
                          <span className="duration">{formatDuration(track.duration)}</span>
                        )}
                        {track.addedBy && (
                          <span className="added-by">Added by {track.addedBy}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="track-actions">
                    <button 
                      onClick={() => playTrack(track)}
                      className="play-button"
                      title="Play"
                    >
                      ▶️
                    </button>
                    <button 
                      onClick={() => removeFromPlaylist(track.id)}
                      className="remove-button"
                      title="Remove"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="playlist-panel">
      <div className="panel-header">
        <h2>🎵 Music & Mood</h2>
      </div>
      
      {renderAuthSection()}
      {renderSearchSection()}
      {renderPlaylistSection()}
    </div>
  );
};

export default PlaylistPanel;
