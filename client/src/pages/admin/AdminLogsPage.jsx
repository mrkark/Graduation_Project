import { useEffect, useState } from 'react';
import { fetchLogs } from '../../api/admin';

export default function AdminLogsPage() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pageSize: 50 });
  const [loading, setLoading] = useState(true);

  // Фильтры согласно UML-диаграмме «Администратор»
  const [actionFilter, setActionFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');

  function loadLogs() {
    setLoading(true);
    fetchLogs({
      page,
      pageSize: 50,
      action: actionFilter || undefined,
      ip: ipFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      userId: userIdFilter ? Number(userIdFilter) : undefined,
    })
      .then((res) => {
        setLogs(res.data || []);
        setMeta(res.meta || { total: 0, pageSize: 50 });
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, actionFilter, ipFilter, dateFrom, dateTo, userIdFilter]);

  function handleReset() {
    setActionFilter('');
    setIpFilter('');
    setDateFrom('');
    setDateTo('');
    setUserIdFilter('');
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));

  return (
    <div>
      {/* Панель фильтрации системного аудита (Диаграмма прецедентов: Фильтрация по дате, IP, пользователю, коду действия) */}
      <div
        style={{
          background: 'var(--surface-sunken, rgba(0,0,0,0.3))',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid var(--border, #333)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--gold, #d4a24c)', marginBottom: '0.8rem' }}>
          🔍 Фильтрация событий системного аудита:
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
          {/* По коду действия */}
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              Код действия:
            </label>
            <input
              placeholder="e.g. login, block_user, approve_bunkai…"
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
            />
          </div>

          {/* По пользователю (ID) */}
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              ID пользователя:
            </label>
            <input
              type="number"
              placeholder="ID пользователя…"
              value={userIdFilter}
              onChange={(e) => {
                setUserIdFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
            />
          </div>

          {/* По IP адресу */}
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              IP-адрес:
            </label>
            <input
              placeholder="e.g. 127.0.0.1, 192.168…"
              value={ipFilter}
              onChange={(e) => {
                setIpFilter(e.target.value);
                setPage(1);
              }}
              style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
            />
          </div>

          {/* По дате: С */}
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              Дата С:
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
            />
          </div>

          {/* По дате: По */}
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              Дата По:
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          {(actionFilter || ipFilter || dateFrom || dateTo || userIdFilter) && (
            <button type="button" className="btn btn-subtle" onClick={handleReset} style={{ fontSize: '0.82rem' }}>
              ✕ Сбросить фильтры
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '0.8rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Найдено записей аудита: <strong>{meta.total}</strong>
      </div>

      {loading ? (
        <p className="loading">Загрузка журнала…</p>
      ) : logs.length === 0 ? (
        <p className="empty-state">Событий с выбранными параметрами фильтрации не найдено.</p>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Время (UTC)</th>
                <th>Пользователь</th>
                <th>Действие</th>
                <th>Сущность</th>
                <th>IP-адрес</th>
                <th>Подробности</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.Log_ID}>
                  <td>{new Date(log.Created_At).toLocaleString('ru-RU')}</td>
                  <td>
                    {log.User?.Username ? (
                      <span style={{ fontWeight: 600 }}>{log.User.Username}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <span className="badge" style={{ fontFamily: 'monospace' }}>
                      {log.Action}
                    </span>
                  </td>
                  <td>
                    {log.Entity_Type || '—'} {log.Entity_ID ? `#${log.Entity_ID}` : ''}
                  </td>
                  <td><code>{log.Ip_Address || '—'}</code></td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {log.Details ? JSON.stringify(log.Details) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

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
