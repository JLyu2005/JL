import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { HandGestureState } from '../types';

interface HandTrackerProps {
  onGestureUpdate: (state: HandGestureState) => void;
}

const HandTracker: React.FC<HandTrackerProps> = ({ onGestureUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const lastVideoTime = useRef(-1);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let isMounted = true;
    const initAI = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );
        
        if (!isMounted) return;

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
      } catch (err) {
        console.error("AI Init Failed", err);
      }
    };
    initAI();

    return () => {
        isMounted = false;
        if (landmarkerRef.current) landmarkerRef.current.close();
    };
  }, []);

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

    try {
      // Use 'ideal' constraints instead of exact values to avoid OverconstrainedError on some devices
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().then(() => requestAnimationFrame(predictLoop));
        };
      }
    } catch (e) {
      console.error("Camera denied or not supported", e);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const predictLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    if (video && canvas && landmarker && !video.paused && !video.ended) {
        if (video.currentTime !== lastVideoTime.current) {
            lastVideoTime.current = video.currentTime;
            
            try {
                const result = landmarker.detectForVideo(video, performance.now());
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.save();
                    ctx.scale(-1, 1);
                    ctx.translate(-canvas.width, 0);

                    if (result.landmarks && result.landmarks.length > 0) {
                        const landmarks = result.landmarks[0];
                        
                        // Debug Draw
                        const drawingUtils = new DrawingUtils(ctx);
                        drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "rgba(0, 255, 0, 0.3)", lineWidth: 1 });
                        drawingUtils.drawLandmarks(landmarks, { color: "rgba(255, 255, 255, 0.5)", lineWidth: 1, radius: 2 });

                        // --- 1. Calculate Hand Size (Normalization Reference) ---
                        const wrist = landmarks[0];
                        const middleMCP = landmarks[9];
                        const handSize = Math.sqrt(
                            Math.pow(middleMCP.x - wrist.x, 2) + 
                            Math.pow(middleMCP.y - wrist.y, 2)
                        );

                        // --- 2. Calculate Average Tip Distance from Wrist ---
                        const tipIndices = [4, 8, 12, 16, 20]; 
                        let totalTipDist = 0;
                        tipIndices.forEach(idx => {
                            const tip = landmarks[idx];
                            totalTipDist += Math.sqrt(
                                Math.pow(tip.x - wrist.x, 2) + 
                                Math.pow(tip.y - wrist.y, 2)
                            );
                        });
                        const avgTipDist = totalTipDist / 5;

                        // --- 3. Calculate "Openness" Ratio ---
                        const rawRatio = avgTipDist / handSize;
                        
                        // Map rawRatio (0.8 to 2.2) to 0.0 to 1.0
                        let openness = (rawRatio - 0.9) / (2.2 - 0.9);
                        openness = Math.max(0, Math.min(1, openness)); 

                        // --- 4. Determine Gesture Label ---
                        let gesture: 'OPEN' | 'CLOSED' | 'POINTING' | 'VICTORY' | 'NEUTRAL' = 'NEUTRAL';
                        
                        const isFingerExtended = (tipIdx: number, mcpIdx: number) => {
                             const distTip = Math.sqrt(Math.pow(landmarks[tipIdx].x - wrist.x, 2) + Math.pow(landmarks[tipIdx].y - wrist.y, 2));
                             const distMcp = Math.sqrt(Math.pow(landmarks[mcpIdx].x - wrist.x, 2) + Math.pow(landmarks[mcpIdx].y - wrist.y, 2));
                             return distTip > distMcp * 1.1; 
                        };
                        const indexExt = isFingerExtended(8, 5);
                        const middleExt = isFingerExtended(12, 9);
                        const ringExt = isFingerExtended(16, 13);
                        const pinkyExt = isFingerExtended(20, 17);

                        if (openness > 0.8) gesture = 'OPEN';
                        else if (openness < 0.2) gesture = 'CLOSED';
                        else if (indexExt && middleExt && !ringExt && !pinkyExt) gesture = 'VICTORY';
                        else if (indexExt && !middleExt && !ringExt && !pinkyExt) gesture = 'POINTING';
                        else gesture = 'NEUTRAL';

                        // --- 5. Rotation Logic ---
                        const rotationY = (wrist.x - 0.5) * 2;
                        const pitch = (wrist.y - 0.5) * 2;

                        onGestureUpdate({
                            isHandDetected: true,
                            gesture: gesture,
                            rotation: rotationY,
                            pitch: pitch,
                            pinchDistance: openness
                        });

                    } else {
                        onGestureUpdate({
                            isHandDetected: false,
                            gesture: 'NEUTRAL',
                            rotation: 0,
                            pitch: 0,
                            pinchDistance: 0.5
                        });
                    }
                    ctx.restore();
                }
            } catch (e) {
                console.warn(e);
            }
        }
    }
    requestRef.current = requestAnimationFrame(predictLoop);
  };

  return (
    <div className="fixed bottom-4 right-4 w-32 h-24 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg z-50 bg-black">
      <video
        ref={videoRef}
        className="w-full h-full object-cover transform -scale-x-100"
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full transform -scale-x-100"
        width={320}
        height={240}
      />
    </div>
  );
};

export default HandTracker;