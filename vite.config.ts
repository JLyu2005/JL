import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 通常部署在子目录，使用 './' (相对路径) 可以自动适配
  base: './', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
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
    exclude: ['@mediapipe/tasks-vision']
  }
});