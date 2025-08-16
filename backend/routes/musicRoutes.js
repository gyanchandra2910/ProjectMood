// AI Music Generation Route - Creates mood-based music using AI services
// Handles text-to-music generation with fallback to royalty-free alternatives

const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Configuration for AI music services
const AI_SERVICES = {
  // Suno AI API (example - replace with actual service)
  suno: {
    enabled: process.env.SUNO_API_KEY ? true : false,
    apiKey: process.env.SUNO_API_KEY,
    baseUrl: 'https://api.suno.ai/v1',
    rateLimitPerMinute: 10
  },
  
  // MusicGen by Meta (Hugging Face)
  musicgen: {
    enabled: process.env.HUGGINGFACE_API_KEY ? true : false,
    apiKey: process.env.HUGGINGFACE_API_KEY,
    baseUrl: 'https://api-inference.huggingface.co/models/facebook/musicgen-small',
    rateLimitPerMinute: 5
  },
  
  // Replicate API (for various music models)
  replicate: {
    enabled: process.env.REPLICATE_API_TOKEN ? true : false,
    apiKey: process.env.REPLICATE_API_TOKEN,
    baseUrl: 'https://api.replicate.com/v1',
    rateLimitPerMinute: 20
  }
};

// Fallback royalty-free music library
const ROYALTY_FREE_LIBRARY = [
  {
    id: 'rf001',
    name: 'Peaceful Morning',
    mood: { valence: 0.7, energy: 0.3, danceability: 0.2 },
    genre: 'ambient',
    duration: 180,
    url: '/assets/music/peaceful-morning.mp3',
    description: 'Calm and uplifting ambient track'
  },
  {
    id: 'rf002',
    name: 'Energetic Workout',
    mood: { valence: 0.8, energy: 0.9, danceability: 0.8 },
    genre: 'electronic',
    duration: 210,
    url: '/assets/music/energetic-workout.mp3',
    description: 'High-energy electronic beat'
  },
  {
    id: 'rf003',
    name: 'Melancholic Rain',
    mood: { valence: 0.2, energy: 0.3, danceability: 0.1 },
    genre: 'ambient',
    duration: 240,
    url: '/assets/music/melancholic-rain.mp3',
    description: 'Sad and contemplative piano piece'
  },
  {
    id: 'rf004',
    name: 'Happy Dance',
    mood: { valence: 0.9, energy: 0.8, danceability: 0.9 },
    genre: 'pop',
    duration: 195,
    url: '/assets/music/happy-dance.mp3',
    description: 'Upbeat and danceable pop track'
  },
  {
    id: 'rf005',
    name: 'Focused Work',
    mood: { valence: 0.6, energy: 0.5, danceability: 0.3 },
    genre: 'lofi',
    duration: 300,
    url: '/assets/music/focused-work.mp3',
    description: 'Lo-fi hip-hop for concentration'
  }
];

// Rate limiting storage (in production, use Redis)
const rateLimitStore = new Map();

// Utility functions
const checkRateLimit = (service, userId) => {
  const key = `${service}-${userId}`;
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, []);
  }
  
  const requests = rateLimitStore.get(key);
  
  // Remove old requests outside the window
  const validRequests = requests.filter(timestamp => timestamp > windowStart);
  rateLimitStore.set(key, validRequests);
  
  const limit = AI_SERVICES[service]?.rateLimitPerMinute || 10;
  
  if (validRequests.length >= limit) {
    return false;
  }
  
  // Add current request
  validRequests.push(now);
  return true;
};

const generateMoodPrompt = (moodData, userPrompt = '') => {
  const { valence, energy, danceability } = moodData;
  
  let moodDescriptors = [];
  
  // Valence (happiness/sadness)
  if (valence > 0.7) {
    moodDescriptors.push('happy', 'joyful', 'uplifting');
  } else if (valence > 0.4) {
    moodDescriptors.push('neutral', 'balanced');
  } else {
    moodDescriptors.push('melancholic', 'sad', 'contemplative');
  }
  
  // Energy
  if (energy > 0.7) {
    moodDescriptors.push('energetic', 'powerful', 'intense');
  } else if (energy > 0.4) {
    moodDescriptors.push('moderate', 'steady');
  } else {
    moodDescriptors.push('calm', 'peaceful', 'relaxed');
  }
  
  // Danceability
  if (danceability > 0.7) {
    moodDescriptors.push('danceable', 'rhythmic', 'groovy');
  } else if (danceability > 0.4) {
    moodDescriptors.push('flowing', 'rhythmic');
  } else {
    moodDescriptors.push('ambient', 'atmospheric');
  }
  
  const basePrompt = `A ${moodDescriptors.join(', ')} musical piece`;
  
  return userPrompt ? `${basePrompt}. ${userPrompt}` : basePrompt;
};

const findSimilarRoyaltyFreeTrack = (targetMood) => {
  const { valence, energy, danceability } = targetMood;
  
  let bestMatch = null;
  let bestScore = Infinity;
  
  for (const track of ROYALTY_FREE_LIBRARY) {
    const score = Math.abs(track.mood.valence - valence) +
                  Math.abs(track.mood.energy - energy) +
                  Math.abs(track.mood.danceability - danceability);
    
    if (score < bestScore) {
      bestScore = score;
      bestMatch = track;
    }
  }
  
  return {
    ...bestMatch,
    moodSimilarity: 1 - (bestScore / 3), // Normalize to 0-1
    isAIGenerated: false,
    fallbackReason: 'AI service unavailable'
  };
};

// AI Service implementations
const generateWithSuno = async (prompt, moodData) => {
  if (!AI_SERVICES.suno.enabled) {
    throw new Error('Suno AI service not configured');
  }
  
  try {
    const response = await axios.post(
      `${AI_SERVICES.suno.baseUrl}/generate`,
      {
        prompt,
        mood: moodData,
        duration: 30, // 30 seconds for quick generation
        style: 'instrumental'
      },
      {
        headers: {
          'Authorization': `Bearer ${AI_SERVICES.suno.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    return {
      id: response.data.id,
      url: response.data.audio_url,
      name: `AI Generated - ${prompt.slice(0, 30)}...`,
      duration: response.data.duration || 30,
      isAIGenerated: true,
      service: 'suno',
      prompt,
      moodData
    };
  } catch (error) {
    console.error('Suno AI generation failed:', error.message);
    throw error;
  }
};

const generateWithMusicGen = async (prompt, moodData) => {
  if (!AI_SERVICES.musicgen.enabled) {
    throw new Error('MusicGen service not configured');
  }
  
  try {
    const response = await axios.post(
      AI_SERVICES.musicgen.baseUrl,
      {
        inputs: prompt,
        parameters: {
          max_length: 1024,
          do_sample: true,
          temperature: 0.7
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${AI_SERVICES.musicgen.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );
    
    // MusicGen returns audio as base64 or blob
    const audioData = response.data;
    
    // In a real implementation, you'd save this to a file and return the URL
    const filename = `musicgen-${Date.now()}.wav`;
    const filepath = path.join(process.cwd(), 'public', 'generated', filename);
    
    // Save audio file (this is simplified - handle base64/blob properly)
    await fs.writeFile(filepath, audioData);
    
    return {
      id: `musicgen-${Date.now()}`,
      url: `/generated/${filename}`,
      name: `MusicGen - ${prompt.slice(0, 30)}...`,
      duration: 30,
      isAIGenerated: true,
      service: 'musicgen',
      prompt,
      moodData
    };
  } catch (error) {
    console.error('MusicGen generation failed:', error.message);
    throw error;
  }
};

const generateWithReplicate = async (prompt, moodData) => {
  if (!AI_SERVICES.replicate.enabled) {
    throw new Error('Replicate service not configured');
  }
  
  try {
    // Start generation
    const response = await axios.post(
      `${AI_SERVICES.replicate.baseUrl}/predictions`,
      {
        version: "7a76a8258b23fae65c5a22debb8841d1d7e816b75c2f24218cd2bd8573787906",
        input: {
          prompt,
          duration: 30
        }
      },
      {
        headers: {
          'Authorization': `Token ${AI_SERVICES.replicate.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const predictionId = response.data.id;
    
    // Poll for completion (simplified - implement proper polling)
    let result = null;
    for (let i = 0; i < 30; i++) { // Max 30 attempts
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const statusResponse = await axios.get(
        `${AI_SERVICES.replicate.baseUrl}/predictions/${predictionId}`,
        {
          headers: {
            'Authorization': `Token ${AI_SERVICES.replicate.apiKey}`
          }
        }
      );
      
      if (statusResponse.data.status === 'succeeded') {
        result = statusResponse.data.output;
        break;
      } else if (statusResponse.data.status === 'failed') {
        throw new Error('Replicate generation failed');
      }
    }
    
    if (!result) {
      throw new Error('Generation timeout');
    }
    
    return {
      id: predictionId,
      url: result,
      name: `AI Music - ${prompt.slice(0, 30)}...`,
      duration: 30,
      isAIGenerated: true,
      service: 'replicate',
      prompt,
      moodData
    };
  } catch (error) {
    console.error('Replicate generation failed:', error.message);
    throw error;
  }
};

// Main generation endpoint
router.post('/generate-music', async (req, res) => {
  try {
    const {
      mood,
      prompt = '',
      duration = 30,
      style = 'instrumental',
      useAI = true
    } = req.body;
    
    const userId = req.user?.uid || 'anonymous';
    
    // Validate mood data
    if (!mood || typeof mood.valence !== 'number' || typeof mood.energy !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Valid mood data (valence, energy, danceability) is required'
      });
    }
    
    // Normalize mood values
    const normalizedMood = {
      valence: Math.max(0, Math.min(1, mood.valence)),
      energy: Math.max(0, Math.min(1, mood.energy)),
      danceability: Math.max(0, Math.min(1, mood.danceability || 0.5))
    };
    
    // Generate mood-based prompt
    const fullPrompt = generateMoodPrompt(normalizedMood, prompt);
    
    let generatedTrack = null;
    let errors = [];
    
    // Try AI generation if enabled and requested
    if (useAI) {
      const services = ['replicate', 'suno', 'musicgen'];
      
      for (const service of services) {
        if (!AI_SERVICES[service].enabled) {
          continue;
        }
        
        // Check rate limits
        if (!checkRateLimit(service, userId)) {
          errors.push(`${service}: Rate limit exceeded`);
          continue;
        }
        
        try {
          switch (service) {
            case 'suno':
              generatedTrack = await generateWithSuno(fullPrompt, normalizedMood);
              break;
            case 'musicgen':
              generatedTrack = await generateWithMusicGen(fullPrompt, normalizedMood);
              break;
            case 'replicate':
              generatedTrack = await generateWithReplicate(fullPrompt, normalizedMood);
              break;
          }
          
          if (generatedTrack) {
            break; // Success - stop trying other services
          }
        } catch (error) {
          errors.push(`${service}: ${error.message}`);
          console.error(`${service} generation failed:`, error);
        }
      }
    }
    
    // Fallback to royalty-free music if AI generation failed
    if (!generatedTrack) {
      generatedTrack = findSimilarRoyaltyFreeTrack(normalizedMood);
      errors.push('AI generation failed, using royalty-free alternative');
    }
    
    // Add metadata
    const result = {
      ...generatedTrack,
      generatedAt: new Date().toISOString(),
      requestedMood: normalizedMood,
      requestedPrompt: prompt,
      fullPrompt,
      userId
    };
    
    res.json({
      success: true,
      track: result,
      mood: normalizedMood,
      aiGenerated: generatedTrack.isAIGenerated,
      warnings: errors.length > 0 ? errors : undefined,
      availableServices: Object.entries(AI_SERVICES)
        .filter(([_, config]) => config.enabled)
        .map(([name]) => name)
    });
    
  } catch (error) {
    console.error('Music generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Music generation failed',
      details: error.message
    });
  }
});

// Get available AI services status
router.get('/services', (req, res) => {
  const serviceStatus = Object.entries(AI_SERVICES).map(([name, config]) => ({
    name,
    enabled: config.enabled,
    rateLimitPerMinute: config.rateLimitPerMinute
  }));
  
  res.json({
    success: true,
    services: serviceStatus,
    royaltyFreeLibrary: {
      available: true,
      trackCount: ROYALTY_FREE_LIBRARY.length
    },
    fallbackEnabled: true
  });
});

// Get royalty-free music library
router.get('/library', (req, res) => {
  const { mood } = req.query;
  
  let tracks = ROYALTY_FREE_LIBRARY;
  
  // Filter by mood if provided
  if (mood) {
    try {
      const targetMood = JSON.parse(mood);
      tracks = tracks.map(track => ({
        ...track,
        moodSimilarity: 1 - (
          Math.abs(track.mood.valence - targetMood.valence) +
          Math.abs(track.mood.energy - targetMood.energy) +
          Math.abs(track.mood.danceability - (targetMood.danceability || 0.5))
        ) / 3
      })).sort((a, b) => b.moodSimilarity - a.moodSimilarity);
    } catch (error) {
      // Invalid mood JSON, return all tracks
    }
  }
  
  res.json({
    success: true,
    tracks,
    total: tracks.length
  });
});

// Generate music from room mood
router.post('/generate-from-room', async (req, res) => {
  try {
    const { roomId, participantMoods = [] } = req.body;
    
    if (!roomId) {
      return res.status(400).json({
        success: false,
        error: 'Room ID is required'
      });
    }
    
    if (participantMoods.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one participant mood is required'
      });
    }
    
    // Calculate average room mood
    const averageMood = {
      valence: participantMoods.reduce((sum, mood) => sum + mood.valence, 0) / participantMoods.length,
      energy: participantMoods.reduce((sum, mood) => sum + mood.energy, 0) / participantMoods.length,
      danceability: participantMoods.reduce((sum, mood) => sum + (mood.danceability || 0.5), 0) / participantMoods.length
    };
    
    // Generate prompt based on room context
    const roomPrompt = `Music for a group mood session with ${participantMoods.length} participants`;
    
    // Use the main generation endpoint
    req.body = {
      mood: averageMood,
      prompt: roomPrompt,
      useAI: true
    };
    
    // Call the main generation function
    return router.handle(req, res);
    
  } catch (error) {
    console.error('Room mood generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Room mood generation failed',
      details: error.message
    });
  }
});

module.exports = router;
