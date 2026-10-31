import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { listBunkai, approveBunkai, rejectBunkai, deleteBunkai } from '../../api/bunkai';
import StatusBadge from '../../components/StatusBadge';

export default function AdminBunkaiPage() {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await listBunkai({ status, pageSize: 100, sort: 'oldest' });
      setItems(res.data || []);
    } catch {
      setNotice({ type: 'error', text: 'Ошибка загрузки материалов бункай' });
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

  // Прецедент: Утверждение публикации бункай
  async function onApprove(id, title) {
    setProcessingId(id);
    try {
      await approveBunkai(id);
      notify(`Боевой сценарий «${title}» успешно утвержден и опубликован`);
      await load();
    } catch (err) {
      notify(err.response?.data?.error?.message || 'Ошибка утверждения публикации', 'error');
    } finally {
      setProcessingId(null);
    }
  }

  // Прецедент: Отклонение публикации бункай
  async function onReject(id, title) {
    setProcessingId(id);
    try {
      await rejectBunkai(id);
      notify(`Публикация «${title}» отклонена`, 'warning');
      await load();
    } catch (err) {
      notify(err.response?.data?.error?.message || 'Ошибка отклонения публикации', 'error');
    } finally {
      setProcessingId(null);
    }
  }

  async function onDelete(id, title) {
    if (!confirm(`Удалить бункай «${title}» без возможности восстановления?`)) return;
    setProcessingId(id);
    try {
      await deleteBunkai(id);
      notify(`Бункай «${title}» удален`);
      await load();
    } catch (err) {
      notify(err.response?.data?.error?.message || 'Ошибка удаления бункая', 'error');
    } finally {
      setProcessingId(null);
    }
  }

  const filteredItems = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter((b) => {
      const t = (b.Title || '').toLowerCase();
      const kata = (b.Kata?.Title || '').toLowerCase();
      const author = (b.Author?.Display_Name || b.Author?.Username || '').toLowerCase();
      return t.includes(q) || kata.includes(q) || author.includes(q);
    });
  }, [items, search]);

  return (
    <div className="admin-bunkai-page">
      {notice && (
        <div className={`admin-alert-banner admin-alert-banner--${notice.type}`}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      {/* Панель фильтров модерации бункай */}
      <div className="admin-controls-card">
        <div className="admin-controls-card__header">
          <div>
            <h3>Модерация боевых сценариев Бункай</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Проверка практических разборов ката: утверждение публикации в общем каталоге или отклонение с возвратом автору
            </p>
          </div>
        </div>

        <div className="admin-bunkai-tabs-row">
          <div className="admin-status-tabs">
            <button
              type="button"
              className={`admin-status-tab ${status === 'pending' ? 'active' : ''}`}
              onClick={() => setStatus('pending')}
            >
              ⏳ На модерации
            </button>
            <button
              type="button"
              className={`admin-status-tab ${status === 'approved' ? 'active' : ''}`}
              onClick={() => setStatus('approved')}
            >
              ✔ Одобренные
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
              placeholder="Поиск по названию, ката или автору…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="admin-controls-card__footer">
          <span className="admin-counter-pill">
            Материалов в списке: <strong>{filteredItems.length}</strong>
          </span>
          <button type="button" className="btn btn-subtle" onClick={load} disabled={loading}>
            {loading ? 'Обновление…' : '🔄 Обновить список'}
          </button>
        </div>
      </div>

      {/* Таблица материалов */}
      {loading ? (
        <p className="loading">Загрузка материалов бункай…</p>
      ) : filteredItems.length === 0 ? (
        <div className="admin-empty-box">
          <p>
            {status === 'pending'
              ? 'Нет сценариев бункай, ожидающих модерации. Все заявки проверены!'
              : 'В данной категории материалов не найдено.'}
          </p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Название боевого сценария</th>
                <th>Форма Ката</th>
                <th>Автор разбора</th>
                <th>Статус</th>
                <th style={{ textAlign: 'right' }}>Действия модерации</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((b) => {
                const isBusy = processingId === b.Bunkai_ID;

                return (
                  <tr key={b.Bunkai_ID}>
                    <td>
                      <div>
                        <Link
                          to={`/bunkai/${b.Bunkai_ID}`}
                          style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}
                          title="Открыть интерактивную 3D симуляцию разбора"
                        >
                          {b.Title} ↗
                        </Link>
                        {b.Description && (
                          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.Description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="admin-role-badge admin-role-badge--user">
                        {b.Kata?.Title || 'Ката Сётокан'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>
                        {b.Author?.Display_Name || b.Author?.Username || 'Сенсей Додзё'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={b.Status} />
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        {/* Прецедент: Утверждение публикации бункай */}
                        {b.Status !== 'approved' && (
                          <button
                            type="button"
                            className="btn btn-success"
                            onClick={() => onApprove(b.Bunkai_ID, b.Title)}
                            disabled={isBusy}
                            title="Утвердить публикацию бункая в общем каталоге"
                          >
                            ✔ Утвердить
                          </button>
                        )}

                        {/* Прецедент: Отклонение публикации бункай */}
                        {b.Status !== 'rejected' && (
                          <button
                            type="button"
                            className="btn btn-warning"
                            onClick={() => onReject(b.Bunkai_ID, b.Title)}
                            disabled={isBusy}
                            title="Отклонить публикацию с пометкой"
                          >
                            ✕ Отклонить
                          </button>
                        )}

                        <Link
                          to={`/bunkai/${b.Bunkai_ID}`}
                          className="btn btn-subtle"
                          title="Открыть 3D плеер и изучить движения"
                        >
                          👁 3D
                        </Link>

                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => onDelete(b.Bunkai_ID, b.Title)}
                          disabled={isBusy}
                          title="Удалить сценарий из базы"
                        >
                          🗑
                        </button>
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
