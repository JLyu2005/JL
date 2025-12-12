import React from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { OrbitControls } from '@react-three/drei';
import Particles from './Particles';
import { ShapeType, HandGestureState } from '../types';
import { CAMERA_POSITION, CAMERA_FOV } from '../constants';

interface SceneProps {
  currentShape: ShapeType;
  currentColor: string;
  gestureState: HandGestureState;
}

const Scene: React.FC<SceneProps> = ({ currentShape, currentColor, gestureState }) => {
  return (
    <Canvas
      camera={{ position: [...CAMERA_POSITION], fov: CAMERA_FOV }}
      gl={{ antialias: false, alpha: true }} // Alpha true for background CSS gradient visibility
      dpr={[1, 2]}
    >
      <color attach="background" args={['#000000']} />
      
      {/* Fog for depth */}
      <fog attach="fog" args={['#000000', 10, 40]} />

      <ambientLight intensity={0.5} />
      
      <Particles 
        shape={currentShape} 
        color={currentColor} 
        gestureState={gestureState} 
      />

      {/* Fixed: disableNormalPass is not a valid prop, use enableNormalPass={false} instead */}
      <EffectComposer enableNormalPass={false}>
        <Bloom 
          luminanceThreshold={0.2} 
          mipmapBlur 
          intensity={1.5} 
          radius={0.6} 
        />
      </EffectComposer>

      <OrbitControls 
        enableZoom={true} 
        enablePan={false} 
        enableRotate={!gestureState.isHandDetected} // Disable mouse rotation if hand is controlling
        autoRotate={!gestureState.isHandDetected}
        autoRotateSpeed={0.5}
      />
    </Canvas>
  );
};

export default Scene;