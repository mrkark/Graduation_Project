import { useEffect, useState, useMemo } from 'react';
import { Trash2, Search, MessageSquare } from 'lucide-react';
import { fetchAdminComments, deleteAdminComment } from '../../api/admin';

export default function AdminCommentsPage() {
  const [comments, setComments] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'kata' | 'bunkai'
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, pageSize: 50 });
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchAdminComments({ page, pageSize: 50, search: search || undefined });
      setComments(res.data || []);
      setMeta(res.meta || { total: 0, pageSize: 50 });
    } catch {
      setNotice({ type: 'error', text: 'Ошибка загрузки комментариев' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  function notify(text, type = 'success') {
    setNotice({ text, type });
    setTimeout(() => setNotice(null), 4000);
  }

  // Прецедент: Удаление комментариев
  async function onDelete(c) {
    const authorName = c.Author?.Display_Name || c.Author?.Username || 'Пользователь';
    if (!confirm(`Удалить комментарий пользователя «${authorName}»?`)) return;
    setDeletingId(c.Comment_ID);
    try {
      await deleteAdminComment(c.Comment_ID);
      notify(`Комментарий пользователя «${authorName}» успешно удален`);
      await load();
    } catch (err) {
      notify(err.response?.data?.error?.message || 'Не удалось удалить комментарий', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  // Клиентский фильтр по разделам (Ката / Бункай)
  const filteredComments = useMemo(() => {
    return comments.filter((c) => {
      if (filterType === 'kata' && !c.Kata_Title && !c.Kata_ID) return false;
      if (filterType === 'bunkai' && !c.Bunkai_Title && !c.Bunkai_ID) return false;
      return true;
    });
  }, [comments, filterType]);

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));

  return (
    <div className="admin-comments-page">
      {notice && (
        <div className={`admin-alert-banner admin-alert-banner--${notice.type}`}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      {/* Панель фильтров модерации комментариев */}
      <div className="admin-controls-card">
        <div className="admin-controls-card__header">
          <div>
            <h3>Модерация комментариев и обсуждений</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Просмотр сообщений каратэк в обсуждениях ката и бункай, удаление спама и нарушений правил Додзё
            </p>
          </div>
        </div>

        <div className="admin-controls-card__grid" style={{ marginTop: '1rem' }}>
          <div className="admin-field-wrap" style={{ gridColumn: 'span 2' }}>
            <label>Поиск по тексту или автору</label>
            <input
              className="admin-input"
              placeholder="Введите текст сообщения или имя автора…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="admin-field-wrap">
            <label>Раздел обсуждения</label>
            <select
              className="admin-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">Все разделы</option>
              <option value="kata">Только комментарии к Ката</option>
              <option value="bunkai">Только комментарии к Бункай</option>
            </select>
          </div>
        </div>

        <div className="admin-controls-card__footer">
          <span className="admin-counter-pill">
            Найдено сообщений: <strong>{filteredComments.length}</strong>
          </span>
          <button type="button" className="btn btn-subtle" onClick={load} disabled={loading}>
            {loading ? 'Обновление…' : '🔄 Обновить'}
          </button>
        </div>
      </div>

      {/* Прецедент: Просмотр комментариев */}
      {loading ? (
        <p className="loading">Загрузка сообщений…</p>
      ) : filteredComments.length === 0 ? (
        <div className="admin-empty-box">
          <p>Комментариев с выбранными параметрами не найдено.</p>
        </div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Дата и время</th>
                  <th>Автор сообщения</th>
                  <th>Раздел обсуждения</th>
                  <th>Текст комментария</th>
                  <th style={{ textAlign: 'right' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredComments.map((c) => {
                  const targetTitle = c.Kata_Title
                    ? `Ката: ${c.Kata_Title}`
                    : c.Bunkai_Title
                    ? `Бункай: ${c.Bunkai_Title}`
                    : 'Обсуждение Додзё';
                  const isBusy = deletingId === c.Comment_ID;

                  return (
                    <tr key={c.Comment_ID}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(c.Created_At).toLocaleString('ru-RU')}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {c.Author?.Display_Name || c.Author?.Username || 'Пользователь'}
                        </span>
                      </td>
                      <td>
                        <span className="admin-role-badge admin-role-badge--moderator" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {targetTitle}
                        </span>
                      </td>
                      <td style={{ maxWidth: 440 }}>
                        <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.45', wordBreak: 'break-word', color: 'var(--text-secondary)' }}>
                          {c.Text}
                        </p>
                      </td>
                      <td>
                        <div className="admin-row-actions">
                          {/* Прецедент: Удаление комментариев */}
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => onDelete(c)}
                            disabled={isBusy}
                            title="Удалить комментарий"
                          >
                            <Trash2 size={13} />
                            <span>Удалить</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="admin-pagination">
              <button
                type="button"
                className="btn btn-subtle"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                ← Назад
              </button>
              <span>Страница {page} из {totalPages}</span>
              <button
                type="button"
                className="btn btn-subtle"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Вперед →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
