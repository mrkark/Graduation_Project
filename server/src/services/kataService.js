const { Kata, Sequence, Movement, Bunkai } = require('../models');
const { ApiError } = require('../middlewares/error');
const { parseVideoId, getThumbnail } = require('../utils/youtube');
const { BUNKAI_STATUS } = require('../config/constants');
const { Op } = require('sequelize');

async function listKata({ style, kyuLevel, search }) {
  const where = {};
  if (style) where.style = style;
  if (kyuLevel) where.kyuLevel = kyuLevel;
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { nameJp: { [Op.like]: `%${search}%` } },
    ];
  }
  return Kata.findAll({ where, order: [['name', 'ASC']] });
}

async function getKataTree(id) {
  const kata = await Kata.findByPk(id, {
    include: [
      {
        model: Sequence,
        as: 'sequences',
        include: [
          {
            model: Movement,
            as: 'movements',
            include: [
              {
                model: Bunkai,
                as: 'bunkaiList',
                where: { status: BUNKAI_STATUS.APPROVED },
                required: false,
              },
            ],
          },
        ],
      },
    ],
    order: [
      [{ model: Sequence, as: 'sequences' }, 'order', 'ASC'],
      [{ model: Sequence, as: 'sequences' }, { model: Movement, as: 'movements' }, 'order', 'ASC'],
    ],
  });
  if (!kata) throw new ApiError(404, 'KATA_NOT_FOUND', 'Ката не найдено');
  return kata;
}

async function createKata(data, authorId) {
  const videoId = parseVideoId(data.youtubeUrl);
  return Kata.create({
    ...data,
    createdBy: authorId,
    thumbnailUrl: data.thumbnailUrl || (videoId ? getThumbnail(videoId) : null),
  });
}

async function updateKata(id, data) {
  const kata = await Kata.findByPk(id);
  if (!kata) throw new ApiError(404, 'KATA_NOT_FOUND', 'Ката не найдено');

  if (data.youtubeUrl) {
    const videoId = parseVideoId(data.youtubeUrl);
    if (videoId) data.thumbnailUrl = getThumbnail(videoId);
  }

  await kata.update(data);
  return kata;
}

async function deleteKata(id) {
  const kata = await Kata.findByPk(id);
  if (!kata) throw new ApiError(404, 'KATA_NOT_FOUND', 'Ката не найдено');
  await kata.destroy();
}

module.exports = { listKata, getKataTree, createKata, updateKata, deleteKata };
