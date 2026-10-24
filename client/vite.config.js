import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import net from 'net';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Внутри Docker (Linux) бэкенд доступен как http://server:5000, локально на Windows как http://localhost:5000
const backendTarget =
  process.env.BACKEND_URL || (process.platform === 'linux' ? 'http://server:5000' : 'http://localhost:5000');
const studioTarget =
  process.env.STUDIO_URL || (process.platform === 'linux' ? 'http://mocap-studio:8000' : 'http://localhost:8000');

function mocapAutoStartPlugin() {
  return {
    name: 'mocap-autostart',
    configureServer() {
      if (process.platform === 'linux') return; // внутри Docker управляется docker-compose
      const s = new net.Socket();
      let handled = false;
      const launch = () => {
        if (handled) return;
        handled = true;
        try { s.destroy(); } catch {}
        const studioDir = path.resolve(__dirname, '../karate_motion_studio');
        const studioScript = path.join(studioDir, 'web_studio_server.py');
        if (!fs.existsSync(studioScript)) return;

        const candidatePythons = [
          process.env.PYTHON_PATH,
          process.env.MOCAP_PYTHON,
          path.join(studioDir, '.venv', 'Scripts', 'python.exe'),
          path.resolve(__dirname, '../../.venv/Scripts/python.exe'),
          'C:\\Users\\user\\Downloads\\bunkai_explorer_karate_motion_capture\\bunkai_explorer_karate_motion_capture\\.venv\\Scripts\\python.exe',
          'python',
          'python3',
          'py',
        ].filter(Boolean);

        let pythonExe = candidatePythons.find((p) => {
          try {
            return fs.existsSync(p);
          } catch {
            return false;
          }
        }) || 'python';

        try {
          const child = spawn(pythonExe, ['web_studio_server.py'], {
            cwd: studioDir,
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
          });
          child.unref();
          console.log(`\n✔ [Vite] Python AI MoCap Server запущен автоматически (${pythonExe})\n`);
        } catch {}
      };
      s.setTimeout(800);
      s.on('connect', () => {
        handled = true;
        s.destroy();
      });
      s.on('error', launch);
      s.on('timeout', launch);
      s.connect(8000, '127.0.0.1');
    },
  };
}

const handleProxyError = (proxy) => {
  proxy.on('error', (err, req, res) => {
    if (res && res.writeHead && !res.headersSent) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'External studio offline (port 8000)', details: err.message }));
    }
  });
};

export default defineConfig({
  plugins: [react(), mocapAutoStartPlugin()],
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
      '/cam1': {
        target: studioTarget,
        changeOrigin: true,
        secure: false,
        configure: handleProxyError,
      },
      '/cam2': {
        target: studioTarget,
        changeOrigin: true,
        secure: false,
        configure: handleProxyError,
      },
      '/cam3': {
        target: studioTarget,
        changeOrigin: true,
        secure: false,
        configure: handleProxyError,
      },
      '/ws/stream': {
        target: studioTarget,
        ws: true,
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
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three')) return 'vendor-three';
            if (id.includes('socket.io-client')) return 'vendor-socket';
            return 'vendor';
          }
        },
      },
    },
  },
});
