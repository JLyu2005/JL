import React, { useState, useCallback } from 'react';
import Scene from './components/Scene';
import UI from './components/UI';
import HandTracker from './components/HandTracker';
import { ShapeType, HandGestureState } from './types';
import { INITIAL_COLOR } from './constants';

function App() {
  const [currentShape, setCurrentShape] = useState<ShapeType>(ShapeType.TREE);
  const [currentColor, setCurrentColor] = useState<string>(INITIAL_COLOR);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [gestureState, setGestureState] = useState<HandGestureState>({
    isHandDetected: false,
    gesture: 'NEUTRAL',
    rotation: 0,
    pitch: 0, // Added missing property
    pinchDistance: 0.5
  });

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden select-none">
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <Scene 
          currentShape={currentShape}
          currentColor={currentColor}
          gestureState={gestureState}
        />
      </div>

      {/* UI Overlay Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
         <UI
            currentShape={currentShape}
            setShape={setCurrentShape}
            currentColor={currentColor}
            setColor={setCurrentColor}
            gestureState={gestureState}
            isFullscreen={isFullscreen}
            toggleFullscreen={toggleFullscreen}
         />
      </div>

      {/* Hidden/Pip Camera Layer */}
      <HandTracker onGestureUpdate={setGestureState} />
    </div>
  );
}

export default App;