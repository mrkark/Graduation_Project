const mediaService = require('../services/mediaService');
const { uploadDir } = require('../middlewares/upload');
const { ApiError } = require('../middlewares/error');

async function upload(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'NO_FILE', 'Файл не был загружен');
    const media = await mediaService.saveUploadedFile(req.file, req.user.id);
    res.status(201).json({ success: true, data: media, error: null });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const items = await mediaService.listMedia();
    res.json({ success: true, data: items, error: null });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await mediaService.deleteMedia(req.params.id, uploadDir);
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, list, remove };
