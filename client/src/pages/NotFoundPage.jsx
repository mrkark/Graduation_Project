import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="empty-state">
      <h2>404 · Страница не найдена</h2>
      <p>Такой страницы не существует в додзё.</p>
      <Link to="/" className="btn btn-gold">
        На главную
      </Link>
    </div>
  );
}
