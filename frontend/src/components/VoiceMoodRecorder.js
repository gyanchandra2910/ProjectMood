import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const VoiceMoodRecorder = ({ onMoodDetected, className = '' }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioPermission, setAudioPermission] = useState('unknown'); // 'unknown', 'granted', 'denied'
  const [isProcessing, setIsProcessing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const { user } = useAuth();

  useEffect(() => {
    checkAudioPermission();
    return () => {
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const checkAudioPermission = async () => {
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' });
      setAudioPermission(permission.state);
      
      permission.addEventListener('change', () => {
        setAudioPermission(permission.state);
      });
    } catch (error) {
      console.log('Permission API not supported, will check on record attempt');
    }
  };

  const setupAudioContext = (stream) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      // Start monitoring audio levels
      monitorAudioLevel();
    } catch (error) {
      console.error('Error setting up audio context:', error);
    }
  };

  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const checkLevel = () => {
      if (!isRecording) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      setAudioLevel(Math.round((average / 255) * 100));
      
      requestAnimationFrame(checkLevel);
    };
    
    checkLevel();
  };

  const startRecording = async () => {
    try {
      setError('');
      setIsProcessing(false);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      streamRef.current = stream;
      setAudioPermission('granted');
      
      // Setup audio monitoring
      setupAudioContext(stream);
      
      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        // Cleanup
        stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      
      // 6-second countdown
      let timeLeft = 6;
      setCountdown(timeLeft);
      
      const countdownInterval = setInterval(() => {
        timeLeft--;
        setCountdown(timeLeft);
        
        if (timeLeft <= 0) {
          clearInterval(countdownInterval);
          stopRecording();
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setAudioPermission('denied');
      setError('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setCountdown(0);
      setAudioLevel(0);
    }
  };

  const processAudio = async (audioBlob) => {
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('userId', user?.uid || 'anonymous');
      
      const response = await fetch('/api/voice/mood', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.mood) {
        onMoodDetected(result.mood, result.confidence || 0.8);
      } else {
        throw new Error('No mood detected in audio');
      }
      
    } catch (error) {
      console.error('Error processing audio:', error);
      setError('Failed to analyze audio. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getPermissionStatus = () => {
    switch (audioPermission) {
      case 'granted':
        return { icon: '✅', text: 'Microphone access granted', color: 'text-green-600' };
      case 'denied':
        return { icon: '❌', text: 'Microphone access denied', color: 'text-red-600' };
      default:
        return { icon: '❓', text: 'Microphone permission unknown', color: 'text-yellow-600' };
    }
  };

  const permissionStatus = getPermissionStatus();

  return (
    <div className={`bg-white rounded-lg p-4 border shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">🎤 Voice Mood Analysis</h3>
        <span className={`text-sm ${permissionStatus.color}`}>
          {permissionStatus.icon} {permissionStatus.text}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Recording Controls */}
        <div className="flex items-center justify-center">
          {!isRecording && !isProcessing && (
            <button
              onClick={startRecording}
              disabled={audioPermission === 'denied'}
              className="bg-blue-600 text-white px-6 py-3 rounded-full hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              🎤 Record 6 seconds
            </button>
          )}

          {isRecording && (
            <div className="flex flex-col items-center">
              <div className="bg-red-600 text-white px-6 py-3 rounded-full mb-2">
                🔴 Recording... {countdown}s
              </div>
              <button
                onClick={stopRecording}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Stop early
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center text-blue-600">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
              Analyzing voice...
            </div>
          )}
        </div>

        {/* Audio Level Indicator */}
        {isRecording && (
          <div className="space-y-2">
            <div className="text-sm text-gray-600 text-center">Audio Level</div>
            <div className="bg-gray-200 rounded-full h-3">
              <div
                className="bg-green-500 h-3 rounded-full transition-all duration-100"
                style={{ width: `${audioLevel}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-sm text-gray-600 text-center">
          <p>Speak naturally for 6 seconds. We'll analyze your voice tone to detect your mood.</p>
          <p className="text-xs mt-1">
            {audioPermission === 'granted' 
              ? "✅ Audio will be processed securely and not stored by default."
              : "⚠️ Microphone access required for voice mood detection."
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default VoiceMoodRecorder;
