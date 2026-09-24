import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container section" style={{ textAlign: 'center', padding: '100px 0' }}>
      <p className="hanko">迷</p>
      <h1 style={{ margin: '16px 0' }}>Страница не найдена</h1>
      <p style={{ color: 'var(--washi-dim)', marginBottom: 20 }}>Похоже, этот путь ведёт в никуда.</p>
      <Link to="/" className="btn btn-primary">На главную</Link>
    </div>
  );
}
