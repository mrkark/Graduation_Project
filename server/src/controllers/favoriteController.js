const favoriteRepo = require('../db/favoriteRepo');
const { ok, fail } = require('../utils/apiResponse');

async function list(req, res, next) {
  try {
    const favorites = await favoriteRepo.listFavorites(req.user.User_ID);
    return ok(res, favorites);
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message, err.code);
    return next(err);
  }
}

async function toggle(req, res, next) {
  try {
    const { itemType, itemId } = req.body;
    if (!itemType || !itemId) {
      return fail(res, 400, 'Необходимо указать itemType и itemId', 'VALIDATION_ERROR');
    }
    const result = await favoriteRepo.toggleFavorite(req.user.User_ID, String(itemType).toLowerCase(), Number(itemId));
    return ok(res, result);
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message, err.code);
    return next(err);
  }
}

module.exports = {
  list,
  toggle,
};
