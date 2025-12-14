import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PARTICLE_COUNT } from '../constants';
import { ShapeType, HandGestureState } from '../types';
import { generateParticles, generateTextParticles } from '../utils/geometry';

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

const ParticleShaderMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uGlobalColor: { value: new THREE.Color('#ffffff') }, 
    uExpansion: { value: 1.0 }, 
    uScatter: { value: 0.0 },   
    uNoiseAmp: { value: 0.1 },  
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
    attribute vec3 aRandomPos; 
    attribute vec3 color; 
    
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      vColor = color;
      
      float twinkleSpeed = 3.0 + (uScatter * 10.0);
      float twinkle = sin(uTime * twinkleSpeed + aRandom * 100.0) * 0.5 + 0.5;
      
      // Calculate Shape Position with Expansion
      vec3 shapePos = position * uExpansion;
      
      // Add organic noise
      float actualNoise = uNoiseAmp * (1.0 - uScatter);
      float noiseFreq = 0.5;
      shapePos.x += sin(uTime + position.y * noiseFreq) * actualNoise;
      shapePos.z += cos(uTime + position.x * noiseFreq) * actualNoise;

      // Calculate Scattered Position
      vec3 scatteredPos = aRandomPos;
      scatteredPos.y += sin(uTime + aRandom * 10.0) * 0.2; 
      scatteredPos.x += cos(uTime * 0.5 + aRandom * 10.0) * 0.2;

      // Mix based on uScatter
      float mixFactor = smoothstep(0.0, 1.0, uScatter);
      vec3 finalPos = mix(shapePos, scatteredPos, mixFactor);
      
      vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      float sizeMult = 1.0;
      if (color.r > 0.8 && color.g < 0.2) sizeMult = 1.5; 
      
      float scatterSizeMod = mix(1.0, 1.3, mixFactor);
      
      gl_PointSize = (uPointSize * sizeMult * scatterSizeMod + twinkle * 2.0) * uPixelRatio * (10.0 / -mvPosition.z);
      
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
      
      float glow = 1.0 - (dist * 2.0);
      glow = pow(glow, 2.0); 
      
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
  const [morphTarget, setMorphTarget] = useState<'TREE' | 'TEXT'>('TREE');

  // Morph Logic
  useEffect(() => {
    if (shape !== ShapeType.TREE && shape !== ShapeType.HEART) {
      if (morphTarget === 'TEXT') setMorphTarget('TREE');
      return;
    }
    if (gestureState.gesture === 'VICTORY') {
      setMorphTarget('TEXT');
    } else {
      setMorphTarget('TREE');
    }
  }, [gestureState.gesture, shape]);

  const targetData = useMemo(() => {
    if (morphTarget === 'TEXT') {
       if (shape === ShapeType.TREE) return generateTextParticles("Merry\nChristmas", PARTICLE_COUNT, 'CHRISTMAS');
       else if (shape === ShapeType.HEART) return generateTextParticles("Love\nYou", PARTICLE_COUNT, 'ROMANTIC');
    }
    return generateParticles(shape, PARTICLE_COUNT, color);
  }, [shape, color, morphTarget]);

  const currentPositions = useMemo(() => new Float32Array(targetData.positions), []);
  const currentColors = useMemo(() => new Float32Array(targetData.colors), []); 

  const { randoms, randomPositions } = useMemo(() => {
    const r = new Float32Array(PARTICLE_COUNT);
    const rp = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        r[i] = Math.random();
        rp[i * 3] = (Math.random() - 0.5) * 35;     
        rp[i * 3 + 1] = (Math.random() - 0.5) * 35; 
        rp[i * 3 + 2] = (Math.random() - 0.5) * 20; 
    }
    return { randoms: r, randomPositions: rp };
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current || !geometryRef.current || !shaderRef.current) return;

    const uniforms = shaderRef.current.uniforms;

    // --- CONTINUOUS CONTROL LOGIC ---
    // gestureState.pinchDistance now contains "Openness" (0.0 = Fist, 1.0 = Open Hand)
    const openness = gestureState.pinchDistance; 

    // 1. Expansion: 
    // Fist (0.0) -> 0.4 scale (Very compact)
    // Neutral (0.5) -> 1.0 scale (Normal)
    // Open (1.0) -> 1.5 scale (Expanded)
    // We map 0..1 to 0.4..1.8
    const targetExpansion = THREE.MathUtils.lerp(0.4, 1.8, openness);

    // 2. Scatter:
    // Only start scattering when hand is mostly open (> 0.7)
    // Map 0.7..1.0 to 0.0..1.0
    let targetScatter = 0;
    if (openness > 0.7) {
        targetScatter = (openness - 0.7) / 0.3;
    }

    // 3. Noise Amp (Wobble):
    // Fist -> Stable (0.0)
    // Neutral -> Wobbly (0.1)
    // Open -> Chaotic (0.2)
    const targetNoiseAmp = THREE.MathUtils.lerp(0.0, 0.2, openness);

    // Special override for Victory sign (Text Mode)
    if (gestureState.gesture === 'VICTORY') {
        uniforms.uExpansion.value = THREE.MathUtils.lerp(uniforms.uExpansion.value, 1.2, delta * 3);
        uniforms.uScatter.value = THREE.MathUtils.lerp(uniforms.uScatter.value, 0.0, delta * 3);
    } else {
        // Apply smooth transitions
        const lerpFactor = delta * 4.0;
        uniforms.uExpansion.value = THREE.MathUtils.lerp(uniforms.uExpansion.value, targetExpansion, lerpFactor);
        uniforms.uScatter.value = THREE.MathUtils.lerp(uniforms.uScatter.value, targetScatter, lerpFactor);
        uniforms.uNoiseAmp.value = THREE.MathUtils.lerp(uniforms.uNoiseAmp.value, targetNoiseAmp, lerpFactor);
    }
    
    // Rotation Logic (Y-Axis)
    if (gestureState.isHandDetected) {
         const targetRotationY = gestureState.rotation * Math.PI * 1.5; 
         pointsRef.current.rotation.y = THREE.MathUtils.lerp(pointsRef.current.rotation.y, targetRotationY, delta * 2.0);
    } else {
        pointsRef.current.rotation.y += delta * 0.15;
    }

    // Geometry Morphing
    const positions = geometryRef.current.attributes.position.array as Float32Array;
    const colors = geometryRef.current.attributes.color.array as Float32Array;
    const morphSpeed = delta * 4.0; 
    const colorSpeed = delta * 3.0;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      positions[i3] += (targetData.positions[i3] - positions[i3]) * morphSpeed;
      positions[i3 + 1] += (targetData.positions[i3 + 1] - positions[i3 + 1]) * morphSpeed;
      positions[i3 + 2] += (targetData.positions[i3 + 2] - positions[i3 + 2]) * morphSpeed;

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
        <bufferAttribute attach="attributes-position" count={PARTICLE_COUNT} array={currentPositions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={PARTICLE_COUNT} array={currentColors} itemSize={3} />
        <bufferAttribute attach="attributes-aRandom" count={PARTICLE_COUNT} array={randoms} itemSize={1} />
        <bufferAttribute attach="attributes-aRandomPos" count={PARTICLE_COUNT} array={randomPositions} itemSize={3} />
      </bufferGeometry>
      <shaderMaterial ref={shaderRef} args={[ParticleShaderMaterial]} uniforms-uGlobalColor-value={new THREE.Color(color)} />
    </points>
  );
};

export default Particles;