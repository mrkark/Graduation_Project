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

const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: false }));
const allowedOrigins = [
  'http://localhost:5173',
  'https://localhost:5173',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:5173',
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
const uploadsPath = fs.existsSync(path.join(__dirname, '..', 'uploads'))
  ? path.join(__dirname, '..', 'uploads')
  : path.join(__dirname, '..', '..', 'uploads');
app.use('/uploads', express.static(uploadsPath));

app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));

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
app.use('/api/admin', adminRoutes);
app.use('/api/animations', require('./routes/animationRoutes'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
