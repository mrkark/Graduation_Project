import { useEffect, useState } from 'react';
import { listUsers, blockUser, unblockUser, changeUserRole, deleteUser } from '../../api/admin';
import { useAuthStore } from '../../store/authStore';

export default function AdminUsersPage() {
  const { role, user: currentUser } = useAuthStore();
  const isAdmin = role === 'admin';
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await listUsers({ search, role: roleFilter || undefined });
    setUsers(res.data || []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter]);

  async function onBlock(u) {
    await (u.Is_Blocked ? unblockUser(u.User_ID) : blockUser(u.User_ID));
    load();
  }

  // Добавление модератора (Диаграмма прецедентов роли «Администратор»)
  async function onAssignModerator(u) {
    if (!confirm(`Назначить пользователя ${u.Username} модератором Додзё?`)) return;
    await changeUserRole(u.User_ID, 'moderator');
    load();
  }

  // Удаление модератора (Диаграмма прецедентов роли «Администратор»)
  async function onRevokeModerator(u) {
    if (!confirm(`Снять статус модератора с пользователя ${u.Username}?`)) return;
    await changeUserRole(u.User_ID, 'user');
    load();
  }

  // Управление ролью администратора
  async function onToggleAdmin(u) {
    const newRole = u.Role?.Role_Name === 'admin' ? 'user' : 'admin';
    if (!confirm(`Назначить роль «${newRole}» пользователю ${u.Username}?`)) return;
    await changeUserRole(u.User_ID, newRole);
    load();
  }

  async function onDelete(u) {
    if (u.Role?.Role_Name === 'admin' && !isAdmin) {
      alert('Модератор не может удалить учетную запись администратора.');
      return;
    }
    if (!confirm(`Удалить пользователя ${u.Username} без возможности восстановления?`)) return;
    await deleteUser(u.User_ID);
    load();
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.2rem', alignItems: 'center' }}>
        <div className="field" style={{ maxWidth: 320, margin: 0 }}>
          <input
            placeholder="Поиск по логину или email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="field" style={{ maxWidth: 200, margin: 0 }}>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">Все роли</option>
            <option value="user">Пользователи</option>
            <option value="moderator">Модераторы</option>
            <option value="admin">Администраторы</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="loading">Загрузка каратэк…</p>
      ) : users.length === 0 ? (
        <p className="empty-state">Пользователи не найдены.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Логин</th>
              <th>Имя в Додзё</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Статус</th>
              <th>Регистрация</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isTargetAdmin = u.Role?.Role_Name === 'admin';
              const isTargetModerator = u.Role?.Role_Name === 'moderator';
              const isSelf = u.User_ID === currentUser?.User_ID;
              const canDelete = !isSelf && (isAdmin || !isTargetAdmin);

              return (
                <tr key={u.User_ID}>
                  <td><strong>{u.Username}</strong></td>
                  <td>{u.Display_Name || '—'}</td>
                  <td>{u.Email}</td>
                  <td>
                    <span
                      className={`badge ${
                        isTargetAdmin
                          ? 'badge--gold'
                          : isTargetModerator
                          ? 'badge--info'
                          : ''
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
                    <span style={{ color: u.Is_Blocked ? 'var(--vermilion, #dc2626)' : 'var(--text-muted)' }}>
                      {u.Is_Blocked ? '⛔ Заблокирован' : '✔ Активен'}
                    </span>
                  </td>
                  <td>{new Date(u.Created_At).toLocaleDateString('ru-RU')}</td>
                  <td>
                    <div className="row-actions">
                      {isAdmin && (
                        <>
                          {/* Блокировка / Разблокировка учетной записи */}
                          <button
                            type="button"
                            className={`btn ${u.Is_Blocked ? 'btn-primary' : ''}`}
                            onClick={() => onBlock(u)}
                            title={u.Is_Blocked ? 'Разблокировать доступ' : 'Заблокировать доступ'}
                          >
                            {u.Is_Blocked ? 'Разблокировать' : 'Блокировать'}
                          </button>

                          {/* Добавление / Удаление модератора (Диаграмма прецедентов) */}
                          {isTargetModerator ? (
                            <button
                              type="button"
                              className="btn btn-subtle"
                              onClick={() => onRevokeModerator(u)}
                              title="Удаление модератора (перевести в обычные пользователи)"
                            >
                              Снять модератора
                            </button>
                          ) : !isTargetAdmin ? (
                            <button
                              type="button"
                              className="btn btn-info"
                              style={{ borderColor: 'var(--accent-blue, #0284c7)' }}
                              onClick={() => onAssignModerator(u)}
                              title="Добавление модератора (назначить модератором Додзё)"
                            >
                              + Модератор
                            </button>
                          ) : null}

                          {/* Админ-права */}
                          {!isSelf && (
                            <button
                              type="button"
                              className="btn btn-gold"
                              onClick={() => onToggleAdmin(u)}
                              title={isTargetAdmin ? 'Снять права администратора' : 'Сделать администратором'}
                            >
                              {isTargetAdmin ? 'Снять админа' : 'Сделать админом'}
                            </button>
                          )}
                        </>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => onDelete(u)}
                          title="Удалить пользователя"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
