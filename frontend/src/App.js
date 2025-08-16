// Create a React app with Socket.IO integration and Tailwind CSS styling
// This component demonstrates real-time communication with the backend server

import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Home from './components/Home';

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Connect to Socket.IO server
    const newSocket = io('http://localhost:3001');
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  return (
    <div className="App">
      <Home socket={socket} connected={connected} />
    </div>
  );
}

export default App;
