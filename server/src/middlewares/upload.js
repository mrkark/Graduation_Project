const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ALLOWED_IMAGE_MIME } = require('../config/constants');

const uploadDir = path.resolve(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_IMAGE_MIME.includes(file.mimetype)) {
    return cb(new Error('Разрешена загрузка только изображений (jpeg, png, webp, gif)'));
  }
  cb(null, true);
}

const maxSize = (Number(process.env.MAX_UPLOAD_SIZE_MB) || 5) * 1024 * 1024;

const upload = multer({ storage, fileFilter, limits: { fileSize: maxSize } });

module.exports = { upload, uploadDir };
