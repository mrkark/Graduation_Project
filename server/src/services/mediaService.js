const fs = require('fs');
const path = require('path');
const { MediaFile } = require('../models');
const { ApiError } = require('../middlewares/error');

async function saveUploadedFile(file, uploadedBy) {
  return MediaFile.create({
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    path: `/uploads/${file.filename}`,
    uploadedBy,
  });
}

async function listMedia() {
  return MediaFile.findAll({ order: [['createdAt', 'DESC']] });
}

async function deleteMedia(id, uploadDir) {
  const media = await MediaFile.findByPk(id);
  if (!media) throw new ApiError(404, 'MEDIA_NOT_FOUND', 'Файл не найден');

  const filePath = path.join(uploadDir, media.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await media.destroy();
}

module.exports = { saveUploadedFile, listMedia, deleteMedia };
