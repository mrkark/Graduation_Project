import { useEffect, useState } from 'react';
import { adminApi } from '../../api/endpoints';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    adminApi.stats().then((r) => setStats(r.data.data));
  }, []);

  if (!stats) return <div className="page-loader">Загрузка статистики…</div>;

  const items = [
    { label: 'Пользователи', value: stats.usersCount },
    { label: 'Ката', value: stats.kataCount },
    { label: 'Бункай', value: stats.bunkaiCount },
    { label: 'Комментарии', value: stats.commentsCount },
    { label: 'На модерации', value: stats.pendingCount },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Дашборд</h1>
      <div className="stat-grid">
        {items.map((it) => (
          <div key={it.label} className="washi-panel stat-card">
            <div className="stat-value">{it.value}</div>
            <div className="stat-label">{it.label}</div>
          </div>
        ))}
      </div>
      <div className="washi-panel" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 10 }}>Активность за 14 дней</h3>
        <p style={{ color: 'var(--washi-dim)', fontSize: '0.88rem' }}>
          Новых бункай добавлено: {stats.recentBunkai?.length ?? 0}
        </p>
      </div>
    </div>
  );
}
