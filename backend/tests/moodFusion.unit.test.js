/**
 * Unit Tests for MoodFusion Module
 * Comprehensive testing of mood analysis, blending, and fusion algorithms
 */

const { 
  analyzeMood, 
  blendMoods, 
  calculateMoodDistance, 
  generateMoodProfile,
  validateMoodData,
  getMoodRecommendations
} = require('../utils/moodFusion');

describe('MoodFusion Module Unit Tests', () => {
  
  describe('analyzeMood()', () => {
    test('should analyze basic mood with correct valence and arousal', () => {
      const moodData = {
        emotion: 'happy',
        intensity: 0.8,
        context: 'music'
      };
      
      const result = analyzeMood(moodData);
      
      expect(result).toHaveProperty('valence');
      expect(result).toHaveProperty('arousal');
      expect(result).toHaveProperty('dominance');
      expect(result.valence).toBeGreaterThan(0.5); // Happy should have positive valence
      expect(result.arousal).toBeGreaterThan(0.3); // Happy should have some arousal
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should handle sad emotion with negative valence', () => {
      const moodData = {
        emotion: 'sad',
        intensity: 0.6,
        context: 'reflection'
      };
      
      const result = analyzeMood(moodData);
      
      expect(result.valence).toBeLessThan(0.5); // Sad should have negative valence
      expect(result.arousal).toBeLessThan(0.5); // Sad should have low arousal
      expect(result.emotion).toBe('sad');
    });

    test('should throw error for invalid mood data', () => {
      expect(() => {
        analyzeMood(null);
      }).toThrow('Invalid mood data provided');

      expect(() => {
        analyzeMood({ emotion: 'invalid_emotion' });
      }).toThrow('Unsupported emotion type');
    });

    test('should handle calm emotion with balanced parameters', () => {
      const moodData = {
        emotion: 'calm',
        intensity: 0.4,
        context: 'meditation'
      };
      
      const result = analyzeMood(moodData);
      
      expect(result.valence).toBeGreaterThan(0.4);
      expect(result.valence).toBeLessThan(0.7);
      expect(result.arousal).toBeLessThan(0.4); // Calm should have low arousal
      expect(result.dominance).toBeGreaterThan(0.5); // Calm implies control
    });

    test('should include confidence score based on data quality', () => {
      const highQualityData = {
        emotion: 'excited',
        intensity: 0.9,
        context: 'party',
        additionalMetrics: {
          heartRate: 85,
          facialExpression: 'smile'
        }
      };
      
      const result = analyzeMood(highQualityData);
      
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.dataQuality).toBe('high');
    });
  });

  describe('blendMoods()', () => {
    test('should blend two happy moods correctly', () => {
      const mood1 = {
        valence: 0.8,
        arousal: 0.7,
        dominance: 0.6,
        emotion: 'happy',
        weight: 1.0
      };
      
      const mood2 = {
        valence: 0.9,
        arousal: 0.8,
        dominance: 0.7,
        emotion: 'joyful',
        weight: 1.0
      };
      
      const blended = blendMoods([mood1, mood2]);
      
      expect(blended.valence).toBeCloseTo(0.85, 2); // Average of 0.8 and 0.9
      expect(blended.arousal).toBeCloseTo(0.75, 2); // Average of 0.7 and 0.8
      expect(blended.dominance).toBeCloseTo(0.65, 2); // Average of 0.6 and 0.7
      expect(blended.dominantEmotion).toBe('joyful'); // Higher valence wins
    });

    test('should handle weighted mood blending', () => {
      const mood1 = {
        valence: 0.2,
        arousal: 0.3,
        dominance: 0.4,
        emotion: 'sad',
        weight: 0.3
      };
      
      const mood2 = {
        valence: 0.8,
        arousal: 0.7,
        dominance: 0.6,
        emotion: 'happy',
        weight: 0.7
      };
      
      const blended = blendMoods([mood1, mood2]);
      
      // Weighted average: (0.2*0.3 + 0.8*0.7) = 0.62
      expect(blended.valence).toBeCloseTo(0.62, 2);
      expect(blended.dominantEmotion).toBe('happy'); // Higher weight and valence
      expect(blended.blendRatio).toEqual({ sad: 0.3, happy: 0.7 });
    });

    test('should blend opposing moods to neutral', () => {
      const mood1 = {
        valence: 0.9,
        arousal: 0.8,
        dominance: 0.7,
        emotion: 'ecstatic',
        weight: 1.0
      };
      
      const mood2 = {
        valence: 0.1,
        arousal: 0.2,
        dominance: 0.3,
        emotion: 'depressed',
        weight: 1.0
      };
      
      const blended = blendMoods([mood1, mood2]);
      
      expect(blended.valence).toBeCloseTo(0.5, 1); // Should be neutral
      expect(blended.arousal).toBeCloseTo(0.5, 1);
      expect(blended.dominantEmotion).toBe('neutral');
      expect(blended.conflictLevel).toBeGreaterThan(0.7); // High conflict
    });

    test('should throw error for empty mood array', () => {
      expect(() => {
        blendMoods([]);
      }).toThrow('At least one mood required for blending');
    });

    test('should handle single mood gracefully', () => {
      const mood = {
        valence: 0.7,
        arousal: 0.6,
        dominance: 0.5,
        emotion: 'content',
        weight: 1.0
      };
      
      const result = blendMoods([mood]);
      
      expect(result.valence).toBe(0.7);
      expect(result.arousal).toBe(0.6);
      expect(result.dominance).toBe(0.5);
      expect(result.dominantEmotion).toBe('content');
    });
  });

  describe('calculateMoodDistance()', () => {
    test('should calculate zero distance for identical moods', () => {
      const mood1 = { valence: 0.5, arousal: 0.5, dominance: 0.5 };
      const mood2 = { valence: 0.5, arousal: 0.5, dominance: 0.5 };
      
      const distance = calculateMoodDistance(mood1, mood2);
      
      expect(distance).toBe(0);
    });

    test('should calculate maximum distance for opposite moods', () => {
      const mood1 = { valence: 0, arousal: 0, dominance: 0 };
      const mood2 = { valence: 1, arousal: 1, dominance: 1 };
      
      const distance = calculateMoodDistance(mood1, mood2);
      
      expect(distance).toBeCloseTo(Math.sqrt(3), 2); // √3 for 3D unit distance
    });

    test('should use euclidean distance formula correctly', () => {
      const mood1 = { valence: 0.3, arousal: 0.4, dominance: 0.5 };
      const mood2 = { valence: 0.6, arousal: 0.8, dominance: 0.2 };
      
      const distance = calculateMoodDistance(mood1, mood2);
      
      // √((0.6-0.3)² + (0.8-0.4)² + (0.2-0.5)²) = √(0.09 + 0.16 + 0.09) = √0.34
      expect(distance).toBeCloseTo(Math.sqrt(0.34), 3);
    });

    test('should handle missing dimensions gracefully', () => {
      const mood1 = { valence: 0.5, arousal: 0.5 }; // Missing dominance
      const mood2 = { valence: 0.7, arousal: 0.3, dominance: 0.6 };
      
      const distance = calculateMoodDistance(mood1, mood2);
      
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(2); // Should handle gracefully
    });
  });

  describe('generateMoodProfile()', () => {
    test('should generate comprehensive mood profile', () => {
      const userData = {
        recentMoods: [
          { emotion: 'happy', valence: 0.8, arousal: 0.7, timestamp: Date.now() - 3600000 },
          { emotion: 'calm', valence: 0.6, arousal: 0.3, timestamp: Date.now() - 1800000 },
          { emotion: 'excited', valence: 0.9, arousal: 0.9, timestamp: Date.now() }
        ],
        preferences: {
          musicGenres: ['pop', 'electronic'],
          activityTypes: ['social', 'creative']
        }
      };
      
      const profile = generateMoodProfile(userData);
      
      expect(profile).toHaveProperty('averageMood');
      expect(profile).toHaveProperty('moodTrend');
      expect(profile).toHaveProperty('personalityTraits');
      expect(profile).toHaveProperty('recommendations');
      expect(profile.averageMood.valence).toBeGreaterThan(0.6); // Generally positive
    });

    test('should detect mood trends over time', () => {
      const userData = {
        recentMoods: [
          { emotion: 'sad', valence: 0.2, arousal: 0.3, timestamp: Date.now() - 7200000 },
          { emotion: 'neutral', valence: 0.5, arousal: 0.5, timestamp: Date.now() - 3600000 },
          { emotion: 'happy', valence: 0.8, arousal: 0.7, timestamp: Date.now() }
        ]
      };
      
      const profile = generateMoodProfile(userData);
      
      expect(profile.moodTrend.direction).toBe('improving');
      expect(profile.moodTrend.slope).toBeGreaterThan(0);
      expect(profile.moodTrend.confidence).toBeGreaterThan(0.7);
    });

    test('should handle empty mood history', () => {
      const userData = {
        recentMoods: [],
        preferences: { musicGenres: ['rock'] }
      };
      
      const profile = generateMoodProfile(userData);
      
      expect(profile.averageMood).toEqual({
        valence: 0.5,
        arousal: 0.5,
        dominance: 0.5
      });
      expect(profile.moodTrend.direction).toBe('unknown');
      expect(profile.dataQuality).toBe('insufficient');
    });
  });

  describe('validateMoodData()', () => {
    test('should validate correct mood data structure', () => {
      const validMood = {
        valence: 0.7,
        arousal: 0.6,
        dominance: 0.5,
        emotion: 'happy',
        confidence: 0.8
      };
      
      const result = validateMoodData(validMood);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect out-of-range values', () => {
      const invalidMood = {
        valence: 1.5, // Out of range
        arousal: -0.1, // Out of range
        dominance: 0.5,
        emotion: 'happy'
      };
      
      const result = validateMoodData(invalidMood);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('valence must be between 0 and 1');
      expect(result.errors).toContain('arousal must be between 0 and 1');
    });

    test('should detect missing required fields', () => {
      const incompleteMood = {
        valence: 0.7
        // Missing arousal, dominance, emotion
      };
      
      const result = validateMoodData(incompleteMood);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getMoodRecommendations()', () => {
    test('should recommend upbeat music for high-energy moods', () => {
      const mood = {
        valence: 0.8,
        arousal: 0.9,
        dominance: 0.7,
        emotion: 'excited'
      };
      
      const recommendations = getMoodRecommendations(mood);
      
      expect(recommendations.musicGenres).toContain('electronic');
      expect(recommendations.musicGenres).toContain('pop');
      expect(recommendations.activities).toContain('dance');
      expect(recommendations.roomTypes).toContain('party');
    });

    test('should recommend calming content for low-arousal moods', () => {
      const mood = {
        valence: 0.6,
        arousal: 0.2,
        dominance: 0.7,
        emotion: 'calm'
      };
      
      const recommendations = getMoodRecommendations(mood);
      
      expect(recommendations.musicGenres).toContain('ambient');
      expect(recommendations.musicGenres).toContain('classical');
      expect(recommendations.activities).toContain('meditation');
      expect(recommendations.roomTypes).toContain('chill');
    });

    test('should provide confidence scores for recommendations', () => {
      const mood = {
        valence: 0.7,
        arousal: 0.5,
        dominance: 0.6,
        emotion: 'content',
        confidence: 0.9
      };
      
      const recommendations = getMoodRecommendations(mood);
      
      expect(recommendations).toHaveProperty('confidence');
      expect(recommendations.confidence).toBeGreaterThan(0.7);
      expect(recommendations.reasoning).toBeDefined();
    });
  });
});

// Test utilities and helpers
describe('MoodFusion Utility Functions', () => {
  test('should normalize mood values to valid range', () => {
    const { normalizeMoodValue } = require('../utils/moodFusion');
    
    expect(normalizeMoodValue(1.5)).toBe(1.0);
    expect(normalizeMoodValue(-0.5)).toBe(0.0);
    expect(normalizeMoodValue(0.7)).toBe(0.7);
  });

  test('should calculate mood similarity correctly', () => {
    const { calculateMoodSimilarity } = require('../utils/moodFusion');
    
    const mood1 = { valence: 0.8, arousal: 0.7, dominance: 0.6 };
    const mood2 = { valence: 0.8, arousal: 0.7, dominance: 0.6 };
    
    expect(calculateMoodSimilarity(mood1, mood2)).toBe(1.0);
  });
});
