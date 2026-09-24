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

const TABS = [
  { key: 'friends', label: 'Друзья' },
  { key: 'incoming', label: 'Входящие заявки' },
  { key: 'outgoing', label: 'Исходящие заявки' },
  { key: 'search', label: 'Найти пользователей' },
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
    <div>
      <h1>Друзья</h1>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'incoming' && incoming.length > 0 ? ` (${incoming.length})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="loading">Загрузка…</p>
      ) : (
        <>
          {tab === 'friends' &&
            (friends.length === 0 ? (
              <p className="empty-state">У вас пока нет друзей. Найдите единомышленников во вкладке «Найти пользователей».</p>
            ) : (
              friends.map((f) => (
                <div className="friend-card" key={f.User_ID}>
                  <span className="friend-card__name">{f.Display_Name || f.Username}</span>
                  <div className="friend-card__actions">
                    <Link className="btn" to={`/chat?friendId=${f.User_ID}`}>
                      Написать
                    </Link>
                    <button className="btn btn-danger" onClick={() => onRemove(f.User_ID)}>
                      Удалить
                    </button>
                  </div>
                </div>
              ))
            ))}

          {tab === 'incoming' &&
            (incoming.length === 0 ? (
              <p className="empty-state">Нет входящих заявок.</p>
            ) : (
              incoming.map((r) => (
                <div className="friend-card" key={r.Request_ID}>
                  <span className="friend-card__name">{r.Sender?.Display_Name || r.Sender?.Username}</span>
                  <div className="friend-card__actions">
                    <button className="btn btn-primary" onClick={() => onAccept(r.Request_ID)}>
                      Принять
                    </button>
                    <button className="btn btn-danger" onClick={() => onReject(r.Request_ID)}>
                      Отклонить
                    </button>
                  </div>
                </div>
              ))
            ))}

          {tab === 'outgoing' &&
            (outgoing.length === 0 ? (
              <p className="empty-state">Нет исходящих заявок.</p>
            ) : (
              outgoing.map((r) => (
                <div className="friend-card" key={r.Request_ID}>
                  <span className="friend-card__name">{r.Receiver?.Display_Name || r.Receiver?.Username}</span>
                  <div className="friend-card__actions">
                    <button className="btn btn-danger" onClick={() => onReject(r.Request_ID)}>
                      Отменить
                    </button>
                  </div>
                </div>
              ))
            ))}

          {tab === 'search' && (
            <div>
              <div className="field" style={{ maxWidth: 380, marginBottom: '1.2rem' }}>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Введите имя пользователя…" />
              </div>
              {results.map((u) => (
                <div className="friend-card" key={u.User_ID}>
                  <span className="friend-card__name">{u.Display_Name || u.Username}</span>
                  <button className="btn btn-gold" onClick={() => onSend(u.User_ID)}>
                    Добавить в друзья
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
