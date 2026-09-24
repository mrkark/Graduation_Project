import { useEffect, useState } from 'react';
import { fetchBackups, createBackup } from '../../api/admin';

export default function AdminBackupsPage() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setBackups(await fetchBackups());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate() {
    setCreating(true);
    setError(null);
    try {
      await createBackup();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Не удалось создать резервную копию');
    } finally {
      setCreating(false);
      load();
    }
  }

  return (
    <div>
      <div className="page-header">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: 520 }}>
          Резервное копирование выполняется через утилиту <code>sqlcmd</code> на сервере приложения. Если она
          недоступна в окружении, попытка честно завершится со статусом «ошибка» — без фиктивного успеха.
        </p>
        <button className="btn btn-primary" onClick={onCreate} disabled={creating}>
          {creating ? 'Выполняется…' : '+ Создать резервную копию'}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p className="loading">Загрузка…</p>
      ) : backups.length === 0 ? (
        <p className="empty-state">Резервных копий ещё не создавалось.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Файл</th>
              <th>Тип</th>
              <th>Статус</th>
              <th>Создан</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((b) => (
              <tr key={b.Backup_ID}>
                <td>{b.File_Name}</td>
                <td>{b.Backup_Type}</td>
                <td>{b.Status}</td>
                <td>{new Date(b.Created_At).toLocaleString('ru-RU')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
