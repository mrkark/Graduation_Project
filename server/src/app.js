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
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true, // обязательно для httpOnly refresh-cookie
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Статика загруженных файлов (аватары/видео/превью) — раздел 16 ТЗ
app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'uploads')));

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

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
