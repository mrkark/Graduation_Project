const { Bunkai, Tag, Vote, User, Movement, BunkaiRelation } = require('../models');
const { ApiError } = require('../middlewares/error');
const { BUNKAI_STATUS } = require('../config/constants');

async function listBunkai({ status, tag, difficulty, page = 1, limit = 20 }) {
  const where = {};
  if (status) where.status = status;
  else where.status = BUNKAI_STATUS.APPROVED; // по умолчанию публично видны только одобренные
  if (difficulty) where.difficulty = difficulty;

  const include = [
    { model: User, as: 'author', attributes: ['id', 'username', 'avatar'] },
    { model: Tag, as: 'tags', through: { attributes: [] } },
  ];
  if (tag) include[1].where = { slug: tag };

  const offset = (page - 1) * limit;
  const { rows, count } = await Bunkai.findAndCountAll({
    where,
    include,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return { items: rows, total: count, page: Number(page), limit: Number(limit) };
}

async function getBunkaiById(id) {
  const bunkai = await Bunkai.findByPk(id, {
    include: [
      { model: User, as: 'author', attributes: ['id', 'username', 'avatar'] },
      { model: Tag, as: 'tags', through: { attributes: [] } },
      { model: Movement, as: 'movement' },
    ],
  });
  if (!bunkai) throw new ApiError(404, 'BUNKAI_NOT_FOUND', 'Бункай не найден');
  return bunkai;
}

async function createBunkai(data, authorId) {
  const { tagIds, ...rest } = data;
  const bunkai = await Bunkai.create({
    ...rest,
    createdBy: authorId,
    status: BUNKAI_STATUS.PENDING, // новый бункай всегда уходит на модерацию
  });
  if (tagIds && tagIds.length) await bunkai.setTags(tagIds);
  return getBunkaiById(bunkai.id);
}

async function updateBunkai(id, data, user) {
  const bunkai = await Bunkai.findByPk(id);
  if (!bunkai) throw new ApiError(404, 'BUNKAI_NOT_FOUND', 'Бункай не найден');

  const isOwner = bunkai.createdBy === user.id;
  const isMod = ['moderator', 'admin'].includes(user.role);
  if (!isOwner && !isMod) throw new ApiError(403, 'FORBIDDEN', 'Недостаточно прав для редактирования');

  const { tagIds, ...rest } = data;
  await bunkai.update(rest);
  if (tagIds) await bunkai.setTags(tagIds);
  return getBunkaiById(bunkai.id);
}

async function deleteBunkai(id, user) {
  const bunkai = await Bunkai.findByPk(id);
  if (!bunkai) throw new ApiError(404, 'BUNKAI_NOT_FOUND', 'Бункай не найден');

  const isOwner = bunkai.createdBy === user.id;
  const isMod = ['moderator', 'admin'].includes(user.role);
  if (!isOwner && !isMod) throw new ApiError(403, 'FORBIDDEN', 'Недостаточно прав для удаления');

  await bunkai.destroy();
}

async function vote(bunkaiId, userId, value) {
  const bunkai = await Bunkai.findByPk(bunkaiId);
  if (!bunkai) throw new ApiError(404, 'BUNKAI_NOT_FOUND', 'Бункай не найден');

  const existing = await Vote.findOne({ where: { bunkaiId, userId } });
  if (existing) {
    if (existing.value === value) {
      await existing.destroy(); // повторный клик — отмена голоса
    } else {
      await existing.update({ value });
    }
  } else {
    await Vote.create({ bunkaiId, userId, value });
  }

  const sum = (await Vote.sum('value', { where: { bunkaiId } })) || 0;
  await bunkai.update({ rating: sum });
  return { rating: sum };
}

async function getRelations(bunkaiId) {
  const relations = await BunkaiRelation.findAll({
    where: { fromBunkaiId: bunkaiId },
    include: [{ model: Bunkai, as: 'toBunkai', include: [{ model: User, as: 'author', attributes: ['id', 'username'] }] }],
  });
  return relations;
}

async function createRelation(bunkaiId, { toBunkaiId, type }, authorId) {
  if (Number(bunkaiId) === Number(toBunkaiId)) {
    throw new ApiError(400, 'INVALID_RELATION', 'Бункай не может ссылаться сам на себя');
  }
  return BunkaiRelation.create({ fromBunkaiId: bunkaiId, toBunkaiId, type, createdBy: authorId });
}

module.exports = {
  listBunkai,
  getBunkaiById,
  createBunkai,
  updateBunkai,
  deleteBunkai,
  vote,
  getRelations,
  createRelation,
};
