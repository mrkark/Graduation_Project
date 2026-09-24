# API — Bunkai Explorer

Базовый URL: `http://localhost:5000/api`. Формат ответа единый:

```json
{ "success": true, "data": { ... }, "meta": { "total": 0, "page": 1, "pageSize": 20 } }
{ "success": false, "error": { "message": "…", "code": "…" } }
```

Аутентификация — access-токен в заголовке `Authorization: Bearer <token>` + httpOnly refresh-cookie для `/auth/refresh`.

## Auth
| Метод | Путь | Доступ |
|---|---|---|
| POST | `/auth/register` | guest |
| POST | `/auth/login` | guest |
| POST | `/auth/refresh` | любой (по refresh-cookie) |
| POST | `/auth/logout` | user/admin |
| GET | `/auth/me` | user/admin |
| PUT | `/auth/me` | user/admin |
| DELETE | `/auth/delete-account` | user/admin |

## Kata / Bunkai
| Метод | Путь | Доступ |
|---|---|---|
| GET | `/kata`, `/bunkai` | user/admin |
| GET | `/kata/:id`, `/bunkai/:id` | user/admin (владелец видит свой pending/rejected) |
| POST | `/kata`, `/bunkai` | user/admin (создаётся со статусом `pending`) |
| PUT | `/kata/:id`, `/bunkai/:id` | автор или admin |
| DELETE | `/kata/:id`, `/bunkai/:id` | автор или admin |
| POST | `/kata/:id/approve`, `/reject` (аналогично для bunkai) | admin |

## Comments
| Метод | Путь | Доступ |
|---|---|---|
| GET | `/comments?kataId=` или `?bunkaiId=` | user/admin |
| POST | `/comments` | user/admin |
| DELETE | `/comments/:id` | автор или admin |

## Friends
| Метод | Путь |
|---|---|
| GET | `/users/search?q=` |
| GET | `/friends` |
| DELETE | `/friends/:friendUserId` |
| GET | `/friends/requests?direction=incoming\|outgoing` |
| POST | `/friends/requests` `{ receiverId }` |
| POST | `/friends/requests/:id/accept` |
| POST | `/friends/requests/:id/reject` |

## Chat (REST — история; realtime см. ниже)
| Метод | Путь |
|---|---|
| GET | `/chat/rooms` |
| GET | `/chat/rooms/general` |
| POST | `/chat/rooms/private` `{ friendUserId }` |
| GET | `/chat/rooms/:id/messages` |
| DELETE | `/chat/messages/:id` |

### Socket.IO события
Хэндшейк: `auth: { token: <accessToken> }`.

- `room:join(roomId, cb)` / `room:leave(roomId)`
- `message:send({ roomId, text }, cb)` → broadcast `message:new`
- `message:delete(messageId, cb)` → broadcast `message:deleted`
- `typing({ roomId, isTyping })` → broadcast `typing`

## Admin (требуют роль `admin`)
| Метод | Путь |
|---|---|
| GET | `/users`, `/users/:id` |
| POST | `/users/:id/block`, `/unblock` |
| PATCH | `/users/:id/role` `{ roleName }` |
| DELETE | `/users/:id` |
| GET | `/admin/logs`, `/admin/backups`, `/admin/stats` |
| POST | `/admin/backups` |
