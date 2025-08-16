// Room component with mood tracking, participant display, and real-time chat
// Connects to Socket.IO for room management and messaging functionality
// Includes MoodBubble visualization with real-time mood fusion

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import io from 'socket.io-client';
import MoodBubble from './MoodBubble';
import PlaylistPanel from './PlaylistPanel';
import MoodMusicGenerator from './MoodMusicGenerator';
import RoomConnectionPanel from './RoomConnectionPanel';
import { useMoodFusion, useMoodVisualization } from '../hooks/useMoodFusion';

const MOOD_OPTIONS = [
  { emoji: '😊', name: 'Happy', color: 'bg-yellow-100 border-yellow-300 text-yellow-700' },
  { emoji: '😢', name: 'Sad', color: 'bg-blue-100 border-blue-300 text-blue-700' },
  { emoji: '😠', name: 'Angry', color: 'bg-red-100 border-red-300 text-red-700' },
  { emoji: '😴', name: 'Sleepy', color: 'bg-gray-100 border-gray-300 text-gray-700' },
  { emoji: '🤔', name: 'Thinking', color: 'bg-purple-100 border-purple-300 text-purple-700' },
  { emoji: '😍', name: 'Love', color: 'bg-pink-100 border-pink-300 text-pink-700' },
  { emoji: '🤯', name: 'Mind Blown', color: 'bg-orange-100 border-orange-300 text-orange-700' },
  { emoji: '🎉', name: 'Excited', color: 'bg-green-100 border-green-300 text-green-700' }
];

const Room = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentMood, setCurrentMood] = useState('😊');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  // MoodFusion integration
  const {
    fusedMood,
    isLoading: moodLoading,
    error: moodError,
    lastUpdate,
    saveMemory,
    getMemories,
    refresh: refreshMood,
    participantCount,
    hasValidMoods
  } = useMoodFusion(roomId, participants, 1000); // Update every second

  const visualMood = useMoodVisualization(fusedMood);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!currentUser || !roomId) return;

    // Connect to Socket.IO
    const newSocket = io('http://localhost:3001', {
      auth: {
        token: currentUser.accessToken,
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: userProfile?.displayName || currentUser.displayName
      }
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
      
      // Join the room
      newSocket.emit('joinRoom', { roomId });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    // Room events
    newSocket.on('room:joined', (roomData) => {
      console.log('Joined room:', roomData);
      setRoom(roomData);
      setParticipants(roomData.participants || []);
      setMessages(roomData.messages || []);
      setLoading(false);
    });

    newSocket.on('room:update', (updateData) => {
      console.log('Room updated:', updateData);
      setParticipants(updateData.participants || []);
      if (updateData.messages) {
        setMessages(updateData.messages);
      }
    });

    newSocket.on('message:received', (messageData) => {
      console.log('Message received:', messageData);
      setMessages(prev => [...prev, messageData]);
    });

    newSocket.on('message:sent', (messageData) => {
      console.log('Message sent:', messageData);
      // Message already added by message:received for consistency
    });

    newSocket.on('mood:updated', (data) => {
      console.log('Mood updated:', data);
      setCurrentMood(data.mood);
    });

    newSocket.on('room:left', () => {
      navigate('/rooms');
    });

    newSocket.on('error', (errorData) => {
      console.error('Socket error:', errorData);
      setError(errorData.message || 'An error occurred');
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.emit('leaveRoom', { roomId });
        newSocket.disconnect();
      }
    };
  }, [currentUser, userProfile, roomId, navigate]);

  const handleSendMessage = () => {
    if (!socket || !newMessage.trim() || !room) return;

    socket.emit('sendMessage', {
      roomId: room.roomId,
      message: newMessage.trim()
    });

    setNewMessage('');
  };

  const handleMoodChange = (mood) => {
    if (!socket || !room) return;

    socket.emit('updateMood', {
      roomId: room.roomId,
      mood
    });

    setCurrentMood(mood);
  };

  const handleLeaveRoom = () => {
    if (socket && room) {
      socket.emit('leaveRoom', { roomId: room.roomId });
    }
    navigate('/rooms');
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAvatarUrl = (user) => {
    return user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=6366f1&color=fff&size=40`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-indigo-600 font-medium">Joining room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/rooms')}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              Back to Rooms
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!room) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLeaveRoom}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{room.name}</h1>
                <p className="text-sm text-gray-500">Room: {room.roomId}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                connected 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  connected ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                {connected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-8 lg:grid-cols-5 gap-6">
          {/* Participants Panel */}
          <div className="xl:col-span-1 lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Participants ({participants.length})
              </h3>
              
              <div className="space-y-3">
                {participants.map((participant) => (
                  <div key={participant.userId} className="flex items-center space-x-3">
                    <img
                      src={getAvatarUrl(participant)}
                      alt={participant.displayName}
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {participant.displayName}
                        {participant.userId === currentUser?.uid && ' (You)'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {participant.mood}
                      </p>
                    </div>
                    <div className="text-2xl">
                      {participant.mood}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mood Selector */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Your Mood</h4>
                <div className="grid grid-cols-4 gap-2">
                  {MOOD_OPTIONS.map((mood) => (
                    <button
                      key={mood.emoji}
                      onClick={() => handleMoodChange(mood.emoji)}
                      className={`p-2 text-2xl rounded-lg border-2 transition-all duration-200 hover:scale-110 ${
                        currentMood === mood.emoji
                          ? mood.color
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                      title={mood.name}
                    >
                      {mood.emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood Fusion Controls */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-900">Room Mood</h4>
                  <button
                    onClick={refreshMood}
                    disabled={moodLoading}
                    className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                  >
                    {moodLoading ? 'Updating...' : 'Refresh'}
                  </button>
                </div>
                
                <div className="text-xs text-gray-500 space-y-1">
                  <div>Participants: {participantCount}</div>
                  {lastUpdate && (
                    <div>Updated: {lastUpdate.toLocaleTimeString()}</div>
                  )}
                  {moodError && (
                    <div className="text-red-500">Error: {moodError}</div>
                  )}
                </div>

                <button
                  onClick={() => saveMemory('manual', ['user-saved'])}
                  disabled={!hasValidMoods}
                  className="mt-3 w-full text-xs bg-indigo-100 text-indigo-700 px-3 py-2 rounded hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Mood Memory
                </button>
              </div>
            </div>
          </div>

          {/* Mood Visualization Panel */}
          <div className="xl:col-span-1 lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                Room Mood Orb
              </h3>
              
              <div className="flex justify-center">
                <MoodBubble
                  moodVector={visualMood.vector}
                  moodData={visualMood}
                  size={{ width: 300, height: 300 }}
                  className="rounded-lg"
                  showLegend={true}
                  enableControls={true}
                />
              </div>

              {/* Mood Vector Display */}
              <div className="mt-4 text-center">
                <div className="text-xs text-gray-500 font-mono">
                  Valence: {visualMood.vector.valence.toFixed(3)}<br/>
                  Arousal: {visualMood.vector.arousal.toFixed(3)}
                </div>
                {hasValidMoods ? (
                  <div className="text-xs text-green-600 mt-1">
                    ✓ Active fusion from {participantCount} participants
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 mt-1">
                    Waiting for participant moods...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat Panel */}
          <div className="xl:col-span-2 lg:col-span-3">
            <div className="bg-white rounded-lg shadow-lg flex flex-col h-96">
              {/* Messages */}
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500">
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    messages.map((message, index) => (
                      <div key={message.messageId || index} className="flex space-x-3">
                        {message.type === 'system' ? (
                          <div className="w-full text-center">
                            <p className="text-sm text-gray-500 italic">
                              {message.message || message.text}
                            </p>
                          </div>
                        ) : (
                          <>
                            <img
                              src={getAvatarUrl(message.user || {})}
                              alt={message.displayName || message.user?.displayName}
                              className="w-8 h-8 rounded-full"
                            />
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {message.displayName || message.user?.displayName}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatTime(message.timestamp)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 mt-1">
                                {message.message || message.text}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Message Input */}
              <div className="border-t border-gray-200 p-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={!connected}
                    maxLength={1000}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!connected || !newMessage.trim()}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Music Playlist Panel */}
          <div className="xl:col-span-2 lg:col-span-5 xl:row-span-1">
            <div className="h-96 overflow-hidden">
              <PlaylistPanel
                roomId={roomId}
                userId={currentUser?.uid}
                onMoodChange={(newMood) => {
                  // Handle mood changes from music
                  console.log('Music mood change:', newMood);
                }}
              />
            </div>
          </div>

          {/* AI Music Generator Panel */}
          <div className="xl:col-span-1 lg:col-span-5">
            <div className="h-96 overflow-hidden">
              <MoodMusicGenerator
                currentMood={fusedMood?.vector ? {
                  valence: fusedMood.vector.valence,
                  energy: fusedMood.vector.arousal, // Map arousal to energy
                  danceability: 0.5 // Default value
                } : null}
                roomMoods={participants.map(p => ({
                  valence: Math.random(), // In real implementation, get from participant mood
                  energy: Math.random(),
                  danceability: Math.random()
                }))}
                onTrackGenerated={(track) => {
                  console.log('Track generated:', track);
                }}
              />
            </div>
          </div>

          {/* Room Connection Panel */}
          <div className="xl:col-span-1 lg:col-span-5">
            <div className="h-96 overflow-hidden">
              <RoomConnectionPanel
                roomId={roomId}
                userId={currentUser?.uid}
                currentMood={fusedMood}
                socket={socket}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;
