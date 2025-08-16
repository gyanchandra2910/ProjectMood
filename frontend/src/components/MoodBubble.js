// MoodBubble Component - Three.js animated orb visualization for mood vectors
// Uses valence-arousal coordinates to control color, scale, and surface noise

import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';

// Custom shader material for the mood orb
const MoodOrbMaterial = ({ 
  valence = 0, 
  arousal = 0, 
  time = 0,
  noiseIntensity = 0.5 
}) => {
  const materialRef = useRef();
  
  const uniforms = useMemo(() => ({
    time: { value: time },
    valence: { value: valence },
    arousal: { value: arousal },
    noiseIntensity: { value: noiseIntensity },
    baseColor: { value: new THREE.Color() }
  }), []);

  // Update uniforms when props change
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.valence.value = valence;
      materialRef.current.uniforms.arousal.value = arousal;
      materialRef.current.uniforms.noiseIntensity.value = noiseIntensity;
      
      // Convert valence-arousal to HSL color
      const hue = moodVectorToHue(valence, arousal);
      const saturation = Math.abs(valence) * 0.8 + 0.2; // More intense = more saturated
      const lightness = (arousal + 1) * 0.25 + 0.4; // Higher arousal = brighter
      
      materialRef.current.uniforms.baseColor.value.setHSL(hue, saturation, lightness);
    }
  }, [valence, arousal, noiseIntensity]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
  });

  const vertexShader = `
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    
    uniform float time;
    uniform float arousal;
    uniform float noiseIntensity;
    
    // Simple noise function
    float noise(vec3 p) {
      return sin(p.x * 10.0 + time) * sin(p.y * 10.0 + time * 0.8) * sin(p.z * 10.0 + time * 0.6) * 0.1;
    }
    
    void main() {
      vPosition = position;
      vNormal = normal;
      vUv = uv;
      
      // Add noise displacement based on arousal
      vec3 displaced = position;
      float noiseScale = arousal * 0.5 + 0.1;
      displaced += normal * noise(position * 3.0) * noiseIntensity * noiseScale;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `;

  const fragmentShader = `
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    
    uniform float time;
    uniform float valence;
    uniform float arousal;
    uniform vec3 baseColor;
    
    void main() {
      // Base lighting
      vec3 light = normalize(vec3(1.0, 1.0, 1.0));
      float diff = max(dot(vNormal, light), 0.0);
      
      // Pulsing effect based on arousal
      float pulse = sin(time * (arousal * 2.0 + 1.0)) * 0.2 + 0.8;
      
      // Color intensity based on valence
      float intensity = abs(valence) * 0.5 + 0.5;
      
      vec3 color = baseColor * diff * pulse * intensity;
      
      // Add rim lighting for more dramatic effect
      float rim = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
      color += baseColor * rim * 0.3;
      
      gl_FragColor = vec4(color, 0.9);
    }
  `;

  return (
    <shaderMaterial
      ref={materialRef}
      uniforms={uniforms}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      transparent={true}
    />
  );
};

// Convert mood vector to hue (0-1)
const moodVectorToHue = (valence, arousal) => {
  // Map valence-arousal space to color wheel
  // Positive valence -> warm colors (red-yellow)
  // Negative valence -> cool colors (blue-purple)
  // High arousal -> more vibrant
  
  if (valence > 0 && arousal > 0) {
    // Happy/Excited quadrant: Orange to Yellow (30-60 degrees)
    return (30 + valence * 30) / 360;
  } else if (valence <= 0 && arousal > 0) {
    // Angry/Anxious quadrant: Red to Purple (300-360 degrees)
    return (300 + Math.abs(valence) * 60) / 360;
  } else if (valence <= 0 && arousal <= 0) {
    // Sad/Depressed quadrant: Blue to Cyan (180-240 degrees)
    return (180 + Math.abs(valence) * 60) / 360;
  } else {
    // Calm/Content quadrant: Green to Blue (120-180 degrees)
    return (120 + valence * 60) / 360;
  }
};

// Animated orb component
const AnimatedOrb = ({ moodVector, targetScale = 1 }) => {
  const meshRef = useRef();
  const groupRef = useRef();
  
  // Smooth interpolation state
  const currentVector = useRef({ valence: 0, arousal: 0 });
  const currentScale = useRef(1);
  
  useFrame((state, delta) => {
    if (!meshRef.current || !groupRef.current) return;
    
    // Lerp mood vector for smooth transitions
    const lerpSpeed = delta * 2; // Adjust speed as needed
    currentVector.current.valence = THREE.MathUtils.lerp(
      currentVector.current.valence, 
      moodVector.valence, 
      lerpSpeed
    );
    currentVector.current.arousal = THREE.MathUtils.lerp(
      currentVector.current.arousal, 
      moodVector.arousal, 
      lerpSpeed
    );
    
    // Lerp scale
    currentScale.current = THREE.MathUtils.lerp(
      currentScale.current,
      targetScale,
      lerpSpeed
    );
    
    // Apply scale based on mood intensity
    const intensity = Math.sqrt(
      currentVector.current.valence * currentVector.current.valence + 
      currentVector.current.arousal * currentVector.current.arousal
    );
    const scale = currentScale.current * (0.8 + intensity * 0.4);
    groupRef.current.scale.setScalar(scale);
    
    // Gentle rotation based on arousal
    groupRef.current.rotation.y += delta * (currentVector.current.arousal * 0.2 + 0.1);
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
  });

  // Calculate noise intensity based on arousal
  const noiseIntensity = Math.abs(moodVector.arousal) * 0.3 + 0.1;

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 4]} />
        <MoodOrbMaterial
          valence={moodVector.valence}
          arousal={moodVector.arousal}
          noiseIntensity={noiseIntensity}
        />
      </mesh>
      
      {/* Subtle glow effect */}
      <mesh scale={1.2}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial 
          color={new THREE.Color().setHSL(
            moodVectorToHue(moodVector.valence, moodVector.arousal),
            0.5,
            0.5
          )}
          transparent
          opacity={0.1}
        />
      </mesh>
    </group>
  );
};

// Legend component showing current mood data
const MoodLegend = ({ moodData, className = "" }) => {
  if (!moodData) return null;
  
  const { label, confidence, vector } = moodData;
  
  return (
    <div className={`absolute top-4 left-4 bg-black bg-opacity-50 text-white p-3 rounded-lg text-sm ${className}`}>
      <div className="font-semibold text-lg mb-2">{label}</div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Confidence:</span>
          <span className="font-mono">{(confidence * 100).toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span>Valence:</span>
          <span className="font-mono">{vector.valence.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Arousal:</span>
          <span className="font-mono">{vector.arousal.toFixed(2)}</span>
        </div>
      </div>
      
      {/* Confidence bar */}
      <div className="mt-2">
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${confidence * 100}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

// Main MoodBubble component
const MoodBubble = ({ 
  moodVector = { valence: 0, arousal: 0 },
  moodData = null,
  size = { width: 400, height: 400 },
  className = "",
  showLegend = true,
  enableControls = true
}) => {
  return (
    <div className={`relative ${className}`} style={{ width: size.width, height: size.height }}>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 60 }}
        style={{ background: 'radial-gradient(circle, #1a1a2e 0%, #16213e 100%)' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#4a5568" />
        
        {/* Animated mood orb */}
        <AnimatedOrb 
          moodVector={moodVector} 
          targetScale={1}
        />
        
        {/* Orbit controls for interaction */}
        {enableControls && (
          <OrbitControls 
            enableZoom={false}
            enablePan={false}
            autoRotate={false}
            maxPolarAngle={Math.PI / 2}
            minPolarAngle={Math.PI / 2}
          />
        )}
      </Canvas>
      
      {/* Mood legend overlay */}
      {showLegend && moodData && (
        <MoodLegend moodData={moodData} />
      )}
      
      {/* Coordinates indicator */}
      <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded text-xs font-mono">
        ({moodVector.valence.toFixed(2)}, {moodVector.arousal.toFixed(2)})
      </div>
    </div>
  );
};

export default MoodBubble;
