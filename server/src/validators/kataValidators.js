const { body, param, query } = require('express-validator');

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'master'];

const createKataValidator = [
  body('title').trim().isLength({ min: 2, max: 200 }).withMessage('Название: от 2 до 200 символов'),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 8000 }),
  body('difficulty').optional({ checkFalsy: true }).isIn(DIFFICULTIES).withMessage('Некорректная сложность'),
  body('style').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('videoUrl').optional({ checkFalsy: true }).trim().isURL().withMessage('Некорректная ссылка на видео'),
  body('thumbnailUrl').optional({ checkFalsy: true }).trim().isURL().withMessage('Некорректная ссылка на изображение'),
  body('steps').optional().isArray().withMessage('Шаги должны быть массивом'),
  body('steps.*.stepNumber').optional().isInt({ min: 1 }),
  body('steps.*.title').optional().trim().isLength({ min: 1, max: 200 }),
];

const updateKataValidator = [
  param('id').isInt().withMessage('Некорректный идентификатор'),
  body('title').optional().trim().isLength({ min: 2, max: 200 }).withMessage('Название: от 2 до 200 символов'),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 8000 }),
  body('difficulty').optional({ checkFalsy: true }).isIn(DIFFICULTIES).withMessage('Некорректная сложность'),
  body('style').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('videoUrl').optional({ checkFalsy: true }).trim().isURL().withMessage('Некорректная ссылка на видео'),
  body('thumbnailUrl').optional({ checkFalsy: true }).trim().isURL().withMessage('Некорректная ссылка на изображение'),
  body('steps').optional().isArray().withMessage('Шаги должны быть массивом'),
  body('steps.*.stepNumber').optional().isInt({ min: 1 }),
  body('steps.*.title').optional().trim().isLength({ min: 1, max: 200 }),
];

const listQueryValidator = [
  query('search').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  query('difficulty').optional({ checkFalsy: true }).isIn(DIFFICULTIES),
  query('style').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  query('status').optional({ checkFalsy: true }).isIn(['pending', 'approved', 'rejected']),
  query('sort').optional({ checkFalsy: true }).isIn(['newest', 'oldest', 'title']),
  query('page').optional({ checkFalsy: true }).isInt({ min: 1 }),
  query('pageSize').optional({ checkFalsy: true }).isInt({ min: 1, max: 100 }),
];

const idParamValidator = [param('id').isInt().withMessage('Некорректный идентификатор')];

module.exports = { createKataValidator, updateKataValidator, listQueryValidator, idParamValidator, DIFFICULTIES };
