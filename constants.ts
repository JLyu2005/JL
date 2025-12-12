import { ShapeType } from './types';

export const PARTICLE_COUNT = 8000;
export const CAMERA_FOV = 45;
export const CAMERA_POSITION = [0, 0, 15] as const;

export const SHAPE_CONFIGS = {
  [ShapeType.TREE]: { color: '#2f5a2f', highlight: '#ffd700' }, // Matte Green + Gold
  [ShapeType.HEART]: { color: '#e63946', highlight: '#ffadad' },
  [ShapeType.STAR]: { color: '#ffd700', highlight: '#ffffff' },
  [ShapeType.SPHERE]: { color: '#4cc9f0', highlight: '#ffffff' }, // Fireworks
  [ShapeType.CUBE]: { color: '#c1121f', highlight: '#fdf0d5' }, // Christmas Red
};

export const INITIAL_COLOR = '#2f5a2f'; // Christmas Tree Green
