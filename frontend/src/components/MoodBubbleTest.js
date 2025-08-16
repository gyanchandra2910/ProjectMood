// MoodBubble Test Component - Demonstrates the Three.js mood visualization
// Shows different mood states and transitions

import React, { useState, useEffect } from 'react';
import MoodBubble from './MoodBubble';

const MoodBubbleTest = () => {
  const [currentMoodIndex, setCurrentMoodIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);

  // Test mood vectors representing different emotional states
  const testMoods = [
    {
      vector: { valence: 0.8, arousal: 0.7 },
      label: 'Energetic',
      confidence: 0.9,
      source: 'test'
    },
    {
      vector: { valence: 0.6, arousal: -0.4 },
      label: 'Calm',
      confidence: 0.8,
      source: 'test'
    },
    {
      vector: { valence: -0.6, arousal: 0.5 },
      label: 'Anxious',
      confidence: 0.7,
      source: 'test'
    },
    {
      vector: { valence: -0.4, arousal: -0.6 },
      label: 'Sad',
      confidence: 0.85,
      source: 'test'
    },
    {
      vector: { valence: 0.2, arousal: 0.1 },
      label: 'Content',
      confidence: 0.75,
      source: 'test'
    },
    {
      vector: { valence: 0.0, arousal: 0.0 },
      label: 'Neutral',
      confidence: 1.0,
      source: 'test'
    }
  ];

  // Auto-cycle through moods
  useEffect(() => {
    if (!isAnimating) return;

    const interval = setInterval(() => {
      setCurrentMoodIndex((prev) => (prev + 1) % testMoods.length);
    }, 3000); // Change mood every 3 seconds

    return () => clearInterval(interval);
  }, [isAnimating, testMoods.length]);

  const currentMood = testMoods[currentMoodIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            MoodBubble Visualization Test
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Three.js mood orb that responds to valence-arousal coordinates
          </p>
          
          {/* Controls */}
          <div className="flex justify-center items-center space-x-4 mb-8">
            <button
              onClick={() => setIsAnimating(!isAnimating)}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                isAnimating 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {isAnimating ? 'Pause Auto-Cycle' : 'Start Auto-Cycle'}
            </button>
            
            <span className="text-gray-500">|</span>
            
            <div className="flex space-x-2">
              {testMoods.map((mood, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentMoodIndex(index);
                    setIsAnimating(false);
                  }}
                  className={`px-3 py-1 text-sm rounded ${
                    index === currentMoodIndex
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {mood.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Main MoodBubble */}
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 text-center">
              Interactive Mood Orb
            </h2>
            
            <div className="flex justify-center">
              <MoodBubble
                moodVector={currentMood.vector}
                moodData={currentMood}
                size={{ width: 500, height: 500 }}
                showLegend={true}
                enableControls={true}
                className="border rounded-lg"
              />
            </div>
            
            <div className="mt-4 text-center">
              <p className="text-lg font-medium text-gray-900">
                Current Mood: <span className="text-indigo-600">{currentMood.label}</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {isAnimating ? 'Auto-cycling through moods...' : 'Manual mode - use buttons above'}
              </p>
            </div>
          </div>

          {/* Mood Information Panel */}
          <div className="space-y-6">
            {/* Current Mood Details */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Mood Analysis
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Label:</span>
                  <span className="text-indigo-600 font-semibold">{currentMood.label}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="font-medium">Valence:</span>
                  <span className="font-mono">
                    {currentMood.vector.valence.toFixed(3)}
                    <span className="text-sm text-gray-500 ml-2">
                      ({currentMood.vector.valence > 0 ? 'Positive' : 'Negative'})
                    </span>
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="font-medium">Arousal:</span>
                  <span className="font-mono">
                    {currentMood.vector.arousal.toFixed(3)}
                    <span className="text-sm text-gray-500 ml-2">
                      ({currentMood.vector.arousal > 0 ? 'High Energy' : 'Low Energy'})
                    </span>
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="font-medium">Confidence:</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono">{(currentMood.confidence * 100).toFixed(1)}%</span>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${currentMood.confidence * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Valence-Arousal Quadrants */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Emotional Quadrants
              </h3>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className={`p-3 rounded-lg border-2 ${
                  currentMood.vector.valence > 0 && currentMood.vector.arousal > 0
                    ? 'border-yellow-400 bg-yellow-50'
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="font-medium text-yellow-700">High Arousal + Positive</div>
                  <div className="text-gray-600">Excited, Energetic, Happy</div>
                </div>
                
                <div className={`p-3 rounded-lg border-2 ${
                  currentMood.vector.valence <= 0 && currentMood.vector.arousal > 0
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="font-medium text-red-700">High Arousal + Negative</div>
                  <div className="text-gray-600">Angry, Anxious, Stressed</div>
                </div>
                
                <div className={`p-3 rounded-lg border-2 ${
                  currentMood.vector.valence > 0 && currentMood.vector.arousal <= 0
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="font-medium text-green-700">Low Arousal + Positive</div>
                  <div className="text-gray-600">Calm, Content, Peaceful</div>
                </div>
                
                <div className={`p-3 rounded-lg border-2 ${
                  currentMood.vector.valence <= 0 && currentMood.vector.arousal <= 0
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="font-medium text-blue-700">Low Arousal + Negative</div>
                  <div className="text-gray-600">Sad, Depressed, Tired</div>
                </div>
              </div>
            </div>

            {/* Technical Info */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Technical Features
              </h3>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div>✓ Three.js WebGL rendering</div>
                <div>✓ HSL color mapping from valence-arousal</div>
                <div>✓ Surface noise based on arousal intensity</div>
                <div>✓ Smooth lerp transitions between states</div>
                <div>✓ Real-time shader animation</div>
                <div>✓ Interactive orbit controls</div>
                <div>✓ Confidence-based visual effects</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoodBubbleTest;
