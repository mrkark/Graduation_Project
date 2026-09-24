const { callProcedure } = require('./execProc');

function mapRoomRow(row) {
  return {
    ChatRoom_ID: row.ChatRoom_ID,
    Room_Type: row.Room_Type,
    Created_At: row.Created_At,
    Friend: row.Friend_User_ID
      ? {
          User_ID: row.Friend_User_ID,
          Username: row.Friend_Username,
          Display_Name: row.Friend_Display_Name,
          Avatar_URL: row.Friend_Avatar_URL,
        }
      : null,
  };
}

function mapMessageRow(row) {
  return {
    Message_ID: row.Message_ID,
    ChatRoom_ID: row.ChatRoom_ID,
    User_ID: row.User_ID,
    Message_Text: row.Message_Text,
    Created_At: row.Created_At,
    Edited_At: row.Edited_At,
    Author: {
      User_ID: row.User_ID,
      Username: row.Author_Username,
      Display_Name: row.Author_Display_Name,
      Avatar_URL: row.Author_Avatar_URL,
    },
  };
}

async function getOrCreateGeneralRoom() {
  const rows = await callProcedure('sp_Chat_GetOrCreateGeneralRoom', {});
  return mapRoomRow(rows[0]);
}

async function listRoomsForUser(userId) {
  const rows = await callProcedure('sp_Chat_ListRoomsForUser', { UserId: userId });
  return rows.map(mapRoomRow);
}

async function createPrivateRoom(userId, friendUserId) {
  const rows = await callProcedure('sp_Chat_CreatePrivateRoom', { UserId: userId, FriendUserId: friendUserId });
  return mapRoomRow(rows[0]);
}

async function listMessages(roomId, userId, offset, limit) {
  const rows = await callProcedure('sp_Chat_ListMessages', { RoomId: roomId, UserId: userId, Offset: offset, Limit: limit });
  const total = rows[0]?.Total_Count || 0;
  return { items: rows.map(mapMessageRow), total };
}

async function createMessage(roomId, userId, text) {
  const rows = await callProcedure('sp_Chat_CreateMessage', { RoomId: roomId, UserId: userId, Text: text });
  return mapMessageRow(rows[0]);
}

async function deleteMessage(messageId, userId, userRole) {
  const rows = await callProcedure('sp_Chat_DeleteMessage', { MessageId: messageId, UserId: userId, UserRole: userRole });
  return rows[0]; // { ChatRoom_ID, Message_ID }
}

module.exports = { getOrCreateGeneralRoom, listRoomsForUser, createPrivateRoom, listMessages, createMessage, deleteMessage };
