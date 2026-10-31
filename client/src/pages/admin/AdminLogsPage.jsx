import { useEffect, useState } from 'react';
import { RefreshCw, X, Filter } from 'lucide-react';
import { fetchLogs } from '../../api/admin';

const COMMON_ACTIONS = [
  { value: '', label: 'Все действия' },
  { value: 'login', label: 'Вход в систему (login)' },
  { value: 'register', label: 'Регистрация (register)' },
  { value: 'block_user', label: 'Блокировка пользователя (block_user)' },
  { value: 'unblock_user', label: 'Разблокировка (unblock_user)' },
  { value: 'change_role', label: 'Смена роли (change_role)' },
  { value: 'delete_user', label: 'Удаление пользователя (delete_user)' },
  { value: 'approve_bunkai', label: 'Утверждение бункай (approve_bunkai)' },
  { value: 'reject_bunkai', label: 'Отклонение бункай (reject_bunkai)' },
  { value: 'delete_comment', label: 'Удаление комментария (delete_comment)' },
  { value: 'create_backup', label: 'Создание бэкапа (create_backup)' },
];

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

  function setPresetDates(days) {
    if (days === 0) {
      const today = new Date().toISOString().split('T')[0];
      setDateFrom(today);
      setDateTo(today);
    } else if (days > 0) {
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - days);
      setDateFrom(from.toISOString().split('T')[0]);
      setDateTo(to.toISOString().split('T')[0]);
    } else {
      setDateFrom('');
      setDateTo('');
    }
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  const hasActiveFilters = Boolean(actionFilter || ipFilter || dateFrom || dateTo || userIdFilter);

  return (
    <div className="admin-logs-page">
      {/* Панель фильтрации системного аудита (Диаграмма прецедентов: Фильтрация по дате, IP, пользователю, коду действия) */}
      <div className="admin-controls-card">
        <div className="admin-controls-card__header">
          <div>
            <h3>Мониторинг журнала системного аудита</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Регистрация и аудит всех критических действий администраторов, модераторов и пользователей
            </p>
          </div>
          {hasActiveFilters && (
            <button type="button" className="btn btn-subtle" onClick={handleReset} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <X size={14} />
              <span>Сбросить фильтры</span>
            </button>
          )}
        </div>

        <div className="admin-controls-card__grid" style={{ marginTop: '1rem' }}>
          {/* 1. Фильтрация по коду действия */}
          <div className="admin-field-wrap">
            <label>Код действия</label>
            <select
              className="admin-select"
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
            >
              {COMMON_ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>

          {/* 2. Фильтрация по пользователю */}
          <div className="admin-field-wrap">
            <label>ID пользователя</label>
            <input
              type="number"
              className="admin-input"
              placeholder="e.g. 1, 2, 5…"
              value={userIdFilter}
              onChange={(e) => {
                setUserIdFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* 3. Фильтрация по IP-адресу */}
          <div className="admin-field-wrap">
            <label>IP-адрес</label>
            <input
              className="admin-input"
              placeholder="e.g. 127.0.0.1, 192.168…"
              value={ipFilter}
              onChange={(e) => {
                setIpFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* 4. Фильтрация по дате: Период */}
          <div className="admin-field-wrap">
            <label>Период: Дата С</label>
            <input
              type="date"
              className="admin-input"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="admin-field-wrap">
            <label>Период: Дата По</label>
            <input
              type="date"
              className="admin-input"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {/* Быстрые пресеты дат */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Быстрый выбор периода:</span>
          <button type="button" className="btn btn-subtle" style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }} onClick={() => setPresetDates(0)}>
            Сегодня
          </button>
          <button type="button" className="btn btn-subtle" style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }} onClick={() => setPresetDates(7)}>
            7 дней
          </button>
          <button type="button" className="btn btn-subtle" style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }} onClick={() => setPresetDates(30)}>
            30 дней
          </button>
          <button type="button" className="btn btn-subtle" style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }} onClick={() => setPresetDates(-1)}>
            За всё время
          </button>
        </div>

        <div className="admin-controls-card__footer">
          <span className="admin-counter-pill">
            Найдено событий: <strong>{meta.total}</strong>
          </span>
          <button type="button" className="btn btn-subtle" onClick={loadLogs} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={14} className={loading ? 'admin-spin' : ''} />
            <span>{loading ? 'Обновление…' : 'Обновить журнал'}</span>
          </button>
        </div>
      </div>

      {/* Таблица событий */}
      {loading ? (
        <p className="loading">Загрузка журнала аудита…</p>
      ) : logs.length === 0 ? (
        <div className="admin-empty-box">
          <p>Событий аудита с выбранными параметрами фильтрации не найдено.</p>
        </div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Время события</th>
                  <th>Пользователь</th>
                  <th>Действие</th>
                  <th>Целевой объект</th>
                  <th>IP-адрес</th>
                  <th>Детали</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isDanger = log.Action?.includes('delete') || log.Action?.includes('block') || log.Action?.includes('reject');
                  const isSuccess = log.Action?.includes('approve') || log.Action?.includes('unblock') || log.Action?.includes('create_backup');

                  return (
                    <tr key={log.Log_ID}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(log.Created_At).toLocaleString('ru-RU')}
                      </td>
                      <td>
                        {log.User?.Username ? (
                          <div className="admin-user-names">
                            <span className="admin-user-login">{log.User.Username}</span>
                            {log.User.Display_Name && log.User.Display_Name !== log.User.Username && (
                              <span className="admin-user-display">{log.User.Display_Name}</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Система</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`admin-action-badge ${
                            isDanger
                              ? 'admin-action-badge--danger'
                              : isSuccess
                              ? 'admin-action-badge--success'
                              : 'admin-action-badge--info'
                          }`}
                        >
                          {log.Action}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem' }}>
                          {log.Entity_Type ? `${log.Entity_Type} #${log.Entity_ID || ''}` : '—'}
                        </span>
                      </td>
                      <td>
                        <code style={{ fontSize: '0.8rem', color: 'var(--gold)' }}>
                          {log.Ip_Address || '—'}
                        </code>
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                          {log.Details ? JSON.stringify(log.Details) : '—'}
                        </span>
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
