const { execProc } = require('./execProc');

async function toggleFavorite(userId, itemType, itemId) {
  const result = await execProc('sp_Favorite_Toggle', {
    UserId: userId,
    ItemType: itemType,
    ItemId: itemId,
  });
  return {
    isFavorite: Boolean(result[0]?.Is_Favorite),
    itemType: result[0]?.Item_Type,
    itemId: result[0]?.Item_ID,
  };
}

async function listFavorites(userId) {
  const result = await execProc('sp_Favorite_List', {
    UserId: userId,
  });
  const items = result || [];
  const kata = [];
  const bunkai = [];

  for (const row of items) {
    if (row.Item_Type === 'kata') kata.push(row.Item_ID);
    if (row.Item_Type === 'bunkai') bunkai.push(row.Item_ID);
  }

  return { kata, bunkai, all: items };
}

async function getUsersFavoritedKata(kataId) {
  const result = await execProc('sp_Favorite_GetUsersForKata', {
    KataId: kataId,
  });
  return (result || []).map((r) => r.User_ID);
}

module.exports = {
  toggleFavorite,
  listFavorites,
  getUsersFavoritedKata,
};
