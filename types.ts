
export enum ShapeType {
  TREE = 'Tree',
  HEART = 'Heart',
  STAR = 'Star',
  SPHERE = 'Firework',
  CUBE = 'Present Box'
}

export interface HandGestureState {
  isHandDetected: boolean;
  gesture: 'OPEN' | 'CLOSED' | 'POINTING' | 'VICTORY' | 'NEUTRAL';
  rotation: number; // Y-axis (Yaw) - Normalized -1 to 1
  pitch: number;    // X-axis (Pitch) - Normalized -1 to 1
  pinchDistance: number; // 0 to 1
}

export interface AppState {
  shape: ShapeType;
  color: string;
  particleCount: number;
}
