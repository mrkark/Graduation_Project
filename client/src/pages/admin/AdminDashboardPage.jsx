import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchStats } from '../../api/admin';
import { useAuthStore } from '../../store/authStore';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const role = useAuthStore((s) => s.role);
  const isAdmin = role === 'admin';

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return <p className="loading">Загрузка аналитики системы…</p>;
  }

  return (
    <div className="admin-dashboard">
      {/* 1. БЛОК СТАТУСА СИСТЕМЫ */}
      <div className="admin-welcome-card">
        <div className="admin-welcome-card__header">
          <div>
            <h2>{isAdmin ? 'Центр управления системой' : 'Рабочее место модератора'}</h2>
            <p>
              {isAdmin
                ? 'Мониторинг безопасности, учетных записей, журнала аудита и состояния контента'
                : 'Контроль входящих публикаций боевых сценариев бункай и сообщений пользователей'}
            </p>
          </div>
          <div className="admin-status-indicator">
            <span className="admin-status-pulse" />
            <span>Сервер БД: В сети</span>
          </div>
        </div>
      </div>

      {/* 2. СЕТКА КЛЮЧЕВЫХ МЕТРИК */}
      <div className="admin-metrics-grid">
        {isAdmin ? (
          <>
            <div className="admin-metric-card">
              <div className="admin-metric-card__icon">👥</div>
              <div className="admin-metric-card__body">
                <span className="admin-metric-card__val">{stats.users}</span>
                <span className="admin-metric-card__lbl">Пользователей</span>
                <span className="admin-metric-card__sub">
                  {stats.blockedUsers > 0 ? `⛔ Заблокировано: ${stats.blockedUsers}` : '✔ Блокировок нет'}
                </span>
              </div>
            </div>

            <div className="admin-metric-card admin-metric-card--alert">
              <div className="admin-metric-card__icon">⚔️</div>
              <div className="admin-metric-card__body">
                <span className="admin-metric-card__val">{stats.bunkaiPending || 0}</span>
                <span className="admin-metric-card__lbl">Бункаев на модерации</span>
                <span className="admin-metric-card__sub">Всего сценариев: {stats.bunkaiTotal}</span>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="admin-metric-card__icon">💬</div>
              <div className="admin-metric-card__body">
                <span className="admin-metric-card__val">{stats.comments || 0}</span>
                <span className="admin-metric-card__lbl">Комментариев в Додзё</span>
                <span className="admin-metric-card__sub">Доступны для проверки</span>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="admin-metric-card__icon">🥋</div>
              <div className="admin-metric-card__body">
                <span className="admin-metric-card__val">{stats.kataTotal || 26}</span>
                <span className="admin-metric-card__lbl">Форм Ката Сётокан</span>
                <span className="admin-metric-card__sub">
                  {stats.kataPending > 0 ? `На проверке: ${stats.kataPending}` : '✔ База укомплектована'}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="admin-metric-card admin-metric-card--alert">
              <div className="admin-metric-card__icon">⚔️</div>
              <div className="admin-metric-card__body">
                <span className="admin-metric-card__val">{stats.bunkaiPending || 0}</span>
                <span className="admin-metric-card__lbl">Бункаев ждут проверки</span>
                <span className="admin-metric-card__sub">Требуют утверждения или отклонения</span>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="admin-metric-card__icon">✔</div>
              <div className="admin-metric-card__body">
                <span className="admin-metric-card__val">{stats.bunkaiTotal || 0}</span>
                <span className="admin-metric-card__lbl">Опубликованных бункаев</span>
                <span className="admin-metric-card__sub">Доступно всем каратэкам</span>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="admin-metric-card__icon">💬</div>
              <div className="admin-metric-card__body">
                <span className="admin-metric-card__val">{stats.comments || 0}</span>
                <span className="admin-metric-card__lbl">Комментариев</span>
                <span className="admin-metric-card__sub">В каталогах ката и бункай</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3. БЫСТРЫЕ ДЕЙСТВИЯ (СОГЛАСНО ДИАГРАММАМ ПРЕЦЕДЕНТОВ) */}
      <div className="admin-section-header">
        <h3>Быстрый доступ к операциям</h3>
      </div>

      <div className="admin-quick-actions-grid">
        {isAdmin ? (
          <>
            <Link to="/admin/users" className="admin-action-card">
              <div className="admin-action-card__icon">👥</div>
              <div className="admin-action-card__info">
                <h4>Управление учетными записями</h4>
                <p>Блокировка и разблокировка доступа, назначение и снятие модераторов Додзё</p>
                <span className="admin-action-card__link">Открыть пользователей →</span>
              </div>
            </Link>

            <Link to="/admin/logs" className="admin-action-card">
              <div className="admin-action-card__icon">📜</div>
              <div className="admin-action-card__info">
                <h4>Журнал системного аудита</h4>
                <p>Мониторинг событий и фильтрация по дате, пользователю, IP и коду действия</p>
                <span className="admin-action-card__link">Смотреть журнал →</span>
              </div>
            </Link>

            <Link to="/admin/backups" className="admin-action-card">
              <div className="admin-action-card__icon">💾</div>
              <div className="admin-action-card__info">
                <h4>Резервные копии БД</h4>
                <p>Создание полных сжатых резервных копий Microsoft SQL Server</p>
                <span className="admin-action-card__link">Управление копиями →</span>
              </div>
            </Link>

            <Link to="/admin/bunkai" className="admin-action-card">
              <div className="admin-action-card__icon">⚔️</div>
              <div className="admin-action-card__info">
                <h4>Модерация бункай</h4>
                <p>Утверждение и отклонение боевых сценариев, присланных учениками</p>
                <span className="admin-action-card__link">К модерации ({stats.bunkaiPending || 0}) →</span>
              </div>
            </Link>
          </>
        ) : (
          <>
            <Link to="/admin/bunkai" className="admin-action-card">
              <div className="admin-action-card__icon">⚔️</div>
              <div className="admin-action-card__info">
                <h4>Модерация бункай</h4>
                <p>Утверждение публикаций боевых сценариев или отклонение с пометкой</p>
                <span className="admin-action-card__link">Перейти к бункай ({stats.bunkaiPending || 0}) →</span>
              </div>
            </Link>

            <Link to="/admin/comments" className="admin-action-card">
              <div className="admin-action-card__icon">💬</div>
              <div className="admin-action-card__info">
                <h4>Модерация комментариев</h4>
                <p>Просмотр всех сообщений пользователей в обсуждениях ката и бункай, удаление нарушений</p>
                <span className="admin-action-card__link">Перейти к комментариям →</span>
              </div>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
