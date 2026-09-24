import { useEffect, useState } from 'react';
import { adminApi } from '../../api/endpoints';

export default function Moderation() {
  const [queue, setQueue] = useState([]);

  function load() {
    adminApi.moderationQueue().then((r) => setQueue(r.data.data));
  }
  useEffect(load, []);

  async function decide(id, status) {
    await adminApi.moderateBunkai(id, status);
    load();
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Очередь модерации</h1>
      {queue.length === 0 && <p style={{ color: 'var(--washi-dim)' }}>Очередь пуста — все бункай рассмотрены.</p>}
      {queue.map((b) => (
        <div key={b.id} className="washi-panel" style={{ padding: 18, marginBottom: 14 }}>
          <h3>{b.title}</h3>
          <p style={{ color: 'var(--washi-dim)', margin: '8px 0' }}>{b.description}</p>
          <div>
            <button className="action-btn" onClick={() => decide(b.id, 'approved')}>Одобрить</button>
            <button className="action-btn danger" onClick={() => decide(b.id, 'rejected')}>Отклонить</button>
          </div>
        </div>
      ))}
    </div>
  );
}
