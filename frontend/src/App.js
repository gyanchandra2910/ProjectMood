// Main App component with authentication, routing, and room system
// Integrates Firebase Auth with React Router, Socket.IO, and room management

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Profile from './components/Profile';
import Home from './components/Home';
import Rooms from './components/Rooms';
import EnhancedRoom from './components/EnhancedRoom';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/rooms" 
              element={
                <ProtectedRoute>
                  <Rooms />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/room/:roomId" 
              element={
                <ProtectedRoute>
                  <EnhancedRoom />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
