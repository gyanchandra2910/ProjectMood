/**
 * Unit tests for MoodFusion module
 * Tests mood mapping, fusion algorithms, and edge cases
 */

const {
  fuseMoods,
  createMoodInput,
  getMoodVector,
  isValidMood,
  normalizeMoodName,
  vectorToMoodLabel,
  MOOD_MAPPINGS
} = require('../utils/moodFusion');

// Simple test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, testFn) {
    this.tests.push({ name, testFn });
  }

  assertEqual(actual, expected, message = '') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}. ${message}`);
    }
  }

  assertAlmostEqual(actual, expected, tolerance = 0.001, message = '') {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(`Expected ${expected} ± ${tolerance}, got ${actual}. ${message}`);
    }
  }

  assertTrue(condition, message = '') {
    if (!condition) {
      throw new Error(`Expected true. ${message}`);
    }
  }

  assertFalse(condition, message = '') {
    if (condition) {
      throw new Error(`Expected false. ${message}`);
    }
  }

  async run() {
    console.log('🧪 Running MoodFusion Tests...\n');

    for (const { name, testFn } of this.tests) {
      try {
        await testFn();
        console.log(`✅ ${name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        this.failed++;
      }
    }

    console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}

const runner = new TestRunner();

// Test mood vector mappings
runner.test('Basic mood vector mapping', () => {
  const happyVector = getMoodVector('happy');
  runner.assertEqual(happyVector.valence, 0.7);
  runner.assertEqual(happyVector.arousal, 0.6);
  runner.assertEqual(happyVector.label, 'Happy');
});

runner.test('Emoji to mood mapping', () => {
  const sadVector = getMoodVector('😢');
  runner.assertEqual(sadVector.label, 'Sad');
  runner.assertAlmostEqual(sadVector.valence, -0.6);
});

runner.test('Mood name normalization', () => {
  runner.assertEqual(normalizeMoodName('HAPPY'), 'happy');
  runner.assertEqual(normalizeMoodName('joyful'), 'happy');
  runner.assertEqual(normalizeMoodName('unknown'), 'neutral');
});

runner.test('Valid mood detection', () => {
  runner.assertTrue(isValidMood('happy'));
  runner.assertTrue(isValidMood('😊'));
  runner.assertTrue(isValidMood('neutral')); // neutral should be valid
  runner.assertFalse(isValidMood('totallyfakemood')); // Use a clearly invalid mood
});

// Test single mood fusion
runner.test('Single mood fusion', () => {
  const inputs = [createMoodInput('happy', 0.8)];
  const result = fuseMoods(inputs);
  
  runner.assertEqual(result.label, 'Happy');
  runner.assertEqual(result.source, 'single');
  runner.assertEqual(result.confidence, 0.8);
  runner.assertAlmostEqual(result.vector.valence, 0.7);
});

// Test calm + excited combination (should result in neutral-ish with mixed arousal)
runner.test('Calm + Excited fusion (mixed arousal)', () => {
  const inputs = [
    createMoodInput('calm', 0.9, 1.0, 'manual'),    // valence: 0.6, arousal: -0.4
    createMoodInput('excited', 0.8, 1.0, 'voice')   // valence: 0.8, arousal: 0.9
  ];
  
  const result = fuseMoods(inputs);
  
  // Should have positive valence (average of 0.6 and 0.8)
  runner.assertTrue(result.vector.valence > 0.5, 'Valence should be positive');
  
  // Arousal should be mixed (between -0.4 and 0.9)
  runner.assertTrue(result.vector.arousal > -0.4 && result.vector.arousal < 0.9, 'Arousal should be mixed');
  
  // Should be fusion source
  runner.assertEqual(result.source, 'fusion');
  
  // Should have contributing moods
  runner.assertEqual(result.contributingMoods.length, 2);
  
  console.log(`   📊 Calm + Excited = ${result.label} (${result.vector.valence}, ${result.vector.arousal})`);
});

// Test sad + anxious combination (negative valence, mixed arousal)
runner.test('Sad + Anxious fusion (negative emotions)', () => {
  const inputs = [
    createMoodInput('sad', 0.7, 1.0, 'face'),       // valence: -0.6, arousal: -0.4
    createMoodInput('anxious', 0.9, 1.0, 'voice')   // valence: -0.5, arousal: 0.7
  ];
  
  const result = fuseMoods(inputs);
  
  // Should have negative valence
  runner.assertTrue(result.vector.valence < 0, 'Valence should be negative');
  
  // Should have mixed arousal
  runner.assertTrue(result.vector.arousal > -0.4 && result.vector.arousal < 0.7);
  
  console.log(`   📊 Sad + Anxious = ${result.label} (${result.vector.valence}, ${result.vector.arousal})`);
});

// Test three-way fusion with different weights
runner.test('Three-way fusion with confidence weighting', () => {
  const inputs = [
    createMoodInput('happy', 0.9, 1.0, 'manual'),   // High confidence
    createMoodInput('calm', 0.5, 1.0, 'voice'),     // Lower confidence
    createMoodInput('excited', 0.3, 1.0, 'face')    // Lowest confidence
  ];
  
  const result = fuseMoods(inputs);
  
  // Should be closer to happy due to higher confidence
  runner.assertTrue(result.vector.valence > 0.4, 'Should lean towards positive valence');
  runner.assertEqual(result.source, 'fusion');
  runner.assertEqual(result.contributingMoods.length, 3);
  
  console.log(`   📊 Happy(0.9) + Calm(0.5) + Excited(0.3) = ${result.label} (${result.vector.valence}, ${result.vector.arousal})`);
});

// Test neutral convergence
runner.test('Multiple neutral inputs', () => {
  const inputs = [
    createMoodInput('neutral', 1.0),
    createMoodInput('neutral', 1.0),
    createMoodInput('neutral', 1.0)
  ];
  
  const result = fuseMoods(inputs);
  
  runner.assertAlmostEqual(result.vector.valence, 0, 0.1);
  runner.assertAlmostEqual(result.vector.arousal, 0, 0.1);
  runner.assertEqual(result.label, 'Neutral');
});

// Test extreme opposites
runner.test('Extreme opposite moods', () => {
  const inputs = [
    createMoodInput('excited', 1.0),  // High arousal, positive
    createMoodInput('sad', 1.0)       // Low arousal, negative
  ];
  
  const result = fuseMoods(inputs);
  
  // Should average out somewhat
  runner.assertTrue(Math.abs(result.vector.valence) < 0.5, 'Valence should be moderated');
  runner.assertTrue(Math.abs(result.vector.arousal) < 0.8, 'Arousal should be moderated');
  
  console.log(`   📊 Excited + Sad = ${result.label} (${result.vector.valence}, ${result.vector.arousal})`);
});

// Test vector to mood label mapping
runner.test('Vector to mood label conversion', () => {
  // Test high arousal, positive valence
  const excitedMood = vectorToMoodLabel(0.8, 0.9);
  runner.assertEqual(excitedMood.moodName, 'excited');
  
  // Test low arousal, positive valence
  const calmMood = vectorToMoodLabel(0.6, -0.4);
  runner.assertEqual(calmMood.moodName, 'calm');
  
  // Test center
  const neutralMood = vectorToMoodLabel(0.0, 0.0);
  runner.assertEqual(neutralMood.moodName, 'neutral');
});

// Test edge cases
runner.test('Empty input handling', () => {
  const result = fuseMoods([]);
  runner.assertEqual(result.label, 'Neutral');
  runner.assertEqual(result.source, 'default');
  runner.assertEqual(result.confidence, 1.0);
});

runner.test('Invalid input handling', () => {
  const result = fuseMoods('not an array');
  runner.assertEqual(result.label, 'Neutral');
  runner.assertEqual(result.source, 'error');
  runner.assertTrue(result.hasOwnProperty('error'));
});

runner.test('Unknown mood handling', () => {
  const inputs = [createMoodInput('unknownmood', 0.8)];
  const result = fuseMoods(inputs);
  
  // Should default to neutral
  runner.assertEqual(result.label, 'Neutral');
});

// Test confidence calculation edge cases
runner.test('Zero confidence inputs', () => {
  const inputs = [
    createMoodInput('happy', 0.0),
    createMoodInput('sad', 0.0)
  ];
  
  const result = fuseMoods(inputs);
  runner.assertTrue(result.confidence >= 0.1, 'Should have minimum confidence');
});

// Test mood input creation
runner.test('Mood input creation', () => {
  const input = createMoodInput('happy', 0.8, 1.5, 'voice');
  
  runner.assertEqual(input.mood, 'happy');
  runner.assertEqual(input.confidence, 0.8);
  runner.assertEqual(input.weight, 1.5);
  runner.assertEqual(input.source, 'voice');
  runner.assertTrue(input.timestamp, 'Should have timestamp');
});

// Test confidence bounds
runner.test('Confidence bounds validation', () => {
  const input1 = createMoodInput('happy', -0.5); // Below 0
  const input2 = createMoodInput('happy', 1.5);  // Above 1
  
  runner.assertEqual(input1.confidence, 0);
  runner.assertEqual(input2.confidence, 1);
});

// Run all tests
if (require.main === module) {
  runner.run().then(success => {
    if (success) {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('\n💥 Some tests failed!');
      process.exit(1);
    }
  });
}

module.exports = { TestRunner, runner };
