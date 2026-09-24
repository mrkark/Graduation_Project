import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api/endpoints';
import BunkaiCard from '../components/ui/BunkaiCard';

export default function Profile() {
  const { user } = useAuth();
  const [myBunkai, setMyBunkai] = useState([]);

  useEffect(() => {
    userApi.myBunkai().then((r) => setMyBunkai(r.data.data));
  }, []);

  if (!user) return null;

  return (
    <div className="container section">
      <div className="profile-head">
        <div className="profile-avatar">{user.username[0].toUpperCase()}</div>
        <div>
          <h1>{user.username}</h1>
          <p style={{ color: 'var(--washi-dim)' }}>{user.email} · Репутация: {user.reputation}</p>
        </div>
      </div>

      <h3 style={{ marginBottom: 16 }}>Мои бункай</h3>
      <div className="card-grid">
        {myBunkai.map((b) => (
          <BunkaiCard key={b.id} bunkai={b} />
        ))}
        {myBunkai.length === 0 && <p style={{ color: 'var(--washi-dim)' }}>Вы ещё не добавили ни одного бункай.</p>}
      </div>
    </div>
  );
}
