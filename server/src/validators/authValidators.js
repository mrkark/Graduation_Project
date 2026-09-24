const { body } = require('express-validator');

const registerValidator = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Имя пользователя должно быть от 3 до 100 символов')
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('Имя пользователя может содержать только латинские буквы, цифры, "_", "." и "-"'),
  body('email').trim().isEmail().withMessage('Некорректный email').isLength({ max: 255 }),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Пароль должен быть не короче 8 символов'),
  body('displayName').optional().trim().isLength({ max: 100 }),
];

const loginValidator = [
  body('username').trim().notEmpty().withMessage('Укажите имя пользователя'),
  body('password').notEmpty().withMessage('Укажите пароль'),
];

const updateProfileValidator = [
  body('displayName').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('bio').optional({ nullable: true }).trim().isLength({ max: 4000 }),
  body('avatarUrl').optional({ nullable: true }).trim().isLength({ max: 500 }),
];

module.exports = { registerValidator, loginValidator, updateProfileValidator };
