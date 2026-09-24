const { callProcedure } = require('./execProc');

function mapCommentRow(row) {
  if (!row) return null;
  return {
    Comment_ID: row.Comment_ID,
    User_ID: row.User_ID,
    Kata_ID: row.Kata_ID,
    Bunkai_ID: row.Bunkai_ID,
    Text: row.Text,
    Created_At: row.Created_At,
    Updated_At: row.Updated_At,
    Author: {
      User_ID: row.User_ID,
      Username: row.Author_Username,
      Display_Name: row.Author_Display_Name,
      Avatar_URL: row.Author_Avatar_URL,
    },
  };
}

async function list({ kataId, bunkaiId }) {
  const rows = await callProcedure('sp_Comment_List', { KataId: kataId || null, BunkaiId: bunkaiId || null });
  return rows.map(mapCommentRow);
}

async function create({ userId, kataId, bunkaiId, text }) {
  const rows = await callProcedure('sp_Comment_Create', {
    UserId: userId,
    KataId: kataId ?? null,
    BunkaiId: bunkaiId ?? null,
    Text: text,
  });
  return mapCommentRow(rows[0]);
}

async function remove(commentId, { userId, userRole }) {
  const rows = await callProcedure('sp_Comment_Delete', { CommentId: commentId, UserId: userId, UserRole: userRole });
  return rows[0]?.Action_Name;
}

module.exports = { list, create, remove };
