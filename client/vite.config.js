import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Сертификаты для защищенного HTTPS (требуется для работы камеры на смартфонах)
const certPath = path.resolve(__dirname, 'src/certs/cert.pem');
const keyPath = path.resolve(__dirname, 'src/certs/key.pem');
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

// Внутри Docker (Linux) бэкенд доступен как http://server:5000, локально на Windows как http://localhost:5000
const backendTarget =
  process.env.BACKEND_URL || (process.platform === 'linux' ? 'http://server:5000' : 'http://localhost:5000');

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: hasCerts
      ? {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        }
      : false,
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
