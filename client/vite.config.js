import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Внутри Docker (Linux) бэкенд доступен как http://server:5000, локально на Windows как http://localhost:5000
const backendTarget =
  process.env.BACKEND_URL || (process.platform === 'linux' ? 'http://server:5000' : 'http://localhost:5000');
const studioTarget =
  process.env.STUDIO_URL || (process.platform === 'linux' ? 'http://host.docker.internal:8000' : 'http://localhost:8000');

const handleProxyError = (proxy) => {
  proxy.on('error', (err, req, res) => {
    if (res && res.writeHead && !res.headersSent) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'External studio offline (port 8000)', details: err.message }));
    }
  });
};

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
      '/studio': {
        target: studioTarget,
        changeOrigin: true,
        secure: false,
        configure: handleProxyError,
      },
      '/viewer': {
        target: studioTarget,
        changeOrigin: true,
        secure: false,
        configure: handleProxyError,
      },
      '/video_feed': {
        target: studioTarget,
        changeOrigin: true,
        secure: false,
        configure: handleProxyError,
      },
      '/qr': {
        target: studioTarget,
        changeOrigin: true,
        secure: false,
        configure: handleProxyError,
      },
      '/status': {
        target: studioTarget,
        changeOrigin: true,
        secure: false,
        configure: handleProxyError,
      },
      '/controls': {
        target: studioTarget,
        changeOrigin: true,
        secure: false,
        configure: handleProxyError,
      },
      '/ws': {
        target: studioTarget,
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
