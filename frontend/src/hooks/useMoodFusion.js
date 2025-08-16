// useMoodFusion Hook - Manages mood fusion data and API communication
// Provides real-time mood updates and smooth transitions

import { useState, useEffect, useRef, useCallback } from 'react';

const MOOD_FUSION_API_BASE = 'http://localhost:3001/api';

// Convert room participants' moods to MoodFusion API format
const participantsToMoodInputs = (participants) => {
  return participants
    .filter(p => p.isOnline && p.mood)
    .map(p => ({
      mood: p.mood,
      confidence: p.confidence || 0.8,
      weight: 1.0,
      source: p.moodSource || 'manual'
    }));
};

// Default mood state
const DEFAULT_MOOD = {
  vector: { valence: 0, arousal: 0 },
  label: 'neutral',
  confidence: 1.0,
  source: 'default'
};

export const useMoodFusion = (roomId, participants = [], updateInterval = 1000) => {
  const [fusedMood, setFusedMood] = useState(DEFAULT_MOOD);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  const intervalRef = useRef(null);
  const lastParticipantsRef = useRef([]);

  // API call to fuse moods
  const callMoodFusion = useCallback(async (moodInputs) => {
    if (!moodInputs || moodInputs.length === 0) {
      setFusedMood(DEFAULT_MOOD);
      return DEFAULT_MOOD;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${MOOD_FUSION_API_BASE}/mood/fuse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'room-user',
          'x-user-name': 'Room Client'
        },
        body: JSON.stringify({ moodInputs })
      });

      if (!response.ok) {
        throw new Error(`Mood fusion failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.result) {
        const newMood = {
          vector: data.result.vector,
          label: data.result.label,
          confidence: data.result.confidence,
          source: data.result.source,
          contributingMoods: data.result.contributingMoods
        };
        
        setFusedMood(newMood);
        setLastUpdate(new Date());
        return newMood;
      } else {
        throw new Error('Invalid mood fusion response');
      }
    } catch (err) {
      console.error('Mood fusion error:', err);
      setError(err.message);
      // Return previous mood on error to maintain continuity
      return fusedMood;
    } finally {
      setIsLoading(false);
    }
  }, [fusedMood]);

  // Update mood based on current participants
  const updateMood = useCallback(async () => {
    const moodInputs = participantsToMoodInputs(participants);
    return await callMoodFusion(moodInputs);
  }, [participants, callMoodFusion]);

  // Manual mood fusion trigger
  const fuseMoods = useCallback(async (customMoodInputs) => {
    return await callMoodFusion(customMoodInputs);
  }, [callMoodFusion]);

  // Save current mood as memory
  const saveMemory = useCallback(async (trigger = 'manual', tags = []) => {
    if (!roomId) return null;

    try {
      const response = await fetch(`${MOOD_FUSION_API_BASE}/rooms/${roomId}/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'room-user',
          'x-user-name': 'Room Client'
        },
        body: JSON.stringify({ trigger, tags })
      });

      if (!response.ok) {
        throw new Error(`Memory save failed: ${response.status}`);
      }

      const data = await response.json();
      return data.memory;
    } catch (err) {
      console.error('Memory save error:', err);
      setError(err.message);
      return null;
    }
  }, [roomId]);

  // Get room memories
  const getMemories = useCallback(async (limit = 20, offset = 0) => {
    if (!roomId) return [];

    try {
      const response = await fetch(
        `${MOOD_FUSION_API_BASE}/rooms/${roomId}/memories?limit=${limit}&offset=${offset}`,
        {
          headers: {
            'x-user-id': 'room-user',
            'x-user-name': 'Room Client'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Memory fetch failed: ${response.status}`);
      }

      const data = await response.json();
      return data.memories || [];
    } catch (err) {
      console.error('Memory fetch error:', err);
      setError(err.message);
      return [];
    }
  }, [roomId]);

  // Check if participants have changed
  const participantsChanged = useCallback(() => {
    const current = participants.map(p => `${p.userId}:${p.mood}:${p.confidence}`).sort();
    const previous = lastParticipantsRef.current.map(p => `${p.userId}:${p.mood}:${p.confidence}`).sort();
    
    return JSON.stringify(current) !== JSON.stringify(previous);
  }, [participants]);

  // Set up automatic mood updates
  useEffect(() => {
    if (!roomId) return;

    const startAutoUpdate = () => {
      intervalRef.current = setInterval(async () => {
        // Only update if participants have changed or it's been a while
        if (participantsChanged() || !lastUpdate || Date.now() - lastUpdate.getTime() > updateInterval * 5) {
          await updateMood();
          lastParticipantsRef.current = [...participants];
        }
      }, updateInterval);
    };

    // Initial update
    updateMood().then(() => {
      lastParticipantsRef.current = [...participants];
      startAutoUpdate();
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [roomId, updateInterval, updateMood, participantsChanged, participants, lastUpdate]);

  // Manual refresh
  const refresh = useCallback(async () => {
    await updateMood();
  }, [updateMood]);

  return {
    // Current mood state
    fusedMood,
    isLoading,
    error,
    lastUpdate,
    
    // Actions
    fuseMoods,
    saveMemory,
    getMemories,
    refresh,
    
    // Utilities
    participantCount: participants.filter(p => p.isOnline && p.mood).length,
    hasValidMoods: participants.some(p => p.isOnline && p.mood)
  };
};

// Helper hook for mood visualization
export const useMoodVisualization = (fusedMood) => {
  const [visualMood, setVisualMood] = useState(fusedMood);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!fusedMood) return;

    // Smooth transition to new mood
    const startMood = { ...visualMood };
    const targetMood = { ...fusedMood };
    const startTime = Date.now();
    const duration = 1500; // 1.5 second transition

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);

      const interpolated = {
        ...targetMood,
        vector: {
          valence: startMood.vector.valence + (targetMood.vector.valence - startMood.vector.valence) * eased,
          arousal: startMood.vector.arousal + (targetMood.vector.arousal - startMood.vector.arousal) * eased
        },
        confidence: startMood.confidence + (targetMood.confidence - startMood.confidence) * eased
      };

      setVisualMood(interpolated);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [fusedMood, visualMood]);

  return visualMood;
};
