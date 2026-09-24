import { useEffect, useState } from 'react';
import { adminApi } from '../../api/endpoints';

export default function Logs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    adminApi.logs().then((r) => setLogs(r.data.data.items));
  }, []);

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Журнал действий администраторов</h1>
      <table className="admin-table">
        <thead><tr><th>Дата</th><th>Актор</th><th>Действие</th><th>Объект</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{new Date(l.createdAt).toLocaleString('ru-RU')}</td>
              <td>{l.actor?.username || '—'}</td>
              <td>{l.action}</td>
              <td>{l.targetType} #{l.targetId}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {logs.length === 0 && <p style={{ color: 'var(--washi-dim)' }}>Логов пока нет.</p>}
    </div>
  );
}
