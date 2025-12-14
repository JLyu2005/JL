import React from 'react';
import { ShapeType, HandGestureState } from '../types';
import { SHAPE_CONFIGS } from '../constants';
import { 
  Maximize2, Minimize2, Hand, Grab, MousePointer2,
  TreePine, Heart, Star, Zap, Box, BadgeCheck
} from 'lucide-react';

interface UIProps {
  currentShape: ShapeType;
  setShape: (s: ShapeType) => void;
  currentColor: string;
  setColor: (c: string) => void;
  gestureState: HandGestureState;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

const UI: React.FC<UIProps> = ({
  currentShape, setShape, currentColor, setColor,
  gestureState, isFullscreen, toggleFullscreen
}) => {

  const getIcon = (shape: ShapeType) => {
    switch(shape) {
      case ShapeType.TREE: return <TreePine size={20} />;
      case ShapeType.HEART: return <Heart size={20} />;
      case ShapeType.STAR: return <Star size={20} />;
      case ShapeType.SPHERE: return <Zap size={20} />;
      case ShapeType.CUBE: return <Box size={20} />;
      default: return <TreePine size={20} />;
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
      <div className="flex justify-between items-start pointer-events-auto">
        <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 to-yellow-500 drop-shadow-sm filter">
            Holiday Particles
            </h1>
            <div className="flex items-center gap-2 text-xs text-white/60 bg-black/40 px-3 py-1 rounded-full backdrop-blur-md w-fit border border-white/10">
                <span className={`w-2 h-2 rounded-full ${gestureState.isHandDetected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                {gestureState.isHandDetected ? 'Hand Detected' : 'No Hand Detected'}
            </div>
        </div>
        <button onClick={toggleFullscreen} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all border border-white/10">
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
      </div>

      <div className={`absolute top-1/2 right-6 -translate-y-1/2 flex flex-col gap-4 pointer-events-auto transition-opacity duration-300 ${gestureState.isHandDetected ? 'opacity-100' : 'opacity-0'}`}>
         <div className="bg-black/50 backdrop-blur-md p-4 rounded-xl border border-white/10 space-y-4 shadow-xl w-56">
            <div className="flex items-center gap-3 text-white">
                <Hand size={24} className="text-yellow-400"/>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">Open Slowly</span>
                  <span className="text-[10px] uppercase text-white/70">Expands & Scatters</span>
                  {/* Progress Bar for Openness */}
                  <div className="w-full h-1 bg-white/20 mt-1 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-yellow-400 transition-all duration-100" 
                        style={{ width: `${gestureState.pinchDistance * 100}%` }}
                    />
                  </div>
                </div>
            </div>

            <div className="flex items-center gap-3 text-white">
                <Grab size={24} className="text-yellow-400"/>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">Close (Fist)</span>
                  <span className="text-[10px] uppercase text-white/70">Condenses Particle</span>
                </div>
            </div>
            
            <div className={`flex items-center gap-3 ${gestureState.gesture === 'VICTORY' ? 'text-yellow-400' : 'text-white/50'}`}>
                <BadgeCheck size={24} />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">Peace Sign</span>
                  <span className="text-[10px] uppercase text-white/70">Reveal Message</span>
                </div>
            </div>
         </div>
      </div>

      <div className="flex flex-col md:flex-row items-end md:items-center gap-6 pointer-events-auto w-full md:w-auto mx-auto bg-black/60 backdrop-blur-lg p-4 rounded-2xl border border-white/10">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {Object.values(ShapeType).map((shape) => (
            <button
              key={shape}
              onClick={() => { setShape(shape); setColor(SHAPE_CONFIGS[shape].color); }}
              className={`p-3 rounded-xl transition-all flex items-center gap-2 min-w-[100px] border ${
                currentShape === shape ? 'bg-white/20 border-yellow-500/50 text-yellow-300' : 'bg-transparent border-transparent text-white/60 hover:bg-white/5'
              }`}
            >
              {getIcon(shape)}
              <span className="text-sm font-medium">{shape}</span>
            </button>
          ))}
        </div>
        <div className="h-8 w-[1px] bg-white/20 hidden md:block"></div>
        <div className="flex items-center gap-3">
          <label className="text-xs uppercase tracking-wider text-white/60">Color</label>
          <div className="relative group">
             <input type="color" value={currentColor} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 rounded-full cursor-pointer opacity-0 absolute inset-0 z-10" />
             <div className="w-10 h-10 rounded-full border-2 border-white/30 shadow-inner" style={{ backgroundColor: currentColor }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UI;