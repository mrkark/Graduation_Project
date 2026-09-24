import { useEffect, useState } from 'react';
import { adminApi } from '../../api/endpoints';

const ROLES = ['user', 'moderator', 'admin'];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [newUser, setNewUser] = useState({ email: '', username: '', password: '', role: 'user' });

  function load() {
    adminApi.listUsers({ search: search || undefined }).then((r) => setUsers(r.data.data.items));
  }
  useEffect(load, [search]);

  async function changeRole(id, role) {
    await adminApi.updateUserRole(id, role);
    load();
  }

  async function toggleBan(u) {
    await adminApi.setUserBan(u.id, !u.isBanned);
    load();
  }

  async function createUser(e) {
    e.preventDefault();
    await adminApi.createUser(newUser);
    setNewUser({ email: '', username: '', password: '', role: 'user' });
    load();
  }

  async function resetPassword(id) {
    const newPassword = prompt('Новый пароль для пользователя:');
    if (!newPassword) return;
    await adminApi.resetPassword(id, newPassword);
    alert('Пароль обновлён');
  }

  return (
    <div>
      <div className="admin-toolbar">
        <h1>Пользователи</h1>
        <input placeholder="Поиск по email/имени" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <form className="washi-panel" style={{ padding: 18, marginBottom: 24 }} onSubmit={createUser}>
        <h3 style={{ marginBottom: 12 }}>Создать пользователя</h3>
        <div className="admin-form-grid">
          <input placeholder="Email" type="email" required value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
          <input placeholder="Имя пользователя" required value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
          <input placeholder="Пароль" type="password" required value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
          <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" type="submit">Создать</button>
      </form>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Имя</th><th>Email</th><th>Роль</th><th>Статус</th><th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>
                <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </td>
              <td>{u.isBanned ? 'Заблокирован' : 'Активен'}</td>
              <td>
                <button className="action-btn" onClick={() => resetPassword(u.id)}>Сбросить пароль</button>
                <button className={`action-btn ${u.isBanned ? '' : 'danger'}`} onClick={() => toggleBan(u)}>
                  {u.isBanned ? 'Разбанить' : 'Забанить'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
