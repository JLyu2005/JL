
import { ShapeType } from '../types';
import * as THREE from 'three';

// Helper to get random point on sphere
function randomSpherePoint(radius: number) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.sin(phi) * Math.sin(theta);
  const z = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Generate particles for text by scanning an HTML5 Canvas
export const generateTextParticles = (text: string, count: number, theme: 'CHRISTMAS' | 'ROMANTIC' = 'CHRISTMAS'): { positions: Float32Array, colors: Float32Array } => {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  
  if (!ctx) return { positions, colors };

  // 1. Setup Canvas
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  
  // Font Selection based on Theme
  if (theme === 'ROMANTIC') {
    // Elegant cursive/script font for "Love You"
    // Fallback stack ensures it looks like handwriting on most systems
    ctx.font = '400 180px "Brush Script MT", "Lucida Calligraphy", "Segoe Script", "Apple Chancery", cursive';
  } else {
    // Classic serif for "Merry Christmas"
    ctx.font = 'italic 700 160px "Times New Roman", serif'; 
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 2. Draw Text (Multiline support)
  const lines = text.split('\n');
  const lineHeight = 180;
  const totalHeight = lines.length * lineHeight;
  const startY = (size / 2) - (totalHeight / 2) + (lineHeight / 2);

  lines.forEach((line, i) => {
    ctx.fillText(line, size / 2, startY + i * lineHeight);
  });

  // 3. Scan Pixels
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  const validPixels: number[] = [];

  // Optimization: Scan step 2 or 4 to save time
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 50) { // If pixel is bright enough
      validPixels.push(i / 4);
    }
  }

  // 4. Map Particles to Pixels
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    
    // Fallback if no text pixels found
    if (validPixels.length === 0) {
      positions[i3] = (Math.random() - 0.5) * 10; 
      positions[i3+1] = (Math.random() - 0.5) * 10; 
      positions[i3+2] = (Math.random() - 0.5) * 10;
      continue;
    }

    const pixelIndex = validPixels[Math.floor(Math.random() * validPixels.length)];
    const px = pixelIndex % size;
    const py = Math.floor(pixelIndex / size);

    // Map 2D pixel to 3D space (-10 to 10 range approximately)
    const x = (px / size - 0.5) * 22; 
    const y = -(py / size - 0.5) * 22; // Invert Y
    const z = (Math.random() - 0.5) * 1.5; // Slight depth

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;

    // Custom Theme Coloring
    const rand = Math.random();
    let finalColor;
    
    if (theme === 'ROMANTIC') {
        // Romantic Palette: Hot Pink, Soft Pink, Red, White
        const hotPink = new THREE.Color('#ff1493');
        const softPink = new THREE.Color('#ffb7b2');
        const red = new THREE.Color('#e63946');
        const white = new THREE.Color('#ffffff');

        // Distribution favoring pinks/reds
        if (rand > 0.8) finalColor = white;
        else if (rand > 0.5) finalColor = softPink;
        else if (rand > 0.2) finalColor = hotPink;
        else finalColor = red;
        
    } else {
        // Christmas Palette: Gold, Red, Green, White
        const red = new THREE.Color('#c1121f');
        const green = new THREE.Color('#2f5a2f');
        const gold = new THREE.Color('#ffd700');
        const white = new THREE.Color('#ffffff');

        if (rand > 0.7) finalColor = gold;
        else if (rand > 0.4) finalColor = red;
        else if (rand > 0.15) finalColor = green;
        else finalColor = white;
    }

    colors[i3] = finalColor.r;
    colors[i3 + 1] = finalColor.g;
    colors[i3 + 2] = finalColor.b;
  }

  return { positions, colors };
};

export const generateParticles = (shape: ShapeType, count: number, baseColorHex: string): { positions: Float32Array, colors: Float32Array } => {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const tempVec = new THREE.Vector3();
  const color = new THREE.Color(baseColorHex);
  const colorObj = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;

    switch (shape) {
      case ShapeType.TREE:
        const type = Math.random();
        
        if (type > 0.98) {
             // TOP STAR
             const r = Math.random() * 1.5;
             const theta = Math.random() * Math.PI * 2;
             const phi = Math.acos(2 * Math.random() - 1);
             tempVec.set(
                 r * Math.sin(phi) * Math.cos(theta),
                 5.5 + r * Math.sin(phi) * Math.sin(theta) * 0.5,
                 r * Math.cos(phi)
             );
             colorObj.setHex(0xffdd00).lerp(new THREE.Color(0xffffff), Math.random() * 0.5);

        } else if (type > 0.88) {
             // ORNAMENTS
             const h = 10;
             const y = Math.random() * h - h/2;
             const normalizedY = (y + 5) / 10;
             const rBase = 4.2; 
             const r = (1 - normalizedY) * rBase;
             const angle = y * 5.0 + (Math.PI * 2 * (i % 3) / 3);
             
             tempVec.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
             
             const ornamentRand = Math.random();
             if (ornamentRand > 0.6) colorObj.setHex(0xff0000);
             else if (ornamentRand > 0.3) colorObj.setHex(0xffd700);
             else colorObj.setHex(0xc0c0c0);
             
        } else {
             // NEEDLES
             const h = 10;
             const y = Math.random() * h - h/2;
             const normalizedY = (y + 5) / 10;
             const rBase = 4.0;
             const rMax = (1 - normalizedY) * rBase;
             const r = Math.sqrt(Math.random()) * rMax;
             const angle = Math.random() * Math.PI * 2;
             
             tempVec.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
             colorObj.setHex(0x2f5a2f).lerp(new THREE.Color(0x1a331a), Math.random());
        }
        break;

      case ShapeType.HEART:
        let xH = 0, yH = 0, zH = 0, attempts = 0;
        while (attempts++ < 100) {
          xH = (Math.random() * 2 - 1) * 3;
          yH = (Math.random() * 2 - 1) * 3;
          zH = (Math.random() * 2 - 1) * 3;
          const a = xH * xH + (9/4) * yH * yH + zH * zH - 1;
          if (a * a * a - xH * xH * zH * zH * zH - (9/80) * yH * yH * zH * zH * zH < 0) break;
        }
        tempVec.set(xH * 4, yH * 4, zH * 4);
        const dist = Math.sqrt(xH*xH + yH*yH + zH*zH);
        colorObj.copy(color).lerp(new THREE.Color(0xffb7b2), dist / 4);
        break;

      case ShapeType.STAR:
        const branches = 5;
        const spin = Math.floor(Math.random() * branches) * (Math.PI * 2 / branches);
        const distStar = Math.pow(Math.random(), 0.5) * 5; 
        const thickness = 1.5 - (distStar / 5);
        tempVec.set(
            Math.cos(spin) * distStar + (Math.random() - 0.5) * thickness,
            (Math.random() - 0.5) * thickness * 2,
            Math.sin(spin) * distStar + (Math.random() - 0.5) * thickness
        );
        colorObj.copy(color).lerp(new THREE.Color(0xffffff), Math.random() * 0.5);
        break;

      case ShapeType.SPHERE:
        tempVec.copy(randomSpherePoint(4.5 * Math.cbrt(Math.random())));
        colorObj.setHSL(Math.random(), 1.0, 0.6);
        break;
      
      case ShapeType.CUBE:
        const side = 6;
        tempVec.set(
          (Math.random() - 0.5) * side,
          (Math.random() - 0.5) * side,
          (Math.random() - 0.5) * side
        );
        colorObj.copy(color);
        break;

      default:
        tempVec.set(0, 0, 0);
        colorObj.copy(color);
    }

    positions[i3] = tempVec.x;
    positions[i3 + 1] = tempVec.y;
    positions[i3 + 2] = tempVec.z;

    colors[i3] = colorObj.r;
    colors[i3 + 1] = colorObj.g;
    colors[i3 + 2] = colorObj.b;
  }
  return { positions, colors };
};
