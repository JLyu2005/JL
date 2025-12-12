
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

declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: any;
      span: any;
      p: any;
      h1: any;
      button: any;
      input: any;
      label: any;
      video: any;
      canvas: any;
    }
  }
}
