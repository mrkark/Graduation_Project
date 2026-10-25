import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useChatSocket } from '../hooks/useChatSocket';
import { getGeneralRoom, listRooms, listMessages, createPrivateRoom, getOrCreateDojoRoom } from '../api/chat';
import { listFriends } from '../api/friends';
import { listMyDojos } from '../api/dojos';
import { useAuthStore } from '../store/authStore';
import './ChatPage.css';

export default function ChatPage() {
  const { user, role } = useAuthStore();
  const { socket, connected } = useChatSocket();
  const [searchParams] = useSearchParams();

  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typingUser, setTypingUser] = useState(null);
  const [error, setError] = useState(null);
  const [friendsList, setFriendsList] = useState([]);
  const [myDojos, setMyDojos] = useState([]);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatTab, setNewChatTab] = useState('dojo'); // 'dojo' | 'friend'

  // Задача 40: закрепление чатов в локальном хранилище
  const [pinnedRoomIds, setPinnedRoomIds] = useState(() => {
    try {
      const stored = localStorage.getItem(`pinned_rooms_${user?.User_ID || 'current'}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const messagesBoxRef = useRef(null);
  const typingTimeout = useRef(null);

  function togglePinRoom(roomId, e) {
    e.stopPropagation();
    setPinnedRoomIds((prev) => {
      const isPinned = prev.includes(roomId);
      const next = isPinned ? prev.filter((id) => id !== roomId) : [roomId, ...prev];
      try {
        localStorage.setItem(`pinned_rooms_${user?.User_ID || 'current'}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  // Первичная загрузка комнат + разрешение dojoId / friendId из query-параметров
  useEffect(() => {
    async function init() {
      try {
        const general = await getGeneralRoom();
        let allRooms = await listRooms();
        if (!allRooms.find((r) => r.ChatRoom_ID === general.ChatRoom_ID)) {
          allRooms = [general, ...allRooms];
        }

        const dojoId = searchParams.get('dojoId');
        if (dojoId) {
          try {
            const dojoRoom = await getOrCreateDojoRoom(Number(dojoId));
            if (!allRooms.find((r) => r.ChatRoom_ID === dojoRoom.ChatRoom_ID)) {
              allRooms = [dojoRoom, ...allRooms];
            }
            setRooms(allRooms);
            setActiveRoomId(dojoRoom.ChatRoom_ID);
            return;
          } catch (e) {
            console.error('Failed to open Dojo room:', e);
          }
        }

        const friendId = searchParams.get('friendId');
        if (friendId) {
          try {
            const room = await createPrivateRoom(Number(friendId));
            if (!allRooms.find((r) => r.ChatRoom_ID === room.ChatRoom_ID)) {
              allRooms = [room, ...allRooms];
            }
            setRooms(allRooms);
            setActiveRoomId(room.ChatRoom_ID);
            return;
          } catch (e) {
            console.error('Failed to open Friend room:', e);
          }
        }

        setRooms(allRooms);
        setActiveRoomId(general.ChatRoom_ID);
      } catch (err) {
        console.error('Failed to init chat rooms:', err);
      }
    }
    init();
    listFriends().then((f) => setFriendsList(f || [])).catch(() => {});
    listMyDojos().then((d) => setMyDojos(d || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Подписка на комнату при смене + загрузка истории
  useEffect(() => {
    if (!activeRoomId || !socket.current) return;
    const s = socket.current;

    listMessages(activeRoomId).then(setMessages);

    s.emit('room:join', activeRoomId, (res) => {
      if (!res?.ok) setError(res?.error || 'Не удалось подключиться к комнате');
    });

    function onNewMessage(msg) {
      if (msg.ChatRoom_ID !== activeRoomId) return;
      setMessages((m) => [...m, msg]);
    }
    function onDeleted({ messageId }) {
      setMessages((m) => m.filter((msg) => msg.Message_ID !== messageId));
    }
    function onTyping({ userId, username, isTyping }) {
      if (userId === user?.User_ID) return;
      setTypingUser(isTyping ? username : null);
      if (isTyping) {
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setTypingUser(null), 3000);
      }
    }

    s.on('message:new', onNewMessage);
    s.on('message:deleted', onDeleted);
    s.on('typing', onTyping);

    return () => {
      s.emit('room:leave', activeRoomId);
      s.off('message:new', onNewMessage);
      s.off('message:deleted', onDeleted);
      s.off('typing', onTyping);
    };
  }, [activeRoomId, socket, user]);

  // Задача 38: прокрутка только внутри блока сообщений без пролистывания экрана вниз
  useEffect(() => {
    if (messagesBoxRef.current) {
      messagesBoxRef.current.scrollTop = messagesBoxRef.current.scrollHeight;
    }
  }, [messages]);

  function roomLabel(room) {
    if (!room) return '';
    if (room.Room_Type === 'general') return '⛩️ Глобальное Додзё';
    if (room.Room_Type === 'dojo') {
      return `🥋 Додзё: ${room.Dojo?.Name || room.Name || 'Школа'}`;
    }
    if (room.Friend?.Display_Name || room.Friend?.Username) {
      return `👤 ${room.Friend.Display_Name || room.Friend.Username}`;
    }
    return 'Личный диалог';
  }

  function renderRoomBadge(room) {
    if (!room) return null;
    if (room.Room_Type === 'general') {
      return <span className="chat-room-badge chat-room-badge--general">Общий</span>;
    }
    if (room.Room_Type === 'dojo') {
      return <span className="chat-room-badge chat-room-badge--dojo">Додзё</span>;
    }
    return <span className="chat-room-badge chat-room-badge--private">Соратник</span>;
  }

  async function handleStartFriendChat(friendId) {
    try {
      const room = await createPrivateRoom(Number(friendId));
      if (!rooms.find((r) => r.ChatRoom_ID === room.ChatRoom_ID)) {
        setRooms((prev) => [room, ...prev]);
      }
      setActiveRoomId(room.ChatRoom_ID);
      setShowNewChatModal(false);
    } catch (err) {
      setError('Не удалось начать чат с выбранным соратником');
    }
  }

  async function handleStartDojoChat(dojoId) {
    try {
      const room = await getOrCreateDojoRoom(Number(dojoId));
      if (!rooms.find((r) => r.ChatRoom_ID === room.ChatRoom_ID)) {
        setRooms((prev) => [room, ...prev]);
      }
      setActiveRoomId(room.ChatRoom_ID);
      setShowNewChatModal(false);
    } catch (err) {
      setError('Не удалось открыть чат выбранного Додзё');
    }
  }

  function onSend(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !socket.current) return;
    socket.current.emit('message:send', { roomId: activeRoomId, text: trimmed }, (res) => {
      if (!res?.ok) setError(res?.error || 'Не удалось отправить сообщение');
    });
    setText('');
    socket.current.emit('typing', { roomId: activeRoomId, isTyping: false });
  }

  function onDelete(messageId) {
    if (!confirm('Удалить сообщение?')) return;
    socket.current?.emit('message:delete', messageId);
  }

  function onTypingInput(e) {
    setText(e.target.value);
    socket.current?.emit('typing', { roomId: activeRoomId, isTyping: true });
  }

  // Задача 40: закрепленные диалоги первыми в списке
  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const aPinned = pinnedRoomIds.includes(a.ChatRoom_ID);
      const bPinned = pinnedRoomIds.includes(b.ChatRoom_ID);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [rooms, pinnedRoomIds]);

  const activeRoom = useMemo(() => rooms.find((r) => r.ChatRoom_ID === activeRoomId), [rooms, activeRoomId]);

  return (
    <div className="container chat-page-container">
      <div className="page-header">
        <div>
          <span className="chat-kicker">道場チャット · СВЯЗЬ ДОДЗЁ</span>
          <h1>Связь Додзё</h1>
          <p className="page-subtitle">Общий зал бесед мастеров и личные переписки с соратниками</p>
        </div>
      </div>

      <div className="chat-page">
        <div className="chat-rooms">
          <div className="chat-rooms__heading" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span>⛩️</span>
              <span>Беседы</span>
            </div>
            {/* Задача 43: Быстрое создание чата */}
            <button
              type="button"
              className="btn btn-subtle"
              style={{ padding: '2px 8px', fontSize: '0.74rem' }}
              onClick={() => setShowNewChatModal(!showNewChatModal)}
              title="Создать или открыть чат"
            >
              + Чат
            </button>
          </div>

          {/* Задача 4 & 43: Быстрый выбор соратника или Додзё для нового чата */}
          {showNewChatModal && (
            <div className="chat-new-modal">
              <div className="chat-new-modal__header">
                <span>Создать / открыть чат:</span>
                <button
                  type="button"
                  className="chat-new-modal__close"
                  onClick={() => setShowNewChatModal(false)}
                >
                  ✕
                </button>
              </div>

              <div className="chat-modal-tabs">
                <button
                  type="button"
                  className={`chat-modal-tab ${newChatTab === 'dojo' ? 'active' : ''}`}
                  onClick={() => setNewChatTab('dojo')}
                >
                  🥋 Чат Додзё
                </button>
                <button
                  type="button"
                  className={`chat-modal-tab ${newChatTab === 'friend' ? 'active' : ''}`}
                  onClick={() => setNewChatTab('friend')}
                >
                  👤 С соратником
                </button>
              </div>

              {newChatTab === 'dojo' ? (
                myDojos.length === 0 ? (
                  <div className="chat-new-modal__empty">
                    У вас пока нет созданных Додзё. Основать собственную школу можно в разделе «Додзё».
                  </div>
                ) : (
                  <div className="chat-new-user-list">
                    {myDojos.map((d) => (
                      <button
                        key={d.Dojo_ID}
                        type="button"
                        className="chat-new-user-card"
                        onClick={() => handleStartDojoChat(d.Dojo_ID)}
                      >
                        <span
                          className="chat-new-user-avatar"
                          style={{
                            fontSize: '0.78rem',
                            background: '#241a13',
                            color: 'var(--gold)',
                            border: '1px solid var(--gold-border)',
                          }}
                        >
                          {d.Kanji || '道場'}
                        </span>
                        <div className="chat-new-user-meta">
                          <span className="chat-new-user-name">{d.Name}</span>
                          <span className="chat-new-user-handle">
                            {d.MembersCount || d.MemberCount || 1} уч. · {(d.Role || d.MyRole) === 'sensei' ? 'Сэнсэй' : 'Ученик'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : friendsList.length === 0 ? (
                <div className="chat-new-modal__empty">
                  Нет соратников. Добавьте их во вкладке «Соратники».
                </div>
              ) : (
                <div className="chat-new-user-list">
                  {friendsList.map((f) => (
                    <button
                      key={f.User_ID}
                      type="button"
                      className="chat-new-user-card"
                      onClick={() => handleStartFriendChat(f.User_ID)}
                    >
                      <span className="chat-new-user-avatar">
                        {(f.Display_Name || f.Username || 'K')[0].toUpperCase()}
                      </span>
                      <div className="chat-new-user-meta">
                        <span className="chat-new-user-name">{f.Display_Name || f.Username}</span>
                        <span className="chat-new-user-handle">@{f.Username}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {sortedRooms.map((room) => {
            const isPinned = pinnedRoomIds.includes(room.ChatRoom_ID);
            return (
              <div
                key={room.ChatRoom_ID}
                className={`chat-rooms__item ${room.ChatRoom_ID === activeRoomId ? 'active' : ''}`}
                onClick={() => setActiveRoomId(room.ChatRoom_ID)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', flex: 1, minWidth: 0, gap: '4px' }}>
                  {renderRoomBadge(room)}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {roomLabel(room)}
                  </span>
                </div>
                {/* Задача 40: кнопка закрепления */}
                <button
                  type="button"
                  onClick={(e) => togglePinRoom(room.ChatRoom_ID, e)}
                  title={isPinned ? 'Открепить' : 'Закрепить'}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    padding: '2px 4px',
                    opacity: isPinned ? 1 : 0.3,
                    transition: 'opacity 0.15s ease',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = isPinned ? '1' : '0.3'; }}
                >
                  📌
                </button>
              </div>
            );
          })}
        </div>

        <div className="chat-window">
          <div className="chat-window__status">
            <span className={`chat-window__status-dot ${connected ? 'online' : ''}`} />
            <span>{connected ? 'Соединение с Додзё установлено' : 'Переподключение к Додзё…'}</span>
            {activeRoom && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden', maxWidth: '60%' }}>
                {renderRoomBadge(activeRoom)}
                <span className="chat-window__status-room-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {roomLabel(activeRoom)}
                  {activeRoom.Room_Type === 'dojo' && activeRoom.Dojo?.MembersCount ? ` (${activeRoom.Dojo.MembersCount} уч.)` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Задача 38: скролл внутри контейнера сообщений */}
          <div className="chat-window__messages" ref={messagesBoxRef}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto', fontSize: '0.9rem' }}>
                <p style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>🍵</p>
                В этом зале пока тихо. Напишите первое приветствие соратникам.
              </div>
            ) : (
              messages.map((m) => (
                <div className={`chat-msg ${m.Author?.User_ID === user?.User_ID ? 'own' : ''}`} key={m.Message_ID}>
                  <div className="chat-msg__meta">
                    <span className="chat-msg__author">{m.Author?.Display_Name || m.Author?.Username}</span>
                    <span className="chat-msg__time">
                      {new Date(m.Created_At).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {(m.Author?.User_ID === user?.User_ID || role === 'admin') && (
                      <button className="chat-msg__delete-btn" onClick={() => onDelete(m.Message_ID)} title="Удалить">
                        ✕
                      </button>
                    )}
                  </div>
                  <p className="chat-msg__text">{m.Message_Text}</p>
                </div>
              ))
            )}
          </div>

          <div className="chat-window__typing">{typingUser ? `✍️ ${typingUser} пишет свиток…` : ''}</div>

          {error && <p className="error-text" style={{ padding: '0 1.25rem', margin: '0.4rem 0' }}>{error}</p>}

          <form className="chat-window__form" onSubmit={onSend}>
            <input
              className="chat-window__input"
              value={text}
              onChange={onTypingInput}
              maxLength={2000}
              placeholder="Написать свиток соратникам в Додзё…"
              disabled={!connected}
            />
            <button className="btn btn-primary chat-window__submit-btn" type="submit" disabled={!connected || !text.trim()}>
              Отправить
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
