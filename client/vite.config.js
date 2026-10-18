import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Внутри Docker (Linux) бэкенд доступен как http://server:5000, локально на Windows как http://localhost:5000
const backendTarget =
  process.env.BACKEND_URL || (process.platform === 'linux' ? 'http://server:5000' : 'http://localhost:5000');

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: false,
    allowedHosts: true,
    watch: {
      usePolling: true,
      interval: 150,
    },
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: backendTarget,
        ws: true,
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
