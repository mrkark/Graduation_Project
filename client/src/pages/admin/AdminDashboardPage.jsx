import { useEffect, useState } from 'react';
import { fetchStats } from '../../api/admin';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchStats().then(setStats);
  }, []);

  if (!stats) return <p className="loading">Загрузка статистики…</p>;

  const cards = [
    { label: 'Пользователей', value: stats.users },
    { label: 'Заблокировано', value: stats.blockedUsers },
    { label: 'Ката всего', value: stats.kataTotal },
    { label: 'Ката на модерации', value: stats.kataPending },
    { label: 'Бункаев всего', value: stats.bunkaiTotal },
    { label: 'Бункаев на модерации', value: stats.bunkaiPending },
    { label: 'Комментариев', value: stats.comments },
  ];

  return (
    <div>
      <div className="stat-grid">
        {cards.map((c) => (
          <div className="stat-card" key={c.label}>
            <div className="stat-card__value">{c.value}</div>
            <div className="stat-card__label">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
