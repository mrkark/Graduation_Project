const { callProcedure } = require('./execProc');

// Убирает Password_Hash из строки перед отдачей наружу
function toSafeUser(row) {
  if (!row) return null;
  const { Password_Hash, Role_Name, ...rest } = row;
  return rest;
}

function roleOf(row) {
  return row?.Role_Name || null;
}

async function register({ username, email, passwordHash, displayName }) {
  const rows = await callProcedure('sp_Auth_Register', {
    Username: username,
    Email: email,
    PasswordHash: passwordHash,
    DisplayName: displayName || null,
  });
  return rows[0];
}

async function getByUsername(username) {
  const rows = await callProcedure('sp_Auth_GetByUsername', { Username: username });
  return rows[0] || null;
}

async function getById(userId) {
  const rows = await callProcedure('sp_Auth_GetById', { UserId: userId });
  return rows[0] || null;
}

async function updateProfile(userId, { displayName, bio, avatarUrl }) {
  const rows = await callProcedure('sp_Auth_UpdateProfile', {
    UserId: userId,
    DisplayName: displayName ?? null,
    Bio: bio ?? null,
    AvatarUrl: avatarUrl ?? null,
    SetDisplayName: displayName !== undefined,
    SetBio: bio !== undefined,
    SetAvatarUrl: avatarUrl !== undefined,
  });
  return rows[0];
}

async function deleteAccount(userId) {
  await callProcedure('sp_Auth_DeleteAccount', { UserId: userId });
}

module.exports = { register, getByUsername, getById, updateProfile, deleteAccount, toSafeUser, roleOf };
