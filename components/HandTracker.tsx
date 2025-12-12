
import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { HandGestureState } from '../types';
import { Camera, AlertCircle, Loader2, Play, RefreshCcw } from 'lucide-react';

interface HandTrackerProps {
  onGestureUpdate: (state: HandGestureState) => void;
}

const HandTracker: React.FC<HandTrackerProps> = ({ onGestureUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State for UI Feedback
  const [aiState, setAiState] = useState<'IDLE' | 'LOADING' | 'READY' | 'ERROR'>('IDLE');
  const [cameraState, setCameraState] = useState<'IDLE' | 'REQUESTING' | 'READY' | 'ERROR' | 'PERM_DENIED'>('IDLE');
  const [isPlaying, setIsPlaying] = useState(false);
  
  const requestRef = useRef<number>(0);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const lastVideoTime = useRef(-1);
  const lastRotationRef = useRef<number>(0);
  const lastPitchRef = useRef<number>(0);

  // 1. Initialize AI (MediaPipe)
  useEffect(() => {
    const initAI = async () => {
      try {
        setAiState('LOADING');
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );
        
        // Try GPU, fallback to CPU
        try {
            landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 1,
                minHandDetectionConfidence: 0.5,
                minHandPresenceConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
        } catch (e) {
            console.warn("GPU Failed, using CPU", e);
            landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "CPU"
                },
                runningMode: "VIDEO",
                numHands: 1
            });
        }
        setAiState('READY');
      } catch (err) {
        console.error("AI Init Failed", err);
        setAiState('ERROR');
      }
    };
    initAI();

    return () => {
        if (landmarkerRef.current) landmarkerRef.current.close();
    };
  }, []);

  // 2. Initialize Camera Function
  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error("getUserMedia not supported");
      setCameraState('ERROR');
      return;
    }

    try {
      setCameraState('REQUESTING');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for data to load before playing
        videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
                videoRef.current.play().then(() => {
                    setIsPlaying(true);
                    setCameraState('READY');
                    requestAnimationFrame(predictLoop);
                }).catch(e => {
                    console.error("Autoplay blocked", e);
                    // State is READY but not playing, UI will show Play button
                    setCameraState('READY');
                    setIsPlaying(false);
                });
            }
        };
      }
    } catch (e) {
      console.error("Camera denied", e);
      setCameraState('PERM_DENIED');
    }
  };

  // Start camera automatically on mount if possible
  useEffect(() => {
    startCamera();
    return () => {
        // Cleanup stream
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(t => t.stop());
        }
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // 3. Prediction Loop
  const predictLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    if (video && canvas && landmarker && !video.paused && !video.ended) {
        // Only predict if video has progressed
        if (video.currentTime !== lastVideoTime.current) {
            lastVideoTime.current = video.currentTime;
            const startTimeMs = performance.now();
            
            try {
                const result = landmarker.detectForVideo(video, startTimeMs);
                
                // --- Drawing & Logic ---
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Reset canvas
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.save();
                    // Mirroring
                    ctx.scale(-1, 1);
                    ctx.translate(-canvas.width, 0);

                    if (result.landmarks && result.landmarks.length > 0) {
                        const landmarks = result.landmarks[0];
                        
                        // Visual Debug
                        const drawingUtils = new DrawingUtils(ctx);
                        drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "rgba(0, 255, 0, 0.5)", lineWidth: 1 });
                        drawingUtils.drawLandmarks(landmarks, { color: "rgba(255, 0, 0, 0.8)", lineWidth: 1, radius: 2 });

                        const wrist = landmarks[0];
                        
                        // --- FINGER STATE DETECTION ---
                        // Helper: Check if finger tip is significantly further from wrist than its knuckle (MCP)
                        const isFingerExtended = (tipIdx: number, mcpIdx: number) => {
                            const distTip = Math.sqrt(Math.pow(landmarks[tipIdx].x - wrist.x, 2) + Math.pow(landmarks[tipIdx].y - wrist.y, 2));
                            const distMcp = Math.sqrt(Math.pow(landmarks[mcpIdx].x - wrist.x, 2) + Math.pow(landmarks[mcpIdx].y - wrist.y, 2));
                            return distTip > distMcp * 1.2;
                        };

                        const thumbExt = isFingerExtended(4, 2);
                        const indexExt = isFingerExtended(8, 5);
                        const middleExt = isFingerExtended(12, 9);
                        const ringExt = isFingerExtended(16, 13);
                        const pinkyExt = isFingerExtended(20, 17);

                        // Classify Gesture
                        let gesture: 'OPEN' | 'CLOSED' | 'POINTING' | 'VICTORY' | 'NEUTRAL' = 'NEUTRAL';
                        
                        // Strict counting for basics
                        const extendedCount = (thumbExt ? 1 : 0) + (indexExt ? 1 : 0) + (middleExt ? 1 : 0) + (ringExt ? 1 : 0) + (pinkyExt ? 1 : 0);

                        // VICTORY / PEACE (Index + Middle extended, Ring + Pinky closed)
                        // Thumb can be either, usually closed or tucked.
                        if (indexExt && middleExt && !ringExt && !pinkyExt) {
                            gesture = 'VICTORY';
                        }
                        else if (extendedCount === 5) {
                            gesture = 'OPEN';
                        } else if (extendedCount === 0) {
                            gesture = 'CLOSED';
                        } else if (extendedCount === 1 && indexExt) {
                            gesture = 'POINTING';
                        } else if (extendedCount === 2 && indexExt && thumbExt) {
                            // "L" shape, usually treated as Pointing in this context
                            gesture = 'POINTING';
                        }

                        // --- ROTATION LOGIC ---
                        
                        // 1. Yaw (Left/Right) - controlled by OPEN hand X position
                        let rotation = lastRotationRef.current;
                        if (gesture === 'OPEN') {
                             // Map x (0..1) to (-1..1)
                             rotation = (1 - landmarks[0].x) * 2 - 1;
                             lastRotationRef.current = rotation;
                        }

                        // 2. Pitch (Up/Down) - controlled by POINTING hand Y position
                        let pitch = lastPitchRef.current;
                        if (gesture === 'POINTING') {
                            // Map y (0..1) to (-1..1) 
                            // Note: Screen Y increases downwards. 
                            // -1 (Top of screen) -> Rotate Up
                            // 1 (Bottom of screen) -> Rotate Down
                            pitch = (landmarks[8].y - 0.5) * 2; 
                            lastPitchRef.current = pitch;
                        }

                        // Calculate generic pinch distance for expansion fallback
                        const tips = [8, 12, 16, 20];
                        const middleFingerMCP = landmarks[9];
                        const handSize = Math.sqrt(
                            Math.pow(middleFingerMCP.x - wrist.x, 2) + 
                            Math.pow(middleFingerMCP.y - wrist.y, 2)
                        );
                        let avgTipDist = 0;
                        tips.forEach(idx => {
                            const dx = landmarks[idx].x - wrist.x;
                            const dy = landmarks[idx].y - wrist.y;
                            avgTipDist += Math.sqrt(dx*dx + dy*dy);
                        });
                        const opennessRatio = (avgTipDist / 4) / handSize;

                        onGestureUpdate({
                            isHandDetected: true,
                            gesture,
                            rotation,
                            pitch,
                            pinchDistance: opennessRatio
                        });
                        
                        // Debug Text on Canvas
                        ctx.scale(-1, 1); // un-mirror for text
                        ctx.translate(-canvas.width, 0);
                        ctx.fillStyle = "white";
                        ctx.font = "14px sans-serif";
                        ctx.fillText(`Gesture: ${gesture}`, 10, 20);
                        if (gesture === 'VICTORY') ctx.fillText('Mode: CHRISTMAS TEXT', 10, 40);

                    } else {
                        // Keep last known states
                        onGestureUpdate({ 
                            isHandDetected: false, 
                            gesture: 'NEUTRAL', 
                            rotation: lastRotationRef.current, 
                            pitch: lastPitchRef.current,
                            pinchDistance: 0.5 
                        });
                    }
                    ctx.restore();
                }
            } catch (e) {
                console.warn("Prediction Error", e);
            }
        }
    }

    requestRef.current = requestAnimationFrame(predictLoop);
  };

  // 4. Manual Retry / Start Handler
  const handleManualStart = () => {
      startCamera();
  };

  // --- RENDER HELPERS ---
  const renderStatus = () => {
    if (cameraState === 'PERM_DENIED') {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/95 p-4 text-center z-10">
                <AlertCircle className="w-8 h-8 text-white mb-2" />
                <p className="text-white text-xs mb-3">Camera access blocked.</p>
                <button 
                  onClick={handleManualStart}
                  className="px-3 py-1 bg-white text-black text-xs font-bold rounded-full flex items-center gap-1 hover:bg-gray-200"
                >
                    <RefreshCcw size={12} /> Retry
                </button>
            </div>
        );
    }
    
    if (aiState === 'LOADING' || cameraState === 'REQUESTING') {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                <Loader2 className="w-6 h-6 text-yellow-400 animate-spin mb-2" />
                <p className="text-white text-xs">{aiState === 'LOADING' ? 'Loading AI...' : 'Starting Camera...'}</p>
            </div>
        );
    }
    
    // If ready but not playing (browsers blocked autoplay)
    if (cameraState === 'READY' && !isPlaying) {
        return (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 hover:bg-black/40 cursor-pointer group" onClick={() => {
                 if(videoRef.current) {
                     videoRef.current.play().then(() => setIsPlaying(true));
                     requestAnimationFrame(predictLoop);
                 }
             }}>
                <div className="bg-white/20 p-3 rounded-full group-hover:scale-110 transition-transform backdrop-blur-md">
                    <Play className="w-6 h-6 text-white fill-white" />
                </div>
                <p className="text-white text-xs mt-2 font-semibold">Click to Start</p>
            </div>
        );
    }

    return null;
  };

  return (
    <div className="fixed bottom-4 right-4 w-48 h-36 bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl z-50">
      <div className="relative w-full h-full">
        {/* Video Element */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
          playsInline
          muted
        />
        
        {/* Debug Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
          width={640}
          height={480}
        />

        {/* Status Overlay */}
        {renderStatus()}

        {/* corner decoration */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/40 backdrop-blur px-2 py-0.5 rounded text-[10px] text-white/70">
            <div className={`w-1.5 h-1.5 rounded-full ${isPlaying && aiState === 'READY' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            <span>AI VISION</span>
        </div>
      </div>
      
      {/* Explicit Retry Button if idle/error */}
      {(cameraState === 'ERROR' || (cameraState === 'IDLE' && aiState === 'ERROR')) && (
          <button 
            onClick={handleManualStart}
            className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-50 hover:bg-gray-800 transition-colors"
          >
              <Camera className="w-6 h-6 text-white mb-1" />
              <span className="text-xs text-white">Enable Camera</span>
          </button>
      )}
    </div>
  );
};

export default HandTracker;
