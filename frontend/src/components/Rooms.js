// Rooms component for listing available rooms and creating new ones
// Displays active rooms with participant counts and allows room creation

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import io from 'socket.io-client';

const Rooms = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRoom, setNewRoom] = useState({
    name: '',
    description: ''
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser) return;

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
      newSocket.emit('getRooms');
    });

    newSocket.on('rooms:list', (roomList) => {
      console.log('Rooms received:', roomList);
      setRooms(roomList);
      setLoading(false);
    });

    newSocket.on('room:created', (roomData) => {
      console.log('Room created:', roomData);
      navigate(`/room/${roomData.roomId}`);
    });

    newSocket.on('error', (errorData) => {
      console.error('Socket error:', errorData);
      setError(errorData.message || 'An error occurred');
      setCreating(false);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [currentUser, userProfile, navigate]);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    
    if (!socket || !newRoom.name.trim()) {
      setError('Room name is required');
      return;
    }

    setCreating(true);
    setError('');

    socket.emit('createRoom', {
      name: newRoom.name.trim(),
      description: newRoom.description.trim()
    });
  };

  const handleJoinRoom = (roomId) => {
    navigate(`/room/${roomId}`);
  };

  const formatLastActivity = (timestamp) => {
    const now = new Date();
    const activity = new Date(timestamp);
    const diffMs = now - activity;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Mood Rooms</h1>
            </div>
            
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create Room
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Create Room Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Room</h2>
              
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Room Name *
                  </label>
                  <input
                    type="text"
                    value={newRoom.name}
                    onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter room name"
                    maxLength={100}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    value={newRoom.description}
                    onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Describe your room"
                    rows={3}
                    maxLength={500}
                  />
                </div>
                
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={creating || !newRoom.name.trim()}
                    className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {creating ? 'Creating...' : 'Create Room'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewRoom({ name: '', description: '' });
                      setError('');
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Rooms List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading rooms...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">🏠</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No rooms available</h3>
                <p className="text-gray-600 mb-4">Create the first room to get started!</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700"
                >
                  Create Room
                </button>
              </div>
            ) : (
              rooms.map((room) => (
                <div
                  key={room.roomId}
                  className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-200"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {room.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Room ID: {room.roomId}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-indigo-600">
                          {room.participantCount}
                        </div>
                        <div className="text-xs text-gray-500">
                          participant{room.participantCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    
                    {room.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {room.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        Active {formatLastActivity(room.lastActivity)}
                      </span>
                      <button
                        onClick={() => handleJoinRoom(room.roomId)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        Join Room
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-12 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">How Mood Rooms Work</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🏠</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">Create or Join</h3>
              <p className="text-sm text-gray-600">
                Create a new room or join an existing one to connect with others
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">😊</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">Share Your Mood</h3>
              <p className="text-sm text-gray-600">
                Select from 8 different moods to let others know how you're feeling
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">Chat & Connect</h3>
              <p className="text-sm text-gray-600">
                Real-time messaging with participants in the same mood space
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Rooms;
