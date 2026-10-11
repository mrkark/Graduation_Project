const { callProcedure, callProcedureWithRecordsets } = require('./execProc');

function mapBunkaiRow(row) {
  if (!row) return null;
  return {
    Bunkai_ID: row.Bunkai_ID,
    Author_ID: row.Author_ID,
    Kata_ID: row.Kata_ID,
    Title: row.Title,
    Description: row.Description,
    Application: row.Application,
    Difficulty: row.Difficulty,
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
    Kata: {
      Kata_ID: row.Kata_ID,
      Title: row.Kata_Title,
      Status: row.Kata_Status,
    },
  };
}

async function list({ userId, userRole, search, kataId, difficulty, status, sort, offset, limit }) {
  const rows = await callProcedure('sp_Bunkai_List', {
    UserId: userId,
    UserRole: userRole,
    Search: search || null,
    KataId: kataId || null,
    Difficulty: difficulty || null,
    Status: status || null,
    Sort: sort || 'newest',
    Offset: typeof offset === 'number' ? offset : 0,
    Limit: typeof limit === 'number' ? limit : 20,
  });
  const total = rows[0]?.Total_Count || 0;
  return { items: rows.map(mapBunkaiRow), total };
}

async function getById(bunkaiId, { userId, userRole } = {}) {
  const rows = await callProcedure('sp_Bunkai_GetById', { BunkaiId: bunkaiId, UserId: userId, UserRole: userRole });
  return mapBunkaiRow(rows[0]);
}

async function create({ authorId, kataId, title, description, application, difficulty, videoUrl, thumbnailUrl }) {
  const rows = await callProcedure('sp_Bunkai_Create', {
    AuthorId: authorId,
    KataId: kataId,
    Title: title,
    Description: description || null,
    Application: application || null,
    Difficulty: difficulty || 'beginner',
    VideoUrl: videoUrl || null,
    ThumbnailUrl: thumbnailUrl || null,
  });
  return getById(rows[0].Bunkai_ID, { userId: authorId, userRole: 'user' });
}

async function update(bunkaiId, { userId, userRole }, patch) {
  const rows = await callProcedure('sp_Bunkai_Update', {
    BunkaiId: bunkaiId,
    UserId: userId,
    UserRole: userRole,
    Title: patch.title ?? null,
    Description: patch.description ?? null,
    Application: patch.application ?? null,
    Difficulty: patch.difficulty ?? null,
    VideoUrl: patch.videoUrl ?? null,
    ThumbnailUrl: patch.thumbnailUrl ?? null,
    SetTitle: patch.title !== undefined,
    SetDescription: patch.description !== undefined,
    SetApplication: patch.application !== undefined,
    SetDifficulty: patch.difficulty !== undefined,
    SetVideoUrl: patch.videoUrl !== undefined,
    SetThumbnailUrl: patch.thumbnailUrl !== undefined,
  });
  return getById(rows[0].Bunkai_ID, { userId, userRole });
}

async function remove(bunkaiId, { userId, userRole }) {
  await callProcedure('sp_Bunkai_Delete', { BunkaiId: bunkaiId, UserId: userId, UserRole: userRole });
}

async function setStatus(bunkaiId, status, { userId, userRole }) {
  const rows = await callProcedure('sp_Bunkai_SetStatus', { BunkaiId: bunkaiId, Status: status });
  return getById(rows[0].Bunkai_ID, { userId, userRole });
}

async function getStepsWithParticipants(bunkaiId) {
  const [stepsRows, participantsRows] = await callProcedureWithRecordsets('sp_Bunkai_GetStepsWithParticipants', {
    BunkaiId: bunkaiId,
  });

  const participantsByStep = new Map();
  (participantsRows || []).forEach((p) => {
    if (!participantsByStep.has(p.Step_ID)) {
      participantsByStep.set(p.Step_ID, []);
    }
    participantsByStep.get(p.Step_ID).push({
      bspId: p.BSP_ID,
      stepId: p.Step_ID,
      role: p.Role,
      clipId: p.Clip_ID,
      clipName: p.Clip_Name,
      clipTitle: p.Clip_Title,
      clipDuration: p.Clip_Duration,
      interactionType: p.Interaction_Type,
      optimalDistance: p.Optimal_Distance,
      initialStance: p.Initial_Stance,
      offsetX: p.Offset_X,
      offsetZ: p.Offset_Z,
      rotationY: p.Rotation_Y,
      delaySeconds: p.Delay_Seconds,
    });
  });

  return (stepsRows || []).map((s) => ({
    stepId: s.Step_ID,
    bunkaiId: s.Bunkai_ID,
    stepNumber: s.Step_Number,
    title: s.Title,
    description: s.Description,
    duration: s.Duration,
    participantCount: s.Participant_Count,
    targetDistance: s.Target_Distance,
    targetAngle: s.Target_Angle,
    participants: participantsByStep.get(s.Step_ID) || [],
  }));
}

async function saveSteps(bunkaiId, { userId, userRole }, steps) {
  await callProcedure('sp_Bunkai_SaveSteps', {
    BunkaiId: bunkaiId,
    UserId: userId,
    UserRole: userRole,
    StepsJson: JSON.stringify(steps || []),
  });
  return getStepsWithParticipants(bunkaiId);
}

module.exports = { list, getById, create, update, remove, setStatus, getStepsWithParticipants, saveSteps };
