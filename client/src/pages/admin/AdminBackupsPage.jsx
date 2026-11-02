import { useEffect, useState } from 'react';
import { Database, CheckCircle, Clock, RefreshCw, X } from 'lucide-react';
import { fetchBackups, createBackup } from '../../api/admin';

export default function AdminBackupsPage() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchBackups();
      setBackups(data || []);
    } catch {
      setNotice({ type: 'error', text: 'Ошибка загрузки списка резервных копий' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function notify(text, type = 'success') {
    setNotice({ text, type });
    setTimeout(() => setNotice(null), 5000);
  }

  // Прецедент: Создание резервных копий базы данных
  async function onCreate() {
    if (!confirm('Создать полную резервную копию базы данных BunkaiExplorer прямо сейчас?')) return;
    setCreating(true);
    setNotice(null);
    try {
      const res = await createBackup();
      notify(`Резервная копия «${res?.File_Name || 'backup'}» успешно создана в защищенном хранилище`);
      await load();
    } catch (err) {
      notify(err.response?.data?.error?.message || 'Не удалось создать резервную копию', 'error');
    } finally {
      setCreating(false);
    }
  }

  const successBackups = backups.filter((b) => b.Status === 'success').length;
  const lastBackup = backups[0];

  return (
    <div className="admin-backups-page">
      {notice && (
        <div className={`admin-alert-banner admin-alert-banner--${notice.type}`}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)}><X size={14} /></button>
        </div>
      )}

      {/* Панель создания резервной копии */}
      <div className="admin-controls-card">
        <div className="admin-controls-card__header">
          <div>
            <h3>Резервное копирование базы данных</h3>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Регулярное создание полных резервных копий Microsoft SQL Server для защиты от сбоев и потери данных
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onCreate}
            disabled={creating}
            style={{ minWidth: 240, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <Database size={16} />
            <span>{creating ? 'Создание бэкапа…' : 'Создать резервную копию БД'}</span>
          </button>
        </div>

        {/* Сводка состояния бэкапов */}
        <div className="admin-metrics-grid" style={{ marginTop: '1.25rem' }}>
          <div className="admin-metric-card">
            <div className="admin-metric-card__icon"><Database size={26} color="var(--gold)" /></div>
            <div className="admin-metric-card__body">
              <span className="admin-metric-card__val">{backups.length}</span>
              <span className="admin-metric-card__lbl">Всего копий</span>
              <span className="admin-metric-card__sub">В истории системы</span>
            </div>
          </div>

          <div className="admin-metric-card">
            <div className="admin-metric-card__icon"><CheckCircle size={26} color="#34d399" /></div>
            <div className="admin-metric-card__body">
              <span className="admin-metric-card__val">{successBackups}</span>
              <span className="admin-metric-card__lbl">Успешных снимков</span>
              <span className="admin-metric-card__sub">Готовы к восстановлению</span>
            </div>
          </div>

          <div className="admin-metric-card">
            <div className="admin-metric-card__icon"><Clock size={26} color="var(--gold)" /></div>
            <div className="admin-metric-card__body">
              <span className="admin-metric-card__val" style={{ fontSize: '1.2rem', marginTop: '0.4rem' }}>
                {lastBackup ? new Date(lastBackup.Created_At).toLocaleDateString('ru-RU') : '—'}
              </span>
              <span className="admin-metric-card__lbl">Последняя копия</span>
              <span className="admin-metric-card__sub">
                {lastBackup ? new Date(lastBackup.Created_At).toLocaleTimeString('ru-RU') : 'Нет бэкапов'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Таблица созданных копий */}
      <div className="admin-section-header" style={{ marginTop: '2rem' }}>
        <h3>Журнал резервных копий</h3>
        <button type="button" className="btn btn-subtle" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'admin-spin' : ''} />
          <span>{loading ? 'Обновление…' : 'Обновить'}</span>
        </button>
      </div>

      {loading ? (
        <p className="loading">Загрузка журнала копий…</p>
      ) : backups.length === 0 ? (
        <div className="admin-empty-box">
          <p>Резервных копий базы данных ещё не создавалось. Нажмите кнопку выше для первого снимка.</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Имя файла бэкапа</th>
                <th>Тип</th>
                <th>Статус операции</th>
                <th>Дата и время создания</th>
                <th>Путь в хранилище</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.Backup_ID}>
                  <td>
                    <code style={{ color: 'var(--gold)', fontWeight: 600 }}>{b.File_Name}</code>
                  </td>
                  <td>
                    <span className="admin-role-badge admin-role-badge--user">
                      {b.Backup_Type === 'full' ? 'Полный бэкап (FULL)' : b.Backup_Type}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-status-badge ${
                        b.Status === 'success' ? 'admin-status-badge--active' : 'admin-status-badge--blocked'
                      }`}
                    >
                      <span className="admin-status-dot" />
                      <span>{b.Status === 'success' ? 'Успешно' : 'Ошибка'}</span>
                    </span>
                  </td>
                  <td>{new Date(b.Created_At).toLocaleString('ru-RU')}</td>
                  <td>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {b.File_Path || '/tmp/' + b.File_Name}
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
