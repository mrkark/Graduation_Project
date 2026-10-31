import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { listKata, approveKata, rejectKata } from '../../api/kata';
import StatusBadge from '../../components/StatusBadge';

export default function AdminKataPage() {
  const [status, setStatus] = useState('approved');
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await listKata({ status, pageSize: 100, sort: 'oldest' });
      setItems(res.data || []);
    } catch {
      setNotice({ type: 'error', text: 'Ошибка загрузки ката' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function notify(text, type = 'success') {
    setNotice({ text, type });
    setTimeout(() => setNotice(null), 4000);
  }

  async function onApprove(id, title) {
    setProcessingId(id);
    try {
      await approveKata(id);
      notify(`Форма ката «${title}» одобрена`);
      await load();
    } catch (err) {
      notify(err.response?.data?.error?.message || 'Ошибка одобрения ката', 'error');
    } finally {
      setProcessingId(null);
    }
  }

  async function onReject(id, title) {
    setProcessingId(id);
    try {
      await rejectKata(id);
      notify(`Форма ката «${title}» отклонена`, 'warning');
      await load();
    } catch (err) {
      notify(err.response?.data?.error?.message || 'Ошибка отклонения ката', 'error');
    } finally {
      setProcessingId(null);
    }
  }

  const filteredItems = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter((k) => {
      const title = (k.Title || '').toLowerCase();
      const author = (k.Author?.Display_Name || k.Author?.Username || '').toLowerCase();
      return title.includes(q) || author.includes(q);
    });
  }, [items, search]);

  return (
    <div className="admin-kata-page">
      {notice && (
        <div className={`admin-alert-banner admin-alert-banner--${notice.type}`}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      <div className="admin-controls-card">
        <div className="admin-controls-card__header">
          <div>
            <h3>Каталог и модерация форм Ката</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Управление каноническими формами Сётокан и модерация пользовательских версий
            </p>
          </div>
        </div>

        <div className="admin-bunkai-tabs-row">
          <div className="admin-status-tabs">
            <button
              type="button"
              className={`admin-status-tab ${status === 'approved' ? 'active' : ''}`}
              onClick={() => setStatus('approved')}
            >
              ✔ Одобренные
            </button>
            <button
              type="button"
              className={`admin-status-tab ${status === 'pending' ? 'active' : ''}`}
              onClick={() => setStatus('pending')}
            >
              ⏳ На модерации
            </button>
            <button
              type="button"
              className={`admin-status-tab ${status === 'rejected' ? 'active' : ''}`}
              onClick={() => setStatus('rejected')}
            >
              ✕ Отклонённые
            </button>
          </div>

          <div className="admin-search-wrap" style={{ flex: 1, minWidth: 260 }}>
            <input
              className="admin-input"
              placeholder="Поиск по названию ката или автору…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="admin-controls-card__footer">
          <span className="admin-counter-pill">
            Всего форм в списке: <strong>{filteredItems.length}</strong>
          </span>
          <button type="button" className="btn btn-subtle" onClick={load} disabled={loading}>
            {loading ? 'Обновление…' : '🔄 Обновить'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="loading">Загрузка ката…</p>
      ) : filteredItems.length === 0 ? (
        <div className="admin-empty-box">
          <p>Форм ката с указанными критериями не найдено.</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Название ката</th>
                <th>Сложность</th>
                <th>Автор</th>
                <th>Статус</th>
                <th style={{ textAlign: 'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((k) => {
                const isBusy = processingId === k.Kata_ID;

                return (
                  <tr key={k.Kata_ID}>
                    <td>
                      <Link
                        to={`/kata/${k.Kata_ID}`}
                        style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}
                      >
                        {k.Title} ↗
                      </Link>
                    </td>
                    <td>
                      <span className="admin-role-badge admin-role-badge--user">
                        {k.Difficulty || 'Каноническое'}
                      </span>
                    </td>
                    <td>{k.Author?.Display_Name || k.Author?.Username || 'Мастера Додзё'}</td>
                    <td>
                      <StatusBadge status={k.Status} />
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        {k.Status !== 'approved' && (
                          <button
                            type="button"
                            className="btn btn-success"
                            onClick={() => onApprove(k.Kata_ID, k.Title)}
                            disabled={isBusy}
                          >
                            ✔ Одобрить
                          </button>
                        )}
                        {k.Status !== 'rejected' && (
                          <button
                            type="button"
                            className="btn btn-warning"
                            onClick={() => onReject(k.Kata_ID, k.Title)}
                            disabled={isBusy}
                          >
                            ✕ Отклонить
                          </button>
                        )}
                        <Link to={`/kata/${k.Kata_ID}`} className="btn btn-subtle">
                          👁 3D
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
