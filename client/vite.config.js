import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Внутри Docker (Linux) бэкенд доступен как http://server:5000, локально на Windows как http://localhost:5000
const backendTarget =
  process.env.BACKEND_URL || (process.platform === 'linux' ? 'http://server:5000' : 'http://localhost:5000');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    watch: {
      usePolling: true,
      interval: 150,
    },
    proxy: {
      '/uploads': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
});
