
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
  const streamRef = useRef<MediaStream | null>(null);

  // 1. Initialize AI (MediaPipe)
  useEffect(() => {
    let isMounted = true;
    const initAI = async () => {
      try {
        setAiState('LOADING');
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );
        
        if (!isMounted) return;

        // Try GPU, fallback to CPU
        try {
            const landmarker = await HandLandmarker.createFromOptions(vision, {
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
            if (isMounted) landmarkerRef.current = landmarker;
        } catch (e) {
            console.warn("GPU Failed, using CPU", e);
            const landmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "CPU"
                },
                runningMode: "VIDEO",
                numHands: 1
            });
            if (isMounted) landmarkerRef.current = landmarker;
        }
        if (isMounted) setAiState('READY');
      } catch (err) {
        console.error("AI Init Failed", err);
        if (isMounted) setAiState('ERROR');
      }
    };
    initAI();

    return () => {
        isMounted = false;
        if (landmarkerRef.current) landmarkerRef.current.close();
    };
  }, []);

  // 2. Initialize Camera Function
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsPlaying(false);
  };

  const startCamera = async () => {
    stopCamera(); // Ensure previous stream is closed

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

      streamRef.current = stream;

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
        stopCamera();
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
                        drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "rgba(0, 255, 0, 0.3)", lineWidth: 1 });
                        drawingUtils.drawLandmarks(landmarks, { color: "rgba(255, 255, 255, 0.5)", lineWidth: 1, radius: 2 });

                        const wrist = landmarks[0];
                        
                        // --- FINGER STATE DETECTION ---
                        const isFingerExtended = (tipIdx: number, mcpIdx: number) => {
                            const distTip = Math.sqrt(Math.pow(landmarks[tipIdx].x - wrist.x, 2) + Math.pow(landmarks[tipIdx].y - wrist.y, 2));
                            const distMcp = Math.sqrt(Math.pow(landmarks[mcpIdx].x - wrist.x, 2) + Math.pow(landmarks[mcpIdx].y - wrist.y, 2));
                            return distTip > distMcp * 1.1; // Lower threshold for easier triggering
                        };

                        const thumbExt = isFingerExtended(4, 2);
                        const indexExt = isFingerExtended(8, 5);
                        const middleExt = isFingerExtended(12, 9);
                        const ringExt = isFingerExtended(16, 13);
                        const pinkyExt = isFingerExtended(20, 17);

                        let gesture: 'OPEN' | 'CLOSED' | 'POINTING' | 'VICTORY' | 'NEUTRAL' = 'NEUTRAL';
                        const extendedCount = (thumbExt ? 1 : 0) + (indexExt ? 1 : 0) + (middleExt ? 1 : 0) + (ringExt ? 1 : 0) + (pinkyExt ? 1 : 0);

                        // Improved Gesture Logic
                        if (extendedCount === 5 || extendedCount === 4) {
                            gesture = 'OPEN';
                        } else if (extendedCount === 0 || extendedCount === 1) { // Tolerate thumb
                            gesture = 'CLOSED';
                        } else if (indexExt && middleExt && !ringExt && !pinkyExt) {
                            gesture = 'VICTORY';
                        } else if (indexExt && !middleExt && !ringExt && !pinkyExt) {
                            gesture = 'POINTING';
                        }

                        // --- ROTATION LOGIC ---
                        let rotation = lastRotationRef.current;
                        if (gesture === 'OPEN') {
                             rotation = (1 - landmarks[0].x) * 2 - 1;
                             lastRotationRef.current = rotation;
                        }

                        let pitch = lastPitchRef.current;
                        if (gesture === 'POINTING') {
                            pitch = (landmarks[8].y - 0.5) * 2; 
                            lastPitchRef.current = pitch;
                        }

                        // Hand Openness (0 to 1) for smooth transitions
                        // Calculate average distance of tips from wrist
                        const tips = [8, 12, 16, 20];
                        let avgTipDist = 0;
                        tips.forEach(idx => {
                            const dx = landmarks[idx].x - wrist.x;
                            const dy = landmarks[idx].y - wrist.y;
                            avgTipDist += Math.sqrt(dx*dx + dy*dy);
                        });
                        // Normalize somewhat arbitrarily based on hand size assumption
                        const mcpDist = Math.sqrt(Math.pow(landmarks[9].x - wrist.x, 2) + Math.pow(landmarks[9].y - wrist.y, 2));
                        const opennessRatio = Math.min(Math.max((avgTipDist / 4) / (mcpDist * 2.5), 0), 1);

                        onGestureUpdate({
                            isHandDetected: true,
                            gesture,
                            rotation,
                            pitch,
                            pinchDistance: opennessRatio
                        });
                        
                    } else {
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

  const handleManualStart = () => {
      startCamera();
  };

  const renderStatus = () => {
    if (cameraState === 'PERM_DENIED') {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/95 p-4 text-center z-10">
                <AlertCircle className="w-8 h-8 text-white mb-2" />
                <p className="text-white text-xs mb-3">Camera blocked. Please allow access.</p>
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
                <p className="text-white text-xs mt-2 font-semibold">Start</p>
            </div>
        );
    }

    return null;
  };

  return (
    <div className="fixed bottom-4 right-4 w-48 h-36 bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl z-50">
      <div className="relative w-full h-full">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
          width={640}
          height={480}
        />
        {renderStatus()}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/40 backdrop-blur px-2 py-0.5 rounded text-[10px] text-white/70">
            <div className={`w-1.5 h-1.5 rounded-full ${isPlaying && aiState === 'READY' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            <span>GESTURE</span>
        </div>
      </div>
      
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
