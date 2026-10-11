import { useEffect, useState } from 'react';
import { listMissingRequests } from '../../api/animations';

export default function AdminAnimationsPage() {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function fetchRequests() {
    setLoading(true);
    listMissingRequests(statusFilter || undefined)
      .then((data) => setRequests(data || []))
      .catch((err) => setError(err.message || 'Ошибка загрузки запросов'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>Реестр запросов на 3D-анимации</h2>
          <p style={{ color: 'var(--color-text-muted)', margin: '4px 0 0', fontSize: '0.88rem' }}>
            Автоматическая телеметрия отсутствующих клипов и переходов стоек для анимационного агента
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '6px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, color: '#fff' }}
          >
            <option value="">Все статусы</option>
            <option value="pending">Ожидают генерации (pending)</option>
            <option value="in_production">В производстве (in_production)</option>
            <option value="completed">Готовы (completed)</option>
          </select>

          <button className="btn" onClick={fetchRequests} disabled={loading}>
            🔄 Обновить
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="loading">Загрузка очереди анимаций…</p>
      ) : requests.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
            🎉 Нет зарегистрированных запросов на недостающие анимации. Библиотека клипов покрывает все действия.
          </p>
        </div>
      ) : (
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Частота</th>
                <th>Имя клипа</th>
                <th>Контекст вызова</th>
                <th>Исходная стойка</th>
                <th>Конечная стойка</th>
                <th>Последний запрос</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.Request_ID}>
                  <td>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 12,
                        background: r.Request_Count > 5 ? '#b91c1c' : '#c59b27',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                      }}
                    >
                      🔥 {r.Request_Count}x
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: 'var(--color-gold)' }}>{r.Clip_Name}</strong>
                  </td>
                  <td style={{ color: 'var(--color-text-muted)' }}>
                    {r.Context_Type} {r.Notes ? `(${r.Notes})` : ''}
                  </td>
                  <td>{r.From_Stance || '—'}</td>
                  <td>{r.To_Stance || '—'}</td>
                  <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {r.Last_Requested_At ? new Date(r.Last_Requested_At).toLocaleString('ru-RU') : '—'}
                  </td>
                  <td>
                    <span
                      className={`badge badge-${r.Status === 'completed' ? 'approved' : r.Status === 'in_production' ? 'pending' : 'rejected'}`}
                    >
                      {r.Status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
