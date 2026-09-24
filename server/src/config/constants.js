// Единое место для "магических" констант проекта

const ROLES = {
  GUEST: 'guest',
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
};

const BUNKAI_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const RELATION_TYPES = {
  SIMILAR: 'similar',
  VARIATION: 'variation',
  COUNTER: 'counter',
  FOLLOW_UP: 'follow_up',
};

const VOTE_VALUES = [1, -1];

const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

module.exports = {
  ROLES,
  BUNKAI_STATUS,
  RELATION_TYPES,
  VOTE_VALUES,
  ALLOWED_IMAGE_MIME,
};
