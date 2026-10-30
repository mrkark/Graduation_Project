import { useEffect, useState } from 'react';
import { fetchAdminComments, deleteAdminComment } from '../../api/admin';

export default function AdminCommentsPage() {
  const [comments, setComments] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, pageSize: 50 });
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchAdminComments({ page, pageSize: 50, search: search || undefined });
      setComments(res.data || []);
      setMeta(res.meta || { total: 0, pageSize: 50 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  async function onDelete(c) {
    if (!confirm(`Удалить комментарий пользователя ${c.Author?.Username || 'Пользователь'}?`)) return;
    await deleteAdminComment(c.Comment_ID);
    load();
  }

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="field" style={{ maxWidth: 360, margin: 0 }}>
          <input
            placeholder="Поиск по тексту комментария или автору…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Всего комментариев: <strong>{meta.total}</strong>
        </div>
      </div>

      {loading ? (
        <p className="loading">Загрузка комментариев…</p>
      ) : comments.length === 0 ? (
        <p className="empty-state">Комментарии не найдены.</p>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table data-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Автор</th>
                  <th>Раздел</th>
                  <th>Текст комментария</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {comments.map((c) => {
                  const targetTitle = c.Kata_Title
                    ? `Ката: ${c.Kata_Title}`
                    : c.Bunkai_Title
                    ? `Бункай: ${c.Bunkai_Title}`
                    : 'Обсуждение';

                  return (
                    <tr key={c.Comment_ID}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(c.Created_At).toLocaleDateString('ru-RU')}
                      </td>
                      <td>
                        <strong>{c.Author?.Display_Name || c.Author?.Username || 'Пользователь'}</strong>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          @{c.Author?.Username}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge--info" style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {targetTitle}
                        </span>
                      </td>
                      <td style={{ maxWidth: 380 }}>
                        <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.4', wordBreak: 'break-word' }}>
                          {c.Text}
                        </p>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => onDelete(c)}
                          title="Удалить комментарий"
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop: '1rem' }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`btn ${p === page ? 'btn-gold' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
