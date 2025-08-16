// Home component with authentication, Socket.IO, and navigation
// Enhanced with user profile integration and secure messaging

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import io from 'socket.io-client';

const Home = () => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const { currentUser, userProfile, logout } = useAuth();

  useEffect(() => {
    if (currentUser) {
      // Connect to Socket.IO server with user authentication
      const newSocket = io('http://localhost:3001', {
        auth: {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: userProfile?.displayName || currentUser.displayName
        }
      });
      
      newSocket.on('connect', () => {
        console.log('Connected to server');
        setConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        setConnected(false);
      });

      newSocket.on('message', (data) => {
        setMessages(prev => [...prev, data]);
      });

      setSocket(newSocket);

      return () => newSocket.close();
    }
  }, [currentUser, userProfile]);

  const sendMessage = () => {
    if (socket && message.trim()) {
      socket.emit('message', {
        text: message,
        user: {
          uid: currentUser.uid,
          displayName: userProfile?.displayName || currentUser.displayName,
          email: currentUser.email
        }
      });
      setMessage('');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getAvatarUrl = () => {
    return currentUser?.photoURL || userProfile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.displayName || currentUser?.displayName || 'User')}&background=6366f1&color=fff&size=40`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation Header */}
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">ProjectMood</h1>
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
              
              <div className="flex items-center space-x-3">
                <img
                  className="h-8 w-8 rounded-full"
                  src={getAvatarUrl()}
                  alt="Profile"
                />
                <span className="text-gray-700">{userProfile?.displayName || currentUser?.displayName}</span>
              </div>
              
              <Link
                to="/profile"
                className="text-indigo-600 hover:text-indigo-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Profile
              </Link>
              
              <button
                onClick={handleLogout}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Section */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome, {userProfile?.displayName || currentUser?.displayName}!
            </h2>
            <p className="text-gray-600">Start chatting with other users in real-time</p>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-2xl font-semibold text-gray-800 mb-4">
              Real-time Chat
            </h3>
            
            {/* Messages */}
            <div className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto mb-4">
              {messages.length === 0 ? (
                <p className="text-gray-500 text-center">No messages yet... Start the conversation!</p>
              ) : (
                messages.map((msg, index) => (
                  <div key={index} className="mb-3 p-3 bg-white rounded-lg shadow">
                    {typeof msg === 'string' ? (
                      <p className="text-gray-800">{msg}</p>
                    ) : (
                      <div>
                        <div className="flex items-center mb-1">
                          <span className="font-medium text-indigo-600 text-sm">
                            {msg.user?.displayName || 'Anonymous'}
                          </span>
                          <span className="text-gray-400 text-xs ml-2">
                            {new Date().toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-gray-800">{msg.text}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Message Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={!connected}
              />
              <button
                onClick={sendMessage}
                disabled={!connected || !message.trim()}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Secure Messaging</h3>
              <p className="text-gray-600">Authenticated real-time communication</p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">User Profiles</h3>
              <p className="text-gray-600">Personalized user experience</p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Firebase Auth</h3>
              <p className="text-gray-600">Secure authentication system</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
