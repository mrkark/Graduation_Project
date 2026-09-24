import { useEffect, useState } from 'react';
import { fetchLogs } from '../../api/admin';

export default function AdminLogsPage() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pageSize: 50 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchLogs({ page, pageSize: 50 })
      .then((res) => {
        setLogs(res.data);
        setMeta(res.meta);
      })
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));

  return (
    <div>
      {loading ? (
        <p className="loading">Загрузка журнала…</p>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Пользователь</th>
                <th>Действие</th>
                <th>Сущность</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.Log_ID}>
                  <td>{new Date(log.Created_At).toLocaleString('ru-RU')}</td>
                  <td>{log.User?.Username || '—'}</td>
                  <td>{log.Action}</td>
                  <td>
                    {log.Entity_Type || ''} {log.Entity_ID ? `#${log.Entity_ID}` : ''}
                  </td>
                  <td>{log.Ip_Address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="pagination">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} className={`btn ${p === page ? 'btn-gold' : ''}`} onClick={() => setPage(p)}>
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
