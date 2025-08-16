// Enhanced Room component with voice and face mood detection
// Includes privacy consent, traditional mood selection, and advanced AI-powered mood detection

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import io from 'socket.io-client';
import VoiceMoodRecorder from './VoiceMoodRecorder';
import FaceMood from './FaceMood';
import PrivacyConsent from './PrivacyConsent';

const MOOD_OPTIONS = [
  { emoji: '😊', name: 'happy', color: 'bg-yellow-100 border-yellow-300 text-yellow-700' },
  { emoji: '😢', name: 'sad', color: 'bg-blue-100 border-blue-300 text-blue-700' },
  { emoji: '😠', name: 'angry', color: 'bg-red-100 border-red-300 text-red-700' },
  { emoji: '😴', name: 'sleepy', color: 'bg-gray-100 border-gray-300 text-gray-700' },
  { emoji: '🤔', name: 'thoughtful', color: 'bg-purple-100 border-purple-300 text-purple-700' },
  { emoji: '😍', name: 'excited', color: 'bg-pink-100 border-pink-300 text-pink-700' },
  { emoji: '🤯', name: 'surprised', color: 'bg-orange-100 border-orange-300 text-orange-700' },
  { emoji: '😌', name: 'calm', color: 'bg-green-100 border-green-300 text-green-700' }
];

const getMoodEmoji = (moodName) => {
  const mood = MOOD_OPTIONS.find(m => m.name.toLowerCase() === moodName.toLowerCase());
  return mood ? mood.emoji : '😐';
};

const getMoodColor = (moodName) => {
  const mood = MOOD_OPTIONS.find(m => m.name.toLowerCase() === moodName.toLowerCase());
  return mood ? mood.color : 'bg-gray-100 border-gray-300 text-gray-700';
};

const EnhancedRoom = () => {
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
  const [showAdvancedMood, setShowAdvancedMood] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const messagesEndRef = useRef(null);

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
        userId: currentUser.uid,
        displayName: userProfile?.displayName || currentUser.email
      }
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
      
      // Join the room
      newSocket.emit('joinRoom', {
        roomId,
        userInfo: {
          uid: currentUser.uid,
          displayName: userProfile?.displayName || currentUser.email,
          email: currentUser.email
        }
      });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    // Room events
    newSocket.on('roomJoined', (data) => {
      console.log('Joined room:', data);
      setRoom(data.room);
      setParticipants(data.room.participants || []);
      setMessages(data.room.messages || []);
      setLoading(false);
    });

    newSocket.on('participantJoined', (participant) => {
      console.log('Participant joined:', participant);
      setParticipants(prev => [...prev, participant]);
    });

    newSocket.on('participantLeft', (data) => {
      console.log('Participant left:', data);
      setParticipants(prev => prev.filter(p => p.userId !== data.userId));
    });

    newSocket.on('participantMoodUpdated', (data) => {
      console.log('Participant mood updated:', data);
      setParticipants(prev =>
        prev.map(p =>
          p.userId === data.userId
            ? { ...p, mood: data.mood, moodSource: data.moodSource, confidence: data.confidence }
            : p
        )
      );
    });

    newSocket.on('newMessage', (message) => {
      console.log('New message:', message);
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      setError(error.message || 'Connection error');
      setLoading(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [currentUser, roomId, userProfile]);

  const handleMoodChange = (moodEmoji, source = 'manual', confidence = 1.0) => {
    const mood = MOOD_OPTIONS.find(m => m.emoji === moodEmoji);
    const moodName = mood ? mood.name : 'neutral';
    
    setCurrentMood(moodEmoji);
    
    if (socket && connected) {
      socket.emit('updateMood', {
        roomId,
        mood: moodName,
        moodSource: source,
        confidence: confidence
      });
    }
  };

  const handleVoiceMoodDetected = (detectedMood, confidence) => {
    console.log('Voice mood detected:', detectedMood, confidence);
    const moodEmoji = getMoodEmoji(detectedMood);
    handleMoodChange(moodEmoji, 'voice', confidence);
  };

  const handleFaceMoodDetected = (detectedMood, confidence) => {
    console.log('Face mood detected:', detectedMood, confidence);
    const moodEmoji = getMoodEmoji(detectedMood);
    handleMoodChange(moodEmoji, 'face', confidence);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !connected) return;

    const message = {
      roomId,
      text: newMessage.trim(),
      timestamp: new Date().toISOString()
    };

    socket.emit('sendMessage', message);
    setNewMessage('');
  };

  const handleAdvancedMoodToggle = () => {
    if (!showAdvancedMood && !privacyConsent) {
      setShowPrivacyModal(true);
      return;
    }
    setShowAdvancedMood(!showAdvancedMood);
  };

  const handlePrivacyConsentGiven = (consent) => {
    setPrivacyConsent(consent);
    setShowPrivacyModal(false);
    
    if (!consent.denied) {
      setShowAdvancedMood(true);
    }
  };

  const leaveRoom = () => {
    if (socket) {
      socket.emit('leaveRoom', { roomId });
    }
    navigate('/rooms');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Joining room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Room Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/rooms')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Rooms
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Privacy Consent Modal */}
      {showPrivacyModal && (
        <PrivacyConsent
          onConsentGiven={handlePrivacyConsentGiven}
          requiredFeatures={['camera', 'microphone']}
        />
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={leaveRoom}
                className="text-gray-500 hover:text-gray-700 mr-4"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-800">
                  {room?.name || `Room ${roomId}`}
                </h1>
                <p className="text-sm text-gray-500">
                  {participants.length} participant{participants.length !== 1 ? 's' : ''}
                  {connected ? (
                    <span className="ml-2 text-green-600">● Connected</span>
                  ) : (
                    <span className="ml-2 text-red-600">● Disconnected</span>
                  )}
                </p>
              </div>
            </div>
            
            <button
              onClick={handleAdvancedMoodToggle}
              className={`px-4 py-2 rounded-lg font-medium ${
                showAdvancedMood 
                  ? 'bg-purple-600 text-white hover:bg-purple-700' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {showAdvancedMood ? '🤖 AI Mood ON' : '🤖 Enable AI Mood'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chat Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Traditional Mood Selection */}
            <div className="bg-white rounded-lg p-4 border shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">😊 Quick Mood Selection</h3>
              <div className="grid grid-cols-4 gap-2">
                {MOOD_OPTIONS.map((mood) => (
                  <button
                    key={mood.name}
                    onClick={() => handleMoodChange(mood.emoji)}
                    className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                      currentMood === mood.emoji 
                        ? mood.color + ' ring-2 ring-blue-400' 
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-2xl mb-1">{mood.emoji}</div>
                    <div className="text-xs font-medium">{mood.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Mood Detection */}
            {showAdvancedMood && privacyConsent && !privacyConsent.denied && (
              <div className="space-y-4">
                <VoiceMoodRecorder 
                  onMoodDetected={handleVoiceMoodDetected}
                  className="w-full"
                />
                <FaceMood 
                  onMoodDetected={handleFaceMoodDetected}
                  className="w-full"
                />
              </div>
            )}

            {/* Chat Messages */}
            <div className="bg-white rounded-lg border shadow-sm">
              <div className="border-b p-4">
                <h3 className="text-lg font-semibold text-gray-800">💬 Room Chat</h3>
              </div>
              
              <div className="h-80 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 mt-8">
                    <div className="text-4xl mb-2">💬</div>
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {message.senderName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900">
                            {message.senderName || 'Unknown User'}
                          </p>
                          <span className="text-xs text-gray-500">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{message.text}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <form onSubmit={handleSendMessage} className="border-t p-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || !connected}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Participants Sidebar */}
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="border-b p-4">
              <h3 className="text-lg font-semibold text-gray-800">👥 Participants</h3>
            </div>
            
            <div className="p-4 space-y-3">
              {participants.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <div className="text-4xl mb-2">👤</div>
                  <p>No participants yet</p>
                </div>
              ) : (
                participants.map((participant) => (
                  <div
                    key={participant.userId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                        {participant.displayName?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {participant.displayName || 'Unknown User'}
                          {participant.userId === currentUser?.uid && (
                            <span className="text-xs text-blue-600 ml-1">(You)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          Joined {new Date(participant.joinedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end">
                      <div className={`px-2 py-1 rounded-full text-xs ${getMoodColor(participant.mood || 'neutral')}`}>
                        <span className="mr-1">{getMoodEmoji(participant.mood || 'neutral')}</span>
                        {participant.mood || 'neutral'}
                      </div>
                      {participant.moodSource && participant.moodSource !== 'manual' && (
                        <div className="text-xs text-gray-400 mt-1 flex items-center">
                          {participant.moodSource === 'voice' && '🎤'}
                          {participant.moodSource === 'face' && '📷'}
                          <span className="ml-1">
                            {Math.round((participant.confidence || 0.8) * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedRoom;
