const { body, param } = require('express-validator');

const createCommentValidator = [
  body('text').trim().notEmpty().withMessage('Комментарий не может быть пустым').isLength({ max: 2000 }).withMessage('Комментарий слишком длинный (макс. 2000 символов)'),
  body('kataId').optional({ nullable: true }).isInt(),
  body('bunkaiId').optional({ nullable: true }).isInt(),
  body().custom((value) => {
    const hasKata = value.kataId !== undefined && value.kataId !== null;
    const hasBunkai = value.bunkaiId !== undefined && value.bunkaiId !== null;
    if (hasKata === hasBunkai) {
      throw new Error('Комментарий должен относиться либо к ката, либо к бункаю (и только к одному)');
    }
    return true;
  }),
];

const idParamValidator = [param('id').isInt().withMessage('Некорректный идентификатор')];

module.exports = { createCommentValidator, idParamValidator };
