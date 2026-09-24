// CRUD для последовательностей (Sequences) и движений (Movements) — используется в админке
const { Sequence, Movement } = require('../models');
const { ApiError } = require('../middlewares/error');
const { parseVideoId } = require('../utils/youtube');

async function createSequence(req, res, next) {
  try {
    const sequence = await Sequence.create(req.body);
    res.status(201).json({ success: true, data: sequence, error: null });
  } catch (err) {
    next(err);
  }
}

async function updateSequence(req, res, next) {
  try {
    const sequence = await Sequence.findByPk(req.params.id);
    if (!sequence) throw new ApiError(404, 'SEQUENCE_NOT_FOUND', 'Последовательность не найдена');
    await sequence.update(req.body);
    res.json({ success: true, data: sequence, error: null });
  } catch (err) {
    next(err);
  }
}

async function deleteSequence(req, res, next) {
  try {
    const sequence = await Sequence.findByPk(req.params.id);
    if (!sequence) throw new ApiError(404, 'SEQUENCE_NOT_FOUND', 'Последовательность не найдена');
    await sequence.destroy();
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
}

async function createMovement(req, res, next) {
  try {
    if (req.body.youtubeUrl) parseVideoId(req.body.youtubeUrl); // валидация ссылки
    const movement = await Movement.create(req.body);
    res.status(201).json({ success: true, data: movement, error: null });
  } catch (err) {
    next(err);
  }
}

async function updateMovement(req, res, next) {
  try {
    const movement = await Movement.findByPk(req.params.id);
    if (!movement) throw new ApiError(404, 'MOVEMENT_NOT_FOUND', 'Движение не найдено');
    await movement.update(req.body);
    res.json({ success: true, data: movement, error: null });
  } catch (err) {
    next(err);
  }
}

async function deleteMovement(req, res, next) {
  try {
    const movement = await Movement.findByPk(req.params.id);
    if (!movement) throw new ApiError(404, 'MOVEMENT_NOT_FOUND', 'Движение не найдено');
    await movement.destroy();
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createSequence,
  updateSequence,
  deleteSequence,
  createMovement,
  updateMovement,
  deleteMovement,
};
