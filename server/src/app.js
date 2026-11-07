const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const kataRoutes = require('./routes/kataRoutes');
const bunkaiRoutes = require('./routes/bunkaiRoutes');
const commentRoutes = require('./routes/commentRoutes');
const chatRoutes = require('./routes/chatRoutes');
const friendRoutes = require('./routes/friendRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const dojoRoutes = require('./routes/dojoRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');

const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://img.youtube.com',
          'https://i.ytimg.com',
          'https://*.ytimg.com',
          'https://*.youtube.com',
        ],
        frameSrc: [
          "'self'",
          'https://www.youtube.com',
          'https://www.youtube-nocookie.com',
          'https://youtube.com',
        ],
        connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
  })
);
const allowedOrigins = [
  'http://localhost:5173',
  'https://localhost:5173',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:5173',
  'http://localhost',
  'https://localhost',
  'http://localhost:8080',
  'https://localhost:8080',
  'http://127.0.0.1',
  'http://127.0.0.1:8080',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true, // обязательно для httpOnly refresh-cookie
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Статика загруженных файлов (аватары/видео/превью) — раздел 16 ТЗ
const fs = require('fs');
const uploadsPath = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
const avatarsPath = path.join(uploadsPath, 'avatars');
if (!fs.existsSync(avatarsPath)) {
  fs.mkdirSync(avatarsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));

// Получение и обновление статуса локального HTTPS шлюза для подключения телефонов
app.get('/api/mocap/tunnel', (req, res) => {
  try {
    const tunnelPath = path.join(uploadsPath, 'tunnel-info.json');
    if (fs.existsSync(tunnelPath)) {
      const data = JSON.parse(fs.readFileSync(tunnelPath, 'utf8'));
      if (data && data.localIp && !data.localIp.startsWith('172.') && data.localIp !== '127.0.0.1') {
        return res.json({ success: true, data });
      }
    }
  } catch (e) {
    // игнорируем ошибку чтения файла
  }

  const defaultHost = (process.env.HOST_IP && process.env.HOST_IP !== '127.0.0.1' && !process.env.HOST_IP.startsWith('172.'))
    ? process.env.HOST_IP
    : '10.129.167.47';

  return res.json({
    success: true,
    data: {
      active: true,
      url: `https://${defaultHost}:8088`,
      httpsUrl: `https://${defaultHost}:8088`,
      httpsPort: 8088,
      gatewayPort: 8443,
      gatewayUrl: `https://${defaultHost}:8443`,
      studioPort: 8000,
      studioUrl: `http://${defaultHost}:8000/studio`,
      localIp: defaultHost,
      localIps: [
        { name: 'Wi-Fi (Активный LAN)', ip: defaultHost, isPrimary: true },
        { name: 'Localhost (ПК)', ip: '127.0.0.1', isPrimary: false },
      ],
    },
  });
});

app.post('/api/mocap/refresh', (req, res) => {
  try {
    const tunnelPath = path.join(uploadsPath, 'tunnel-info.json');
    let data = {};
    if (fs.existsSync(tunnelPath)) {
      try {
        data = JSON.parse(fs.readFileSync(tunnelPath, 'utf8'));
      } catch {}
    }
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/mocap/tunnel', (req, res) => {
  try {
    const { url, active, localIp, localIps, httpsPort, httpsUrl, publicUrl, tunnelUrl, tunnelActive } = req.body;
    const tunnelPath = path.join(uploadsPath, 'tunnel-info.json');
    let existing = {};
    if (fs.existsSync(tunnelPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(tunnelPath, 'utf8'));
      } catch (e) {}
    }
    const finalIp = localIp || existing.localIp || process.env.HOST_IP || '10.129.167.47';
    const finalPublicUrl = publicUrl !== undefined ? publicUrl : (tunnelUrl !== undefined ? tunnelUrl : (existing.publicUrl || existing.tunnelUrl || null));
    const finalTunnelActive = tunnelActive !== undefined ? Boolean(tunnelActive) : (existing.tunnelActive !== undefined ? existing.tunnelActive : false);
    const data = {
      ...existing,
      active: active !== undefined ? Boolean(active) : existing.active,
      publicUrl: finalPublicUrl,
      tunnelUrl: finalPublicUrl,
      tunnelActive: finalTunnelActive,
      localIp: finalIp,
      httpsPort: httpsPort || existing.httpsPort || 8088,
      httpsUrl: httpsUrl || `https://${finalIp}:${httpsPort || existing.httpsPort || 8088}`,
      gatewayPort: existing.gatewayPort || 8443,
      gatewayUrl: existing.gatewayUrl || `https://${finalIp}:8443`,
      studioPort: existing.studioPort || 8000,
      studioUrl: existing.studioUrl || `http://${finalIp}:8000/studio`,
      url: httpsUrl || `https://${finalIp}:8088`,
      localIps: localIps || existing.localIps,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(tunnelPath, JSON.stringify(data, null, 2), 'utf8');
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Проксирование запросов записи анимации к Python AI MoCap Studio (порт 8000)
app.all(['/api/record*', '/record*'], async (req, res) => {
  const http = require('http');
  const mocapHost = process.env.MOCAP_HOST || (process.env.NODE_ENV === 'production' ? 'mocap-studio' : '127.0.0.1');
  const targetPath = req.originalUrl;
  
  const forwardReq = (host, port, onFail) => {
    const proxyReq = http.request(
      {
        hostname: host,
        port: port,
        path: targetPath,
        method: req.method,
        headers: { ...req.headers, host: `${host}:${port}` },
        timeout: 5000,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );
    proxyReq.on('error', onFail);
    if (req.body && Object.keys(req.body).length > 0) {
      proxyReq.write(JSON.stringify(req.body));
    }
    proxyReq.end();
  };

  forwardReq(mocapHost, 8000, () => {
    forwardReq('127.0.0.1', 8000, (err2) => {
      if (!res.headersSent) {
        res.status(502).json({ error: 'MoCap Studio unreachable', message: err2.message });
      }
    });
  });
});

// --- Публичные и защищённые маршруты API ---
// /api/auth/register и /api/auth/login — единственные маршруты, доступные guest.
// Всё остальное защищено requireAuth внутри соответствующих роутеров (раздел 2 ТЗ:
// backend обязан возвращать 401, а не полагаться только на редирект во фронтенде).
app.use('/api/auth', authRoutes);
app.use('/api/kata', kataRoutes);
app.use('/api/bunkai', bunkaiRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dojos', dojoRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/animations', require('./routes/animationRoutes'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
