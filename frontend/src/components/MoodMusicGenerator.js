// MoodMusicGenerator - React component for AI music generation
// Handles mood-to-music conversion with download capabilities

import React, { useState, useRef, useEffect } from 'react';
import './MoodMusicGenerator.css';

const MoodMusicGenerator = ({ currentMood, roomMoods = [], onTrackGenerated }) => {
  // State management
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTrack, setGeneratedTrack] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generationMode, setGenerationMode] = useState('current'); // 'current', 'room', 'custom'
  const [useAI, setUseAI] = useState(true);
  const [availableServices, setAvailableServices] = useState([]);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [generationHistory, setGenerationHistory] = useState([]);

  // Audio reference for preview
  const audioRef = useRef(null);

  // API base URL
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

  // Load available services on mount
  useEffect(() => {
    loadAvailableServices();
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Load available AI services
  const loadAvailableServices = async () => {
    try {
      const response = await fetch(`${API_BASE}/music/services`);
      const data = await response.json();
      
      if (data.success) {
        setAvailableServices(data.services.filter(service => service.enabled));
      }
    } catch (error) {
      console.error('Failed to load services:', error);
    }
  };

  // Generate music based on current mode
  const generateMusic = async () => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    setError('');
    setGeneratedTrack(null);
    
    try {
      let requestBody = {};
      let endpoint = '/music/generate-music';
      
      switch (generationMode) {
        case 'current':
          if (!currentMood) {
            throw new Error('No current mood available');
          }
          requestBody = {
            mood: currentMood,
            prompt: customPrompt,
            useAI
          };
          break;
          
        case 'room':
          if (!roomMoods || roomMoods.length === 0) {
            throw new Error('No room moods available');
          }
          endpoint = '/music/generate-from-room';
          requestBody = {
            roomId: 'current-room', // Should be passed as prop
            participantMoods: roomMoods,
            useAI
          };
          break;
          
        case 'custom':
          if (!customPrompt.trim()) {
            throw new Error('Please enter a prompt for custom generation');
          }
          requestBody = {
            mood: { valence: 0.5, energy: 0.5, danceability: 0.5 }, // Neutral mood
            prompt: customPrompt,
            useAI
          };
          break;
          
        default:
          throw new Error('Invalid generation mode');
      }
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      
      if (data.success) {
        const track = {
          ...data.track,
          generatedAt: new Date(),
          mode: generationMode
        };
        
        setGeneratedTrack(track);
        setGenerationHistory(prev => [track, ...prev.slice(0, 4)]); // Keep last 5
        
        // Notify parent component
        if (onTrackGenerated) {
          onTrackGenerated(track);
        }
        
        // Show warnings if any
        if (data.warnings && data.warnings.length > 0) {
          console.warn('Generation warnings:', data.warnings);
        }
      } else {
        throw new Error(data.error || 'Generation failed');
      }
      
    } catch (error) {
      setError(error.message);
      console.error('Music generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Play/pause generated track
  const togglePlayback = () => {
    if (!generatedTrack?.url) return;
    
    if (!audioRef.current) {
      audioRef.current = new Audio(generatedTrack.url);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onerror = () => {
        setError('Failed to load audio');
        setIsPlaying(false);
      };
    }
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Download generated track
  const downloadTrack = async () => {
    if (!generatedTrack?.url) return;
    
    try {
      setDownloadProgress(0);
      
      const response = await fetch(generatedTrack.url);
      const contentLength = response.headers.get('content-length');
      const total = parseInt(contentLength, 10);
      let loaded = 0;
      
      const reader = response.body.getReader();
      const chunks = [];
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        loaded += value.length;
        
        if (total) {
          setDownloadProgress((loaded / total) * 100);
        }
      }
      
      const blob = new Blob(chunks, { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedTrack.name || 'mood-music'}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      setDownloadProgress(0);
      
    } catch (error) {
      setError('Download failed');
      console.error('Download error:', error);
    }
  };

  // Format mood values for display
  const formatMoodValue = (value, label) => {
    const percentage = Math.round(value * 100);
    return `${label}: ${percentage}%`;
  };

  // Get mood description
  const getMoodDescription = (mood) => {
    const { valence, energy, danceability } = mood;
    
    let description = '';
    
    if (valence > 0.7) description += 'Happy ';
    else if (valence < 0.3) description += 'Sad ';
    else description += 'Neutral ';
    
    if (energy > 0.7) description += 'High-energy ';
    else if (energy < 0.3) description += 'Low-energy ';
    else description += 'Medium-energy ';
    
    if (danceability > 0.7) description += 'Danceable';
    else if (danceability < 0.3) description += 'Ambient';
    else description += 'Rhythmic';
    
    return description.trim();
  };

  // Render mood visualization
  const renderMoodViz = (mood, title) => (
    <div className="mood-visualization">
      <h4>{title}</h4>
      <div className="mood-bars">
        <div className="mood-bar">
          <label>Happiness</label>
          <div className="bar-container">
            <div 
              className="bar-fill valence" 
              style={{ width: `${mood.valence * 100}%` }}
            />
          </div>
          <span>{Math.round(mood.valence * 100)}%</span>
        </div>
        <div className="mood-bar">
          <label>Energy</label>
          <div className="bar-container">
            <div 
              className="bar-fill energy" 
              style={{ width: `${mood.energy * 100}%` }}
            />
          </div>
          <span>{Math.round(mood.energy * 100)}%</span>
        </div>
        <div className="mood-bar">
          <label>Dance</label>
          <div className="bar-container">
            <div 
              className="bar-fill danceability" 
              style={{ width: `${(mood.danceability || 0.5) * 100}%` }}
            />
          </div>
          <span>{Math.round((mood.danceability || 0.5) * 100)}%</span>
        </div>
      </div>
      <div className="mood-description">
        {getMoodDescription(mood)}
      </div>
    </div>
  );

  return (
    <div className="mood-music-generator">
      <div className="generator-header">
        <h2>🎵 AI Music Generator</h2>
        <p>Transform your mood into music</p>
      </div>

      {/* Generation Mode Selection */}
      <div className="generation-modes">
        <h3>Generation Mode</h3>
        <div className="mode-buttons">
          <button
            className={`mode-button ${generationMode === 'current' ? 'active' : ''}`}
            onClick={() => setGenerationMode('current')}
            disabled={!currentMood}
          >
            <span className="mode-icon">😊</span>
            <span>Current Mood</span>
          </button>
          <button
            className={`mode-button ${generationMode === 'room' ? 'active' : ''}`}
            onClick={() => setGenerationMode('room')}
            disabled={!roomMoods || roomMoods.length === 0}
          >
            <span className="mode-icon">👥</span>
            <span>Room Average</span>
          </button>
          <button
            className={`mode-button ${generationMode === 'custom' ? 'active' : ''}`}
            onClick={() => setGenerationMode('custom')}
          >
            <span className="mode-icon">✨</span>
            <span>Custom Prompt</span>
          </button>
        </div>
      </div>

      {/* Mood Visualization */}
      {generationMode === 'current' && currentMood && 
        renderMoodViz(currentMood, 'Your Current Mood')
      }
      
      {generationMode === 'room' && roomMoods && roomMoods.length > 0 && (
        <div className="room-moods">
          <h4>Room Participants ({roomMoods.length})</h4>
          <div className="participants-grid">
            {roomMoods.slice(0, 4).map((mood, index) => (
              <div key={index} className="participant-mood">
                <div className="mood-indicators">
                  <div className="indicator valence" style={{ height: `${mood.valence * 100}%` }} />
                  <div className="indicator energy" style={{ height: `${mood.energy * 100}%` }} />
                  <div className="indicator dance" style={{ height: `${(mood.danceability || 0.5) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Prompt Input */}
      {(generationMode === 'custom' || generationMode === 'current') && (
        <div className="prompt-section">
          <h4>Additional Instructions (Optional)</h4>
          <textarea
            placeholder={generationMode === 'custom' 
              ? "Describe the music you want... (e.g., 'upbeat electronic dance music with synthesizers')"
              : "Add specific instructions... (e.g., 'with piano', 'rock style', 'orchestral')"
            }
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="prompt-input"
            rows={3}
          />
        </div>
      )}

      {/* AI Service Options */}
      <div className="service-options">
        <div className="option-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={useAI}
              onChange={(e) => setUseAI(e.target.checked)}
            />
            <span>Use AI Generation</span>
          </label>
          {!useAI && (
            <span className="fallback-notice">
              Will use royalty-free music library
            </span>
          )}
        </div>
        {availableServices.length > 0 && (
          <div className="available-services">
            <span>Available AI Services: {availableServices.map(s => s.name).join(', ')}</span>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <div className="generate-section">
        <button
          onClick={generateMusic}
          disabled={isGenerating}
          className="generate-button"
        >
          {isGenerating ? (
            <>
              <span className="spinner">⏳</span>
              Generating Music...
            </>
          ) : (
            <>
              <span>🎼</span>
              Generate Music
            </>
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {/* Generated Track Display */}
      {generatedTrack && (
        <div className="generated-track">
          <h3>Generated Track</h3>
          <div className="track-info">
            <div className="track-details">
              <h4>{generatedTrack.name}</h4>
              <p className="track-description">{generatedTrack.description}</p>
              <div className="track-metadata">
                <span className="metadata-item">
                  🎵 {generatedTrack.isAIGenerated ? 'AI Generated' : 'Royalty-Free'}
                </span>
                {generatedTrack.service && (
                  <span className="metadata-item">
                    🤖 {generatedTrack.service}
                  </span>
                )}
                <span className="metadata-item">
                  ⏱️ {generatedTrack.duration}s
                </span>
                {generatedTrack.moodSimilarity && (
                  <span className="metadata-item">
                    🎯 {Math.round(generatedTrack.moodSimilarity * 100)}% match
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="track-controls">
            <button
              onClick={togglePlayback}
              className="control-button play-button"
              disabled={!generatedTrack.url}
            >
              {isPlaying ? '⏸️' : '▶️'}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            
            <button
              onClick={downloadTrack}
              className="control-button download-button"
              disabled={!generatedTrack.url || downloadProgress > 0}
            >
              {downloadProgress > 0 ? (
                <>
                  <span className="download-progress">⬇️ {Math.round(downloadProgress)}%</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  Download
                </>
              )}
            </button>
          </div>

          {generatedTrack.requestedMood && (
            <div className="mood-match">
              {renderMoodViz(generatedTrack.requestedMood, 'Generated For Mood')}
            </div>
          )}
        </div>
      )}

      {/* Generation History */}
      {generationHistory.length > 0 && (
        <div className="generation-history">
          <h3>Recent Generations</h3>
          <div className="history-list">
            {generationHistory.slice(0, 3).map((track, index) => (
              <div key={`${track.id}-${index}`} className="history-item">
                <div className="history-info">
                  <span className="history-name">{track.name}</span>
                  <span className="history-meta">
                    {track.mode} • {track.isAIGenerated ? 'AI' : 'RF'}
                  </span>
                </div>
                <div className="history-actions">
                  <button
                    onClick={() => setGeneratedTrack(track)}
                    className="history-button"
                    title="Load Track"
                  >
                    📁
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

export default MoodMusicGenerator;
