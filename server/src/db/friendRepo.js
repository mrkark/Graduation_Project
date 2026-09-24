const { callProcedure } = require('./execProc');

function mapPublicUser(row) {
  if (!row) return null;
  return {
    User_ID: row.User_ID,
    Username: row.Username,
    Display_Name: row.Display_Name,
    Avatar_URL: row.Avatar_URL,
    Bio: row.Bio,
  };
}

function mapRequestRow(row) {
  return {
    Request_ID: row.Request_ID,
    Status: row.Status,
    Created_At: row.Created_At,
    Sender: {
      User_ID: row.Sender_User_ID,
      Username: row.Sender_Username,
      Display_Name: row.Sender_Display_Name,
      Avatar_URL: row.Sender_Avatar_URL,
    },
    Receiver: {
      User_ID: row.Receiver_User_ID,
      Username: row.Receiver_Username,
      Display_Name: row.Receiver_Display_Name,
      Avatar_URL: row.Receiver_Avatar_URL,
    },
  };
}

async function searchUsers(query, excludeUserId) {
  const rows = await callProcedure('sp_Friend_SearchUsers', { Query: query || '', ExcludeUserId: excludeUserId });
  return rows.map(mapPublicUser);
}

async function sendRequest(senderId, receiverId) {
  const rows = await callProcedure('sp_Friend_SendRequest', { SenderId: senderId, ReceiverId: receiverId });
  return rows[0];
}

async function acceptRequest(requestId, userId) {
  const rows = await callProcedure('sp_Friend_AcceptRequest', { RequestId: requestId, UserId: userId });
  return rows[0];
}

async function rejectRequest(requestId, userId) {
  const rows = await callProcedure('sp_Friend_RejectRequest', { RequestId: requestId, UserId: userId });
  return rows[0];
}

async function listRequests(userId, direction) {
  const rows = await callProcedure('sp_Friend_ListRequests', { UserId: userId, Direction: direction || 'incoming' });
  return rows.map(mapRequestRow);
}

async function listFriends(userId) {
  const rows = await callProcedure('sp_Friend_ListFriends', { UserId: userId });
  return rows.map(mapPublicUser);
}

async function removeFriend(userId, friendUserId) {
  await callProcedure('sp_Friend_Remove', { UserId: userId, FriendUserId: friendUserId });
}

module.exports = { searchUsers, sendRequest, acceptRequest, rejectRequest, listRequests, listFriends, removeFriend };
