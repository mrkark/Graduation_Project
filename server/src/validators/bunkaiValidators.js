const { body, param, query } = require('express-validator');
const { DIFFICULTIES } = require('./kataValidators');

const createBunkaiValidator = [
  body('kataId').isInt().withMessage('Укажите связанное ката'),
  body('title').trim().isLength({ min: 2, max: 200 }).withMessage('Название: от 2 до 200 символов'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 8000 }),
  body('application').optional({ nullable: true }).trim().isLength({ max: 8000 }),
  body('difficulty').optional().isIn(DIFFICULTIES).withMessage('Некорректная сложность'),
  body('videoUrl').optional({ nullable: true }).trim().isURL().withMessage('Некорректная ссылка на видео'),
  body('thumbnailUrl').optional({ nullable: true }).trim().isURL().withMessage('Некорректная ссылка на изображение'),
];

const updateBunkaiValidator = [
  param('id').isInt(),
  ...createBunkaiValidator.map((v) => v.optional()),
];

const listQueryValidator = [
  query('search').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  query('kataId').optional({ checkFalsy: true }).isInt(),
  query('difficulty').optional({ checkFalsy: true }).isIn(DIFFICULTIES),
  query('status').optional({ checkFalsy: true }).isIn(['pending', 'approved', 'rejected']),
  query('sort').optional({ checkFalsy: true }).isIn(['newest', 'oldest', 'title']),
  query('page').optional({ checkFalsy: true }).isInt({ min: 1 }),
  query('pageSize').optional({ checkFalsy: true }).isInt({ min: 1, max: 100 }),
];

const idParamValidator = [param('id').isInt().withMessage('Некорректный идентификатор')];

module.exports = { createBunkaiValidator, updateBunkaiValidator, listQueryValidator, idParamValidator };
