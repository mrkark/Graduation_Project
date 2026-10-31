import { useEffect, useState, useMemo } from 'react';
import {
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  Crown,
  Trash2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { listUsers, blockUser, unblockUser, changeUserRole, deleteUser } from '../../api/admin';
import { useAuthStore } from '../../store/authStore';

export default function AdminUsersPage() {
  const { role, user: currentUser } = useAuthStore();
  const isAdmin = role === 'admin';
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'blocked'
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await listUsers({ search, role: roleFilter || undefined, pageSize: 100 });
      setUsers(res.data || []);
    } catch {
      setNotice({ type: 'error', text: 'Ошибка загрузки списка пользователей' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter]);

  function notify(text, type = 'success') {
    setNotice({ text, type });
    setTimeout(() => setNotice(null), 4000);
  }

  // Прецедент: Блокировка / Разблокировка учетной записи
  async function onToggleBlock(u) {
    const action = u.Is_Blocked ? 'unblock' : 'block';
    const confirmMsg = u.Is_Blocked
      ? `Разблокировать доступ пользователю ${u.Username}?`
      : `Заблокировать учетную запись пользователя ${u.Username}?`;
    if (!confirm(confirmMsg)) return;

    setActionInProgress(u.User_ID);
    try {
      if (u.Is_Blocked) {
        await unblockUser(u.User_ID);
        notify(`Учетная запись ${u.Username} успешно разблокирована`);
      } else {
        await blockUser(u.User_ID);
        notify(`Учетная запись ${u.Username} заблокирована`, 'warning');
      }
      await load();
    } catch (err) {
      notify(err.response?.data?.error?.message || 'Ошибка изменения статуса блокировки', 'error');
    } finally {
      setActionInProgress(null);
    }
  }

  // Прецедент: Добавление модератора
  async function onAssignModerator(u) {
    if (!confirm(`Назначить пользователя ${u.Username} модератором Додзё?`)) return;
    setActionInProgress(u.User_ID);
    try {
      await changeUserRole(u.User_ID, 'moderator');
      notify(`Пользователю ${u.Username} присвоена роль Модератора`);
      await load();
    } catch (err) {
      notify(err.response?.data?.error?.message || 'Ошибка назначения роли модератора', 'error');
    } finally {
      setActionInProgress(null);
    }
  }

  // Прецедент: Удаление модератора
  async function onRevokeModerator(u) {
    if (!confirm(`Снять статус модератора с пользователя ${u.Username}?`)) return;
    setActionInProgress(u.User_ID);
    try {
      await changeUserRole(u.User_ID, 'user');
      notify(`Роль модератора снята с пользователя ${u.Username}`);
      await load();
    } catch (err) {
      notify(err.response?.data?.error?.message || 'Ошибка изменения роли', 'error');
    } finally {
      setActionInProgress(null);
    }
  }

  // Управление ролью администратора
  async function onToggleAdmin(u) {
    const isTargetAdmin = u.Role?.Role_Name === 'admin';
    const newRole = isTargetAdmin ? 'user' : 'admin';
    if (!confirm(`${isTargetAdmin ? 'Снять права администратора с' : 'Назначить администратором'} ${u.Username}?`)) return;
    setActionInProgress(u.User_ID);
    try {
      await changeUserRole(u.User_ID, newRole);
      notify(`Роль пользователя ${u.Username} изменена на: ${newRole}`);
      await load();
    } catch (err) {
      notify(err.response?.data?.error?.message || 'Ошибка изменения роли администратора', 'error');
    } finally {
      setActionInProgress(null);
    }
  }

  // Удаление пользователя
  async function onDelete(u) {
    if (u.Role?.Role_Name === 'admin' && !isAdmin) {
      alert('Модератор не может удалить учетную запись администратора.');
      return;
    }
    if (!confirm(`Удалить учетную запись пользователя ${u.Username} без возможности восстановления?`)) return;
    setActionInProgress(u.User_ID);
    try {
      await deleteUser(u.User_ID);
      notify(`Учетная запись ${u.Username} удалена`);
      await load();
    } catch (err) {
      notify(err.response?.data?.error?.message || 'Не удалось удалить пользователя', 'error');
    } finally {
      setActionInProgress(null);
    }
  }

  // Клиентская фильтрация по статусу блокировки
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter === 'active' && u.Is_Blocked) return false;
      if (statusFilter === 'blocked' && !u.Is_Blocked) return false;
      return true;
    });
  }, [users, statusFilter]);

  return (
    <div className="admin-users-page">
      {notice && (
        <div className={`admin-alert-banner admin-alert-banner--${notice.type}`}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      {/* Панель поиска и фильтров */}
      <div className="admin-controls-card">
        <div className="admin-controls-card__grid">
          <div className="admin-field-wrap">
            <label>Поиск пользователя</label>
            <input
              className="admin-input"
              placeholder="Поиск по логину, имени или email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="admin-field-wrap">
            <label>Фильтр по роли</label>
            <select
              className="admin-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">Все роли</option>
              <option value="user">Пользователи</option>
              <option value="moderator">Модераторы</option>
              <option value="admin">Администраторы</option>
            </select>
          </div>

          <div className="admin-field-wrap">
            <label>Статус аккаунта</label>
            <select
              className="admin-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Все статусы</option>
              <option value="active">Только активные</option>
              <option value="blocked">Только заблокированные</option>
            </select>
          </div>
        </div>

        <div className="admin-controls-card__footer">
          <span className="admin-counter-pill">
            Найдено: <strong>{filteredUsers.length}</strong> каратэк
          </span>
          <button type="button" className="btn btn-subtle" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'admin-spin' : ''} />
            <span>{loading ? 'Обновление…' : 'Обновить'}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <p className="loading">Загрузка учетных записей…</p>
      ) : filteredUsers.length === 0 ? (
        <div className="admin-empty-box">
          <p>Пользователи с указанными критериями не найдены.</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-users-table">
            <thead>
              <tr>
                <th style={{ width: '18%' }}>Каратэка</th>
                <th style={{ width: '18%' }}>Email</th>
                <th style={{ width: '11%' }}>Роль</th>
                <th style={{ width: '11%' }}>Статус</th>
                <th style={{ width: '9%' }}>Регистрация</th>
                <th style={{ width: '33%', textAlign: 'right' }}>Действия управления</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isTargetAdmin = u.Role?.Role_Name === 'admin';
                const isTargetModerator = u.Role?.Role_Name === 'moderator';
                const isSelf = u.User_ID === currentUser?.User_ID;
                const isBusy = actionInProgress === u.User_ID;

                return (
                  <tr key={u.User_ID}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="admin-user-avatar">
                          {(u.Display_Name || u.Username || 'U')[0].toUpperCase()}
                        </div>
                        <div className="admin-user-names">
                          <span className="admin-user-login">{u.Username}</span>
                          {u.Display_Name && u.Display_Name !== u.Username && (
                            <span className="admin-user-display">{u.Display_Name}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="admin-user-email" title={u.Email}>
                        {u.Email}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`admin-role-badge ${
                          isTargetAdmin
                            ? 'admin-role-badge--admin'
                            : isTargetModerator
                            ? 'admin-role-badge--moderator'
                            : 'admin-role-badge--user'
                        }`}
                      >
                        {isTargetAdmin
                          ? 'Администратор'
                          : isTargetModerator
                          ? 'Модератор'
                          : 'Пользователь'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`admin-status-badge ${
                          u.Is_Blocked ? 'admin-status-badge--blocked' : 'admin-status-badge--active'
                        }`}
                      >
                        <span className="admin-status-dot" />
                        <span>{u.Is_Blocked ? 'Заблокирован' : 'Активен'}</span>
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(u.Created_At).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="admin-actions-cell">
                      <div className="admin-row-actions">
                        {/* 1. Блокировка / Разблокировка учетной записи (Прецедент UML) */}
                        <button
                          type="button"
                          className={`btn ${u.Is_Blocked ? 'btn-success' : 'btn-warning'} btn-sm`}
                          onClick={() => onToggleBlock(u)}
                          disabled={isBusy || isSelf}
                          title={u.Is_Blocked ? 'Разблокировать доступ к аккаунту' : 'Заблокировать доступ к аккаунту'}
                        >
                          {u.Is_Blocked ? (
                            <>
                              <Unlock size={12} />
                              <span>Разблок</span>
                            </>
                          ) : (
                            <>
                              <Lock size={12} />
                              <span>Блок</span>
                            </>
                          )}
                        </button>

                        {/* 2. Добавление / Удаление модератора (Прецедент UML) */}
                        {isTargetModerator ? (
                          <button
                            type="button"
                            className="btn btn-subtle btn-sm"
                            onClick={() => onRevokeModerator(u)}
                            disabled={isBusy}
                            title="Снять статус модератора (перевести в обычные пользователи)"
                          >
                            <ShieldAlert size={12} />
                            <span>Снять</span>
                          </button>
                        ) : !isTargetAdmin ? (
                          <button
                            type="button"
                            className="btn btn-info btn-sm"
                            onClick={() => onAssignModerator(u)}
                            disabled={isBusy}
                            title="Назначить модератором Додзё"
                          >
                            <ShieldCheck size={12} />
                            <span>Модератор</span>
                          </button>
                        ) : null}

                        {/* 3. Управление ролью администратора */}
                        {!isSelf && (
                          <button
                            type="button"
                            className="btn btn-gold btn-sm"
                            onClick={() => onToggleAdmin(u)}
                            disabled={isBusy}
                            title={isTargetAdmin ? 'Снять права администратора' : 'Сделать администратором системы'}
                          >
                            <Crown size={12} />
                            <span>{isTargetAdmin ? 'Снять' : 'Админ'}</span>
                          </button>
                        )}

                        {/* 4. Удаление учетной записи */}
                        {!isSelf && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => onDelete(u)}
                            disabled={isBusy}
                            title="Удалить пользователя из системы"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
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
