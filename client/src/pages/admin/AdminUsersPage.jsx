import { useEffect, useState } from 'react';
import { listUsers, blockUser, unblockUser, changeUserRole, deleteUser } from '../../api/admin';
import { useAuthStore } from '../../store/authStore';

export default function AdminUsersPage() {
  const { role, user: currentUser } = useAuthStore();
  const isAdmin = role === 'admin';
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await listUsers({ search });
    setUsers(res.data);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function onBlock(u) {
    await (u.Is_Blocked ? unblockUser(u.User_ID) : blockUser(u.User_ID));
    load();
  }
  async function onRole(u) {
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
      <div className="field" style={{ maxWidth: 380, marginBottom: '1rem' }}>
        <input placeholder="Поиск по логину или email…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <p className="loading">Загрузка…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Логин</th>
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
              const isSelf = u.User_ID === currentUser?.User_ID;
              const canDelete = !isSelf && (isAdmin || !isTargetAdmin);

              return (
                <tr key={u.User_ID}>
                  <td>{u.Username}</td>
                  <td>{u.Email}</td>
                  <td>
                    <span className={`badge ${isTargetAdmin ? 'badge--gold' : u.Role?.Role_Name === 'moderator' ? 'badge--info' : ''}`}>
                      {u.Role?.Role_Name}
                    </span>
                  </td>
                  <td>{u.Is_Blocked ? 'Заблокирован' : 'Активен'}</td>
                  <td>{new Date(u.Created_At).toLocaleDateString('ru-RU')}</td>
                  <td>
                    <div className="row-actions">
                      {isAdmin && (
                        <>
                          <button className="btn" onClick={() => onBlock(u)}>
                            {u.Is_Blocked ? 'Разблокировать' : 'Заблокировать'}
                          </button>
                          <button className="btn btn-gold" onClick={() => onRole(u)}>
                            {u.Role?.Role_Name === 'admin' ? 'Снять админа' : 'Сделать админом'}
                          </button>
                        </>
                      )}
                      {canDelete && (
                        <button className="btn btn-danger" onClick={() => onDelete(u)} title="Удалить пользователя">
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
