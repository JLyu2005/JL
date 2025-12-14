
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PARTICLE_COUNT } from '../constants';
import { ShapeType, HandGestureState } from '../types';
import { generateParticles, generateTextParticles } from '../utils/geometry';

// Fix for Missing JSX Types in R3F
declare global {
  namespace JSX {
    interface IntrinsicElements {
      points: any;
      bufferGeometry: any;
      bufferAttribute: any;
      shaderMaterial: any;
    }
  }
}

interface ParticlesProps {
  shape: ShapeType;
  color: string;
  gestureState: HandGestureState;
}

// Shader material for cinematic glow particles
const ParticleShaderMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uGlobalColor: { value: new THREE.Color('#ffffff') }, 
    uExpansion: { value: 1.0 }, // Controls scaling of the shape (Fist effect)
    uScatter: { value: 0.0 },   // Controls blending between Shape and Chaos (Open Hand effect)
    uNoiseAmp: { value: 0.1 },  // New uniform to control stability/wobble
    uPointSize: { value: 3.0 }, 
    uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio : 2 }
  },
  vertexShader: `
    uniform float uTime;
    uniform float uExpansion;
    uniform float uScatter;
    uniform float uNoiseAmp; 
    uniform float uPointSize;
    uniform float uPixelRatio;
    
    attribute float aRandom;
    attribute vec3 aRandomPos; // The "Scattered" position for this particle
    attribute vec3 color; 
    
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      vColor = color;
      
      // Gentle twinkle
      float twinkleSpeed = 3.0 + (uScatter * 10.0); // Sparkle faster when scattered
      float twinkle = sin(uTime * twinkleSpeed + aRandom * 100.0) * 0.5 + 0.5;
      
      // 1. Calculate Shape Position (with Expansion/Contraction)
      vec3 shapePos = position * uExpansion;
      
      // 2. Add organic noise to shape
      float actualNoise = uNoiseAmp * (1.0 - uScatter);
      
      // Reduce noise frequency for cleaner text/shapes
      float noiseFreq = 0.5;
      shapePos.x += sin(uTime + position.y * noiseFreq) * actualNoise;
      shapePos.z += cos(uTime + position.x * noiseFreq) * actualNoise;

      // 3. Calculate Scattered Position
      vec3 scatteredPos = aRandomPos;
      // Add subtle floating movement to scattered particles
      scatteredPos.y += sin(uTime + aRandom * 10.0) * 0.2; 
      scatteredPos.x += cos(uTime * 0.5 + aRandom * 10.0) * 0.2;

      // 4. Mix based on uScatter
      // Use smoothstep for a snappier transition feel
      float mixFactor = smoothstep(0.0, 1.0, uScatter);
      vec3 finalPos = mix(shapePos, scatteredPos, mixFactor);
      
      vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Size calculation
      float sizeMult = 1.0;
      // Make Gold/Red particles slightly larger (ornaments)
      if (color.r > 0.8 && color.g < 0.2) sizeMult = 1.5; 
      
      // When scattered (Open Hand), boost size to look like floating diamonds
      float scatterSizeMod = mix(1.0, 1.3, mixFactor);
      
      gl_PointSize = (uPointSize * sizeMult * scatterSizeMod + twinkle * 2.0) * uPixelRatio * (10.0 / -mvPosition.z);
      
      // Alpha Fade at edges of camera
      vAlpha = smoothstep(60.0, 40.0, -mvPosition.z); 
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    varying float vAlpha;
    uniform vec3 uGlobalColor;

    void main() {
      vec2 center = gl_PointCoord - 0.5;
      float dist = length(center);
      if (dist > 0.5) discard;
      
      // Crystal/Diamond like glow
      float glow = 1.0 - (dist * 2.0);
      glow = pow(glow, 2.0); // Sharper glow for jewelry look
      
      // Add white core to make it look shiny
      vec3 finalColor = mix(vColor, vec3(1.0), glow * 0.5);
      
      gl_FragColor = vec4(finalColor + (glow * 0.3), vAlpha * glow);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
};

const Particles: React.FC<ParticlesProps> = ({ shape, color, gestureState }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  
  // "Morph Target" determines if we are rendering the Shape (TREE/HEART) or the Text (TEXT)
  const [morphTarget, setMorphTarget] = useState<'TREE' | 'TEXT'>('TREE');

  // --- MORPHING STATE MACHINE ---
  useEffect(() => {
    // Only apply morph logic if base shape is Tree or Heart
    if (shape !== ShapeType.TREE && shape !== ShapeType.HEART) {
      if (morphTarget === 'TEXT') setMorphTarget('TREE');
      return;
    }

    // Direct mapping: Victory gesture shows text
    if (gestureState.gesture === 'VICTORY') {
      setMorphTarget('TEXT');
    } else {
      setMorphTarget('TREE');
    }
  }, [gestureState.gesture, shape]);


  // --- GEOMETRY GENERATION ---
  const targetData = useMemo(() => {
    // Case 1: Special Text Mode
    if (morphTarget === 'TEXT') {
       if (shape === ShapeType.TREE) {
         return generateTextParticles("Merry\nChristmas", PARTICLE_COUNT, 'CHRISTMAS');
       } else if (shape === ShapeType.HEART) {
         return generateTextParticles("Love\nYou", PARTICLE_COUNT, 'ROMANTIC');
       }
    }
    // Case 2: Standard Shapes
    return generateParticles(shape, PARTICLE_COUNT, color);
  }, [shape, color, morphTarget]);

  // Initial Positions (Buffers)
  const currentPositions = useMemo(() => new Float32Array(targetData.positions), []);
  const currentColors = useMemo(() => new Float32Array(targetData.colors), []); 

  // Random Scatter Positions (Constant per session)
  const { randoms, randomPositions } = useMemo(() => {
    const r = new Float32Array(PARTICLE_COUNT);
    const rp = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        r[i] = Math.random();
        // Scatter range: -15 to 15
        rp[i * 3] = (Math.random() - 0.5) * 35;     
        rp[i * 3 + 1] = (Math.random() - 0.5) * 35; 
        rp[i * 3 + 2] = (Math.random() - 0.5) * 20; 
    }
    return { randoms: r, randomPositions: rp };
  }, []);

  // --- ANIMATION LOOP ---
  useFrame((state, delta) => {
    if (!pointsRef.current || !geometryRef.current || !shaderRef.current) return;

    const uniforms = shaderRef.current.uniforms;

    // 1. Determine Target Uniform Values based on Gesture
    let targetExpansion = 1.0; 
    let targetScatter = 0.0;
    let targetNoiseAmp = 0.1;
    
    // Explicit Hand Control Mapping
    if (gestureState.gesture === 'CLOSED') {
        // FIST (Closed): Aggregate tightly into a "Jewel" or dense object
        targetExpansion = 0.6; // Very compact
        targetScatter = 0.0;   
        targetNoiseAmp = 0.01; // Solid, no wobble
    } else if (gestureState.gesture === 'OPEN') {
        // OPEN HAND: Explode/Scatter like glitter
        targetExpansion = 2.0; 
        targetScatter = 1.0;   
        targetNoiseAmp = 0.2;
    } else if (gestureState.gesture === 'VICTORY') {
        // VICTORY: Text display
        targetExpansion = 1.2;
        targetScatter = 0.0;
        targetNoiseAmp = 0.02; 
    } else {
        // NEUTRAL: Default breathing state
        targetExpansion = 1.0;
        targetScatter = 0.0;
        targetNoiseAmp = 0.08;
    }

    // 2. Smoothly Lerp Uniforms
    const lerpFactor = delta * 3.5;
    uniforms.uExpansion.value = THREE.MathUtils.lerp(uniforms.uExpansion.value, targetExpansion, lerpFactor);
    uniforms.uScatter.value = THREE.MathUtils.lerp(uniforms.uScatter.value, targetScatter, lerpFactor);
    uniforms.uNoiseAmp.value = THREE.MathUtils.lerp(uniforms.uNoiseAmp.value, targetNoiseAmp, lerpFactor);
    
    // 3. Rotation Logic
    if (gestureState.isHandDetected) {
        // Y-AXIS ROTATION (Left/Right) - Controlled by Open Hand "Swing"
        if (gestureState.gesture === 'OPEN') {
             const targetRotationY = gestureState.rotation * Math.PI * 2.0; 
             pointsRef.current.rotation.y = THREE.MathUtils.lerp(pointsRef.current.rotation.y, targetRotationY, delta * 2.0);
        }
        
        // X-AXIS ROTATION (Up/Down) - Controlled by Pointing Finger
        if (gestureState.gesture === 'POINTING') {
             const targetRotationX = gestureState.pitch * Math.PI; 
             pointsRef.current.rotation.x = THREE.MathUtils.lerp(pointsRef.current.rotation.x, targetRotationX, delta * 2.0);
        } else {
             // Return to level
             pointsRef.current.rotation.x = THREE.MathUtils.lerp(pointsRef.current.rotation.x, 0, delta * 2.0);
        }
    } else {
        // Idle Auto-Rotation
        pointsRef.current.rotation.y += delta * 0.15;
        pointsRef.current.rotation.x = THREE.MathUtils.lerp(pointsRef.current.rotation.x, 0, delta);
    }

    // 4. Geometry Morphing
    const positions = geometryRef.current.attributes.position.array as Float32Array;
    const colors = geometryRef.current.attributes.color.array as Float32Array;
    
    const morphSpeed = delta * 4.0; 
    const colorSpeed = delta * 3.0;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      // Morph Position
      positions[i3] += (targetData.positions[i3] - positions[i3]) * morphSpeed;
      positions[i3 + 1] += (targetData.positions[i3 + 1] - positions[i3 + 1]) * morphSpeed;
      positions[i3 + 2] += (targetData.positions[i3 + 2] - positions[i3 + 2]) * morphSpeed;

      // Morph Color
      colors[i3] += (targetData.colors[i3] - colors[i3]) * colorSpeed;
      colors[i3 + 1] += (targetData.colors[i3 + 1] - colors[i3 + 1]) * colorSpeed;
      colors[i3 + 2] += (targetData.colors[i3 + 2] - colors[i3 + 2]) * colorSpeed;
    }

    geometryRef.current.attributes.position.needsUpdate = true;
    geometryRef.current.attributes.color.needsUpdate = true;

    uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={currentPositions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={PARTICLE_COUNT}
          array={currentColors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={PARTICLE_COUNT}
          array={randoms}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aRandomPos"
          count={PARTICLE_COUNT}
          array={randomPositions}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={shaderRef}
        args={[ParticleShaderMaterial]}
        uniforms-uGlobalColor-value={new THREE.Color(color)}
      />
    </points>
  );
};

export default Particles;
