import { useState } from 'react';
import { adminApi } from '../../api/endpoints';

// Простая форма скрытия/показа комментария по ID — полноценный список
// комментариев можно получить через /api/bunkai/:id/comments на нужной странице бункай.
export default function CommentsAdmin() {
  const [id, setId] = useState('');
  const [status, setStatus] = useState('');

  async function hide(hidden) {
    if (!id) return;
    await adminApi.hideComment(id, hidden);
    setStatus(hidden ? `Комментарий #${id} скрыт` : `Комментарий #${id} снова виден`);
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Модерация комментариев</h1>
      <div className="washi-panel" style={{ padding: 18, maxWidth: 420 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, fontSize: '0.85rem', color: 'var(--washi-dim)' }}>
          ID комментария
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="Например, 12" />
        </label>
        <div>
          <button className="action-btn danger" onClick={() => hide(true)}>Скрыть</button>
          <button className="action-btn" onClick={() => hide(false)}>Показать снова</button>
        </div>
        {status && <p style={{ marginTop: 12, color: 'var(--gold-soft)', fontSize: '0.85rem' }}>{status}</p>}
      </div>
    </div>
  );
}
