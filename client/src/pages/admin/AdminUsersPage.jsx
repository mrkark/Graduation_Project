import { useEffect, useState } from 'react';
import { listUsers, blockUser, unblockUser, changeUserRole, deleteUser } from '../../api/admin';

export default function AdminUsersPage() {
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
            {users.map((u) => (
              <tr key={u.User_ID}>
                <td>{u.Username}</td>
                <td>{u.Email}</td>
                <td>{u.Role?.Role_Name}</td>
                <td>{u.Is_Blocked ? 'Заблокирован' : 'Активен'}</td>
                <td>{new Date(u.Created_At).toLocaleDateString('ru-RU')}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn" onClick={() => onBlock(u)}>
                      {u.Is_Blocked ? 'Разблокировать' : 'Заблокировать'}
                    </button>
                    <button className="btn btn-gold" onClick={() => onRole(u)}>
                      {u.Role?.Role_Name === 'admin' ? 'Снять админа' : 'Сделать админом'}
                    </button>
                    <button className="btn btn-danger" onClick={() => onDelete(u)}>
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
