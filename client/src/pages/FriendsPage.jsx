import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  searchUsers,
  listFriends,
  removeFriend,
  listFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
} from '../api/friends';
import './FriendsPage.css';

const TABS = [
  { key: 'friends', label: 'Соратники (Друзья)' },
  { key: 'incoming', label: 'Входящие заявки' },
  { key: 'outgoing', label: 'Исходящие' },
  { key: 'search', label: 'Поиск каратэка' },
];

export default function FriendsPage() {
  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    const [f, inc, out] = await Promise.all([listFriends(), listFriendRequests('incoming'), listFriendRequests('outgoing')]);
    setFriends(f);
    setIncoming(inc);
    setOutgoing(out);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (tab !== 'search' || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchUsers(query.trim()).then(setResults);
    }, 300);
    return () => clearTimeout(t);
  }, [tab, query]);

  async function onSend(userId) {
    await sendFriendRequest(userId);
    await loadAll();
  }
  async function onAccept(requestId) {
    await acceptFriendRequest(requestId);
    await loadAll();
  }
  async function onReject(requestId) {
    await rejectFriendRequest(requestId);
    await loadAll();
  }
  async function onRemove(userId) {
    if (!confirm('Удалить из друзей?')) return;
    await removeFriend(userId);
    await loadAll();
  }

  return (
    <div className="container friends-page">
      <div className="page-header">
        <div>
          <span className="friends-kicker">仲間 · БРАТСТВО ДОДЗЁ</span>
          <h1>Соратники Додзё (仲間 · Накама)</h1>
          <p className="page-subtitle">Взаимная отработка ката, обмен опытом и личные сообщения</p>
        </div>
      </div>

      <div className="friends-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`friends-tab-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span>{t.label}</span>
            {t.key === 'incoming' && incoming.length > 0 && (
              <span className="friends-tab-badge">{incoming.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="loading">Поиск свитков соратников…</p>
      ) : (
        <>
          {tab === 'friends' &&
            (friends.length === 0 ? (
              <div className="friends-empty">
                <div className="friends-empty__icon">🥋</div>
                <h3 className="friends-empty__title">Пока нет соратников</h3>
                <p className="friends-empty__desc">
                  В Додзё тренируются мастера со всего мира. Найдите единомышленников во вкладке «Поиск каратэка».
                </p>
              </div>
            ) : (
              <div className="friends-list">
                {friends.map((f) => (
                  <div className="friend-card" key={f.User_ID}>
                    <div className="friend-card__identity">
                      <div className="friend-card__avatar">
                        {(f.Display_Name || f.Username || 'K')[0].toUpperCase()}
                      </div>
                      <div className="friend-card__meta">
                        <span className="friend-card__name">{f.Display_Name || f.Username}</span>
                        <span className="friend-card__role">Ученик Додзё · @{f.Username}</span>
                      </div>
                    </div>
                    <div className="friend-card__actions">
                      <Link className="btn btn-subtle" to={`/chat?friendId=${f.User_ID}`}>
                        Личный чат →
                      </Link>
                      <button className="btn btn-danger" onClick={() => onRemove(f.User_ID)}>
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

          {tab === 'incoming' &&
            (incoming.length === 0 ? (
              <div className="friends-empty">
                <div className="friends-empty__icon">📨</div>
                <h3 className="friends-empty__title">Нет входящих заявок</h3>
                <p className="friends-empty__desc">Новые запросы в соратники от других учеников появятся здесь.</p>
              </div>
            ) : (
              <div className="friends-list">
                {incoming.map((r) => (
                  <div className="friend-card" key={r.Request_ID}>
                    <div className="friend-card__identity">
                      <div className="friend-card__avatar">
                        {(r.Sender?.Display_Name || r.Sender?.Username || 'K')[0].toUpperCase()}
                      </div>
                      <div className="friend-card__meta">
                        <span className="friend-card__name">{r.Sender?.Display_Name || r.Sender?.Username}</span>
                        <span className="friend-card__role">Желает присоединиться к совместным тренировкам</span>
                      </div>
                    </div>
                    <div className="friend-card__actions">
                      <button className="btn btn-primary" onClick={() => onAccept(r.Request_ID)}>
                        Принять
                      </button>
                      <button className="btn btn-danger" onClick={() => onReject(r.Request_ID)}>
                        Отклонить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

          {tab === 'outgoing' &&
            (outgoing.length === 0 ? (
              <div className="friends-empty">
                <div className="friends-empty__icon">🪶</div>
                <h3 className="friends-empty__title">Нет отправленных заявок</h3>
                <p className="friends-empty__desc">Вы ещё не отправляли приглашений в соратники.</p>
              </div>
            ) : (
              <div className="friends-list">
                {outgoing.map((r) => (
                  <div className="friend-card" key={r.Request_ID}>
                    <div className="friend-card__identity">
                      <div className="friend-card__avatar">
                        {(r.Receiver?.Display_Name || r.Receiver?.Username || 'K')[0].toUpperCase()}
                      </div>
                      <div className="friend-card__meta">
                        <span className="friend-card__name">{r.Receiver?.Display_Name || r.Receiver?.Username}</span>
                        <span className="friend-card__role">Ожидает вашего подтверждения</span>
                      </div>
                    </div>
                    <div className="friend-card__actions">
                      <button className="btn btn-danger" onClick={() => onReject(r.Request_ID)}>
                        Отозвать
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

          {tab === 'search' && (
            <div>
              <div className="friend-search-bar">
                <input
                  className="friend-search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Введите имя или логин ученика (минимум 2 символа)…"
                />
              </div>

              {query.trim().length >= 2 && results.length === 0 && (
                <div className="friends-empty">
                  <div className="friends-empty__icon">🔍</div>
                  <h3 className="friends-empty__title">Каратэка не найден</h3>
                  <p className="friends-empty__desc">Попробуйте ввести другой позывной или логин ученика.</p>
                </div>
              )}

              <div className="friends-list">
                {results.map((u) => (
                  <div className="friend-card" key={u.User_ID}>
                    <div className="friend-card__identity">
                      <div className="friend-card__avatar">
                        {(u.Display_Name || u.Username || 'K')[0].toUpperCase()}
                      </div>
                      <div className="friend-card__meta">
                        <span className="friend-card__name">{u.Display_Name || u.Username}</span>
                        <span className="friend-card__role">@{u.Username}</span>
                      </div>
                    </div>
                    <button className="btn btn-gold" onClick={() => onSend(u.User_ID)}>
                      + Пригласить в соратники
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
