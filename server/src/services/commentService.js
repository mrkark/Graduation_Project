const sanitizeHtml = require('sanitize-html');
const { Comment, User, Bunkai } = require('../models');
const { ApiError } = require('../middlewares/error');

async function listComments(bunkaiId) {
  return Comment.findAll({
    where: { bunkaiId, isHidden: false },
    include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }],
    order: [['createdAt', 'ASC']],
  });
}

async function addComment(bunkaiId, userId, text) {
  const bunkai = await Bunkai.findByPk(bunkaiId);
  if (!bunkai) throw new ApiError(404, 'BUNKAI_NOT_FOUND', 'Бункай не найден');

  // Санитизация текста от XSS — разрешаем только базовое форматирование
  const clean = sanitizeHtml(text, {
    allowedTags: ['b', 'i', 'em', 'strong', 'br'],
    allowedAttributes: {},
  });

  const comment = await Comment.create({ bunkaiId, userId, text: clean });
  return Comment.findByPk(comment.id, {
    include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }],
  });
}

async function deleteComment(id, user) {
  const comment = await Comment.findByPk(id);
  if (!comment) throw new ApiError(404, 'COMMENT_NOT_FOUND', 'Комментарий не найден');

  const isOwner = comment.userId === user.id;
  const isMod = ['moderator', 'admin'].includes(user.role);
  if (!isOwner && !isMod) throw new ApiError(403, 'FORBIDDEN', 'Недостаточно прав');

  await comment.destroy();
}

async function hideComment(id, isHidden) {
  const comment = await Comment.findByPk(id);
  if (!comment) throw new ApiError(404, 'COMMENT_NOT_FOUND', 'Комментарий не найден');
  await comment.update({ isHidden });
  return comment;
}

module.exports = { listComments, addComment, deleteComment, hideComment };
