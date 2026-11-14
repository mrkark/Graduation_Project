import { Check, RefreshCw, Eye, X, Edit3, Clock } from 'lucide-react';
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
          <button type="button" onClick={() => setNotice(null)}><X size={14} /></button>
        </div>
      )}

      <div className="admin-controls-card">
        <div className="admin-controls-card__header">
          <div>
            <h3>Каталог и модерация форм Ката</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Управление каноническими формами Шотокан и модерация пользовательских версий
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
              <Check size={13} />
              <span>Одобренные</span>
            </button>
            <button
              type="button"
              className={`admin-status-tab ${status === 'pending' ? 'active' : ''}`}
              onClick={() => setStatus('pending')}
            >
              <Clock size={13} />
              <span>На модерации</span>
            </button>
            <button
              type="button"
              className={`admin-status-tab ${status === 'rejected' ? 'active' : ''}`}
              onClick={() => setStatus('rejected')}
            >
              <X size={13} />
              <span>Отклонённые</span>
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
            {loading ? 'Обновление…' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><RefreshCw size={13} /> Обновить</span>}
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
          <table className="admin-table admin-kata-table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Название ката</th>
                <th style={{ width: '13%' }}>Сложность</th>
                <th style={{ width: '16%' }}>Автор</th>
                <th style={{ width: '14%' }}>Статус</th>
                <th style={{ width: '32%', textAlign: 'right' }}>Действия</th>
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
                    <td className="admin-actions-cell">
                      <div className="admin-kata-actions-stack">
                        <div className="admin-kata-actions-row">
                          {k.Status !== 'approved' && (
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              onClick={() => onApprove(k.Kata_ID, k.Title)}
                              disabled={isBusy}
                              title="Одобрить форму ката"
                            >
                              <Check size={12} />
                              <span>Одобрить</span>
                            </button>
                          )}
                          {k.Status !== 'rejected' && (
                            <button
                              type="button"
                              className="btn btn-warning btn-sm"
                              onClick={() => onReject(k.Kata_ID, k.Title)}
                              disabled={isBusy}
                              title="Отклонить форму ката"
                            >
                              <X size={12} />
                              <span>Отклонить</span>
                            </button>
                          )}
                          <Link
                            to={`/kata/${k.Kata_ID}`}
                            className="btn btn-gold btn-sm"
                            title="Открыть 3D-разбор формы"
                          >
                            <Eye size={12} />
                            <span>3D</span>
                          </Link>
                        </div>
                        <div className="admin-kata-actions-row admin-kata-actions-row--bottom">
                          <Link
                            to={`/kata/${k.Kata_ID}/edit`}
                            className="btn btn-subtle btn-sm btn-edit-kata"
                            title="Редактировать параметры ката"
                          >
                            <Edit3 size={12} />
                            <span>Редактировать</span>
                          </Link>
                        </div>
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
