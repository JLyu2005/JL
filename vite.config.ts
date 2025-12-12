import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // CRITICAL: Set base to './' so assets load correctly on GitHub Pages subdirectories
  base: './', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // Helps with chunking large Three.js files to prevent loading errors
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
          mediapipe: ['@mediapipe/tasks-vision']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'] // Prevent double-bundling issues with WASM
  }
});