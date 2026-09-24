const { callProcedure } = require('./execProc');

function mapKataRow(row) {
  if (!row) return null;
  return {
    Kata_ID: row.Kata_ID,
    Author_ID: row.Author_ID,
    Title: row.Title,
    Description: row.Description,
    Difficulty: row.Difficulty,
    Style: row.Style,
    Video_URL: row.Video_URL,
    Thumbnail_URL: row.Thumbnail_URL,
    Status: row.Status,
    Created_At: row.Created_At,
    Updated_At: row.Updated_At,
    Author: {
      User_ID: row.Author_ID,
      Username: row.Author_Username,
      Display_Name: row.Author_Display_Name,
      Avatar_URL: row.Author_Avatar_URL,
    },
  };
}

function mapStepRow(row) {
  return {
    Step_ID: row.Step_ID,
    Kata_ID: row.Kata_ID,
    Step_Number: row.Step_Number,
    Title: row.Title,
    Description: row.Description,
    Technique: row.Technique,
    Direction: row.Direction,
    Duration: row.Duration,
    Image_URL: row.Image_URL,
    Video_URL: row.Video_URL,
  };
}

async function list({ userId, userRole, search, difficulty, style, status, sort, offset, limit }) {
  const rows = await callProcedure('sp_Kata_List', {
    UserId: userId,
    UserRole: userRole,
    Search: search || null,
    Difficulty: difficulty || null,
    Style: style || null,
    Status: status || null,
    Sort: sort || 'newest',
    Offset: offset,
    Limit: limit,
  });
  const total = rows[0]?.Total_Count || 0;
  return { items: rows.map(mapKataRow), total };
}

async function getById(kataId, { userId, userRole }) {
  const rows = await callProcedure('sp_Kata_GetById', { KataId: kataId, UserId: userId, UserRole: userRole });
  const kata = mapKataRow(rows[0]);
  if (!kata) return null;

  const [steps, related] = await Promise.all([
    callProcedure('sp_KataStep_ListByKata', { KataId: kataId }),
    callProcedure('sp_Bunkai_ListByKataApproved', { KataId: kataId }),
  ]);

  kata.Steps = steps.map(mapStepRow);
  kata.RelatedBunkai = related.map((r) => ({ Bunkai_ID: r.Bunkai_ID, Title: r.Title }));
  return kata;
}

async function create({ authorId, title, description, difficulty, style, videoUrl, thumbnailUrl, steps }) {
  const rows = await callProcedure('sp_Kata_Create', {
    AuthorId: authorId,
    Title: title,
    Description: description || null,
    Difficulty: difficulty || 'beginner',
    Style: style || null,
    VideoUrl: videoUrl || null,
    ThumbnailUrl: thumbnailUrl || null,
    StepsJson: JSON.stringify(steps || []),
  });
  return getById(rows[0].Kata_ID, { userId: authorId, userRole: 'user' });
}

async function update(kataId, { userId, userRole }, patch) {
  const params = {
    KataId: kataId,
    UserId: userId,
    UserRole: userRole,
    Title: patch.title ?? null,
    Description: patch.description ?? null,
    Difficulty: patch.difficulty ?? null,
    Style: patch.style ?? null,
    VideoUrl: patch.videoUrl ?? null,
    ThumbnailUrl: patch.thumbnailUrl ?? null,
    StepsJson: Array.isArray(patch.steps) ? JSON.stringify(patch.steps) : null,
    SetTitle: patch.title !== undefined,
    SetDescription: patch.description !== undefined,
    SetDifficulty: patch.difficulty !== undefined,
    SetStyle: patch.style !== undefined,
    SetVideoUrl: patch.videoUrl !== undefined,
    SetThumbnailUrl: patch.thumbnailUrl !== undefined,
  };
  const rows = await callProcedure('sp_Kata_Update', params);
  return getById(rows[0].Kata_ID, { userId, userRole });
}

async function remove(kataId, { userId, userRole }) {
  await callProcedure('sp_Kata_Delete', { KataId: kataId, UserId: userId, UserRole: userRole });
}

async function setStatus(kataId, status, { userId, userRole }) {
  const rows = await callProcedure('sp_Kata_SetStatus', { KataId: kataId, Status: status });
  return getById(rows[0].Kata_ID, { userId, userRole });
}

module.exports = { list, getById, create, update, remove, setStatus };
