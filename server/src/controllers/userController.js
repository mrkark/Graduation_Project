const { User, Bunkai } = require('../models');
const { ApiError } = require('../middlewares/error');

async function getUserProfile(req, res, next) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'Пользователь не найден');
    res.json({ success: true, data: user.toSafeJSON(), error: null });
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const { username, avatar } = req.body;
    await req.user.update({
      ...(username ? { username } : {}),
      ...(avatar ? { avatar } : {}),
    });
    res.json({ success: true, data: req.user.toSafeJSON(), error: null });
  } catch (err) {
    next(err);
  }
}

async function myBunkai(req, res, next) {
  try {
    const items = await Bunkai.findAll({ where: { createdBy: req.user.id }, order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: items, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { getUserProfile, updateMe, myBunkai };
