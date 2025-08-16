import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { detectFaceEmotions, loadFaceApiModels } from '../utils/faceDetection';

const FaceMood = ({ onMoodDetected, className = '' }) => {
  const [cameraPermission, setCameraPermission] = useState('unknown');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [error, setError] = useState('');
  const [allowImageSending, setAllowImageSending] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    checkCameraPermission();
    loadFaceApi();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const checkCameraPermission = async () => {
    try {
      const permission = await navigator.permissions.query({ name: 'camera' });
      setCameraPermission(permission.state);
      
      permission.addEventListener('change', () => {
        setCameraPermission(permission.state);
      });
    } catch (error) {
      console.log('Permission API not supported, will check on capture attempt');
    }
  };

  const loadFaceApi = async () => {
    try {
      // Load our local face detection models
      await loadFaceApiModels();
      setFaceApiLoaded(true);
    } catch (error) {
      console.error('Error loading face detection models:', error);
      setError('Could not load face detection models');
    }
  };

  const startCamera = async () => {
    try {
      setError('');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        } 
      });
      
      streamRef.current = stream;
      setCameraPermission('granted');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      setIsCapturing(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setCameraPermission('denied');
      setError('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsCapturing(false);
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsProcessing(true);
    
    try {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Capture frame from video
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      // For demo purposes, we'll use a simple client-side emotion detection
      // In a real implementation, you would use face-api.js here
      const mood = await detectEmotionFromImage(canvas);
      
      if (allowImageSending) {
        // Send image to server for more sophisticated analysis
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        await sendImageForAnalysis(imageData, mood);
      } else {
        // Use only client-side detection
        onMoodDetected(mood.emotion, mood.confidence);
      }
      
      // Stop camera after successful capture
      stopCamera();
      
    } catch (error) {
      console.error('Error analyzing face:', error);
      setError('Failed to analyze facial expression. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const detectEmotionFromImage = async (canvas) => {
    // Use our local face detection utility
    return await detectFaceEmotions(canvas);
  };

  const sendImageForAnalysis = async (imageData, clientSideMood) => {
    try {
      const response = await fetch('/api/face/mood', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`
        },
        body: JSON.stringify({
          image: imageData,
          clientSideMood: clientSideMood,
          userId: user?.uid || 'anonymous'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      onMoodDetected(result.mood, result.confidence);
      
    } catch (error) {
      console.error('Error sending image for analysis:', error);
      // Fall back to client-side detection
      onMoodDetected(clientSideMood.emotion, clientSideMood.confidence);
    }
  };

  const getPermissionStatus = () => {
    switch (cameraPermission) {
      case 'granted':
        return { icon: '✅', text: 'Camera access granted', color: 'text-green-600' };
      case 'denied':
        return { icon: '❌', text: 'Camera access denied', color: 'text-red-600' };
      default:
        return { icon: '❓', text: 'Camera permission unknown', color: 'text-yellow-600' };
    }
  };

  const permissionStatus = getPermissionStatus();

  return (
    <div className={`bg-white rounded-lg p-4 border shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">📷 Face Mood Analysis</h3>
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
        {/* Privacy Option */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-700">Send image to server for better accuracy</p>
            <p className="text-xs text-gray-500">Images are processed securely and deleted immediately</p>
          </div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={allowImageSending}
              onChange={(e) => setAllowImageSending(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">Allow</span>
          </label>
        </div>

        {/* Camera Controls */}
        <div className="flex flex-col items-center space-y-4">
          {!isCapturing && !isProcessing && (
            <button
              onClick={startCamera}
              disabled={cameraPermission === 'denied' || !faceApiLoaded}
              className="bg-green-600 text-white px-6 py-3 rounded-full hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              📷 Start Camera
            </button>
          )}

          {/* Video Preview */}
          {isCapturing && (
            <div className="relative">
              <video
                ref={videoRef}
                className="rounded-lg border-2 border-gray-300"
                style={{ maxWidth: '300px', maxHeight: '225px' }}
                muted
                playsInline
              />
              <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs">
                🔴 LIVE
              </div>
            </div>
          )}

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {isCapturing && !isProcessing && (
            <div className="flex space-x-3">
              <button
                onClick={captureAndAnalyze}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
              >
                📸 Capture & Analyze
              </button>
              <button
                onClick={stopCamera}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
              >
                Stop Camera
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center text-blue-600">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
              Analyzing facial expression...
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="text-sm text-gray-600 text-center">
          <p>Look at the camera and capture a photo. We'll analyze your facial expression to detect your mood.</p>
          <p className="text-xs mt-1">
            {allowImageSending
              ? "🔒 Images are sent to server for enhanced accuracy, then immediately deleted."
              : "🔒 Analysis runs locally on your device. No images sent to server."
            }
          </p>
        </div>

        {!faceApiLoaded && (
          <div className="text-center text-yellow-600 text-sm">
            ⏳ Loading face detection models...
          </div>
        )}
      </div>
    </div>
  );
};

export default FaceMood;
