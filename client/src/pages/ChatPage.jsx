import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useChatSocket } from '../hooks/useChatSocket';
import { getGeneralRoom, listRooms, listMessages, createPrivateRoom } from '../api/chat';
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
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);

  // Первичная загрузка комнат + разрешение friendId из query-параметров
  useEffect(() => {
    async function init() {
      const general = await getGeneralRoom();
      let allRooms = await listRooms();
      if (!allRooms.find((r) => r.ChatRoom_ID === general.ChatRoom_ID)) {
        allRooms = [general, ...allRooms];
      }

      const friendId = searchParams.get('friendId');
      if (friendId) {
        const room = await createPrivateRoom(Number(friendId));
        if (!allRooms.find((r) => r.ChatRoom_ID === room.ChatRoom_ID)) allRooms = [...allRooms, room];
        setRooms(allRooms);
        setActiveRoomId(room.ChatRoom_ID);
        return;
      }

      setRooms(allRooms);
      setActiveRoomId(general.ChatRoom_ID);
    }
    init();
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function roomLabel(room) {
    if (!room) return '';
    if (room.Room_Type === 'general') return '⛩️ Общий зал Додзё';
    if (room.Friend?.Display_Name || room.Friend?.Username) {
      return `🥋 ${room.Friend.Display_Name || room.Friend.Username}`;
    }
    return 'Личный диалог';
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

  const activeRoom = useMemo(() => rooms.find((r) => r.ChatRoom_ID === activeRoomId), [rooms, activeRoomId]);

  return (
    <div className="container chat-page-container">
      <div className="page-header">
        <div>
          <span className="chat-kicker">道場チャット · СВЯЗЬ ДОДЗЁ</span>
          <h1>Связь Додзё (道場チャット)</h1>
          <p className="page-subtitle">Общий зал бесед мастеров и личные переписки с соратниками</p>
        </div>
      </div>

      <div className="chat-page">
        <div className="chat-rooms">
          <div className="chat-rooms__heading">
            <span>⛩️</span>
            <span>Залы и беседы</span>
          </div>
          {rooms.map((room) => (
            <button
              key={room.ChatRoom_ID}
              className={`chat-rooms__item ${room.ChatRoom_ID === activeRoomId ? 'active' : ''}`}
              onClick={() => setActiveRoomId(room.ChatRoom_ID)}
            >
              {roomLabel(room)}
            </button>
          ))}
        </div>

        <div className="chat-window">
          <div className="chat-window__status">
            <span className={`chat-window__status-dot ${connected ? 'online' : ''}`} />
            <span>{connected ? 'Соединение с Додзё установлено' : 'Переподключение к Додзё…'}</span>
            {activeRoom && (
              <span className="chat-window__status-room-title">{roomLabel(activeRoom)}</span>
            )}
          </div>

          <div className="chat-window__messages">
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
            <div ref={messagesEndRef} />
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
