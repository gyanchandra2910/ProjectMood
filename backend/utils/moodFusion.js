// MoodFusion Module - Advanced mood analysis using valence-arousal theory

const MOOD_MAPPINGS = {
  excited: { valence: 0.8, arousal: 0.9, label: 'Excited' },
  happy: { valence: 0.7, arousal: 0.6, label: 'Happy' },
  surprised: { valence: 0.3, arousal: 0.8, label: 'Surprised' },
  calm: { valence: 0.6, arousal: -0.4, label: 'Calm' },
  content: { valence: 0.5, arousal: -0.2, label: 'Content' },
  peaceful: { valence: 0.7, arousal: -0.6, label: 'Peaceful' },
  sad: { valence: -0.6, arousal: -0.4, label: 'Sad' },
  depressed: { valence: -0.8, arousal: -0.7, label: 'Depressed' },
  sleepy: { valence: -0.1, arousal: -0.8, label: 'Sleepy' },
  bored: { valence: -0.3, arousal: -0.6, label: 'Bored' },
  angry: { valence: -0.7, arousal: 0.8, label: 'Angry' },
  anxious: { valence: -0.5, arousal: 0.7, label: 'Anxious' },
  frustrated: { valence: -0.6, arousal: 0.6, label: 'Frustrated' },
  neutral: { valence: 0.0, arousal: 0.0, label: 'Neutral' },
  thoughtful: { valence: 0.1, arousal: 0.2, label: 'Thoughtful' },
  focused: { valence: 0.2, arousal: 0.4, label: 'Focused' }
};

const EMOJI_TO_MOOD = {
  '😊': 'happy',
  '😢': 'sad', 
  '😠': 'angry',
  '😴': 'sleepy',
  '🤔': 'thoughtful',
  '😍': 'excited',
  '🤯': 'surprised',
  '😌': 'calm',
  '😐': 'neutral',
  '😰': 'anxious'
};

function normalizeMoodName(mood) {
  if (EMOJI_TO_MOOD[mood]) {
    return EMOJI_TO_MOOD[mood];
  }
  
  const normalizedMood = mood.toLowerCase().trim();
  
  if (MOOD_MAPPINGS[normalizedMood]) {
    return normalizedMood;
  }
  
  const alternativeMappings = {
    'joyful': 'happy',
    'elated': 'excited',
    'furious': 'angry',
    'mad': 'angry'
  };
  
  return alternativeMappings[normalizedMood] || 'neutral';
}

function getMoodVector(mood) {
  const normalizedMood = normalizeMoodName(mood);
  const moodData = MOOD_MAPPINGS[normalizedMood];
  
  if (!moodData) {
    return MOOD_MAPPINGS.neutral;
  }
  
  return {
    valence: moodData.valence,
    arousal: moodData.arousal,
    label: moodData.label
  };
}

function computeWeightedAverage(moodInputs) {
  if (!Array.isArray(moodInputs) || moodInputs.length === 0) {
    return getMoodVector('neutral');
  }
  
  let totalValence = 0;
  let totalArousal = 0;
  let totalWeight = 0;
  const contributingMoods = [];
  
  for (const input of moodInputs) {
    const { mood, confidence = 1.0, weight = 1.0 } = input;
    const vector = getMoodVector(mood);
    
    const effectiveWeight = confidence * weight;
    totalValence += vector.valence * effectiveWeight;
    totalArousal += vector.arousal * effectiveWeight;
    totalWeight += effectiveWeight;
    
    contributingMoods.push({
      mood: vector.label,
      confidence,
      weight: effectiveWeight,
      vector: { valence: vector.valence, arousal: vector.arousal }
    });
  }
  
  if (totalWeight === 0) {
    return getMoodVector('neutral');
  }
  
  const avgValence = totalValence / totalWeight;
  const avgArousal = totalArousal / totalWeight;
  
  return {
    valence: Math.max(-1, Math.min(1, avgValence)),
    arousal: Math.max(-1, Math.min(1, avgArousal)),
    contributingMoods
  };
}

function vectorToMoodLabel(valence, arousal) {
  let closestMood = 'neutral';
  let minDistance = Infinity;
  
  for (const [moodName, moodData] of Object.entries(MOOD_MAPPINGS)) {
    const distance = Math.sqrt(
      Math.pow(valence - moodData.valence, 2) + 
      Math.pow(arousal - moodData.arousal, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      closestMood = moodName;
    }
  }
  
  return {
    label: MOOD_MAPPINGS[closestMood].label,
    moodName: closestMood,
    distance: minDistance
  };
}

function calculateFusionConfidence(fusedVector, contributingMoods) {
  if (!contributingMoods || contributingMoods.length === 0) {
    return 0.5;
  }
  
  if (contributingMoods.length === 1) {
    return contributingMoods[0].confidence;
  }
  
  const variances = contributingMoods.map(mood => {
    const vDiff = Math.pow(mood.vector.valence - fusedVector.valence, 2);
    const aDiff = Math.pow(mood.vector.arousal - fusedVector.arousal, 2);
    return Math.sqrt(vDiff + aDiff);
  });
  
  const avgVariance = variances.reduce((sum, v) => sum + v, 0) / variances.length;
  const avgConfidence = contributingMoods.reduce((sum, m) => sum + m.confidence, 0) / contributingMoods.length;
  
  const consistencyFactor = Math.max(0.1, 1 - (avgVariance / 2));
  
  return Math.min(0.95, avgConfidence * consistencyFactor);
}

function fuseMoods(moodInputs) {
  try {
    if (!Array.isArray(moodInputs)) {
      throw new Error('Mood inputs must be an array');
    }
    
    if (moodInputs.length === 0) {
      return {
        label: 'Neutral',
        vector: { valence: 0, arousal: 0 },
        confidence: 1.0,
        source: 'default',
        contributingMoods: []
      };
    }
    
    const fusedVector = computeWeightedAverage(moodInputs);
    const moodLabel = vectorToMoodLabel(fusedVector.valence, fusedVector.arousal);
    const confidence = calculateFusionConfidence(fusedVector, fusedVector.contributingMoods);
    
    return {
      label: moodLabel.label,
      vector: {
        valence: Math.round(fusedVector.valence * 1000) / 1000,
        arousal: Math.round(fusedVector.arousal * 1000) / 1000
      },
      confidence: Math.round(confidence * 1000) / 1000,
      source: moodInputs.length === 1 ? 'single' : 'fusion',
      contributingMoods: fusedVector.contributingMoods,
      metadata: {
        inputCount: moodInputs.length,
        closestMoodDistance: moodLabel.distance,
        fusionMethod: 'weighted_average'
      }
    };
    
  } catch (error) {
    console.error('Error in mood fusion:', error);
    return {
      label: 'Neutral',
      vector: { valence: 0, arousal: 0 },
      confidence: 0.5,
      source: 'error',
      contributingMoods: [],
      error: error.message
    };
  }
}

function createMoodInput(mood, confidence = 1.0, weight = 1.0, source = 'manual') {
  return {
    mood,
    confidence: Math.max(0, Math.min(1, confidence)),
    weight: Math.max(0, weight),
    source,
    timestamp: new Date().toISOString()
  };
}

function getMoodMappings() {
  return { ...MOOD_MAPPINGS };
}

function isValidMood(mood) {
  // Check emoji first
  if (EMOJI_TO_MOOD[mood]) {
    return true;
  }
  
  const normalizedMood = mood.toLowerCase().trim();
  
  // Check if it's directly in mappings
  if (MOOD_MAPPINGS[normalizedMood]) {
    return true;
  }
  
  // Check if it's in alternative mappings
  const alternativeMappings = {
    'joyful': 'happy',
    'elated': 'excited',
    'furious': 'angry',
    'mad': 'angry'
  };
  
  return alternativeMappings.hasOwnProperty(normalizedMood);
}

module.exports = {
  fuseMoods,
  createMoodInput,
  getMoodVector,
  getMoodMappings,
  isValidMood,
  normalizeMoodName,
  vectorToMoodLabel,
  MOOD_MAPPINGS,
  EMOJI_TO_MOOD
};
