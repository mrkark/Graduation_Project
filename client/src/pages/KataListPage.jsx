import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listKata } from '../api/kata';
import { useAuthStore } from '../store/authStore';
import StatusBadge from '../components/StatusBadge';
import { resolveMediaUrl } from '../utils/media';

const DIFFICULTY_LABELS = { beginner: 'Начальный', intermediate: 'Средний', advanced: 'Продвинутый', master: 'Мастер' };

export default function KataListPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 12 });
  const [loading, setLoading] = useState(true);

  const search = params.get('search') || '';
  const difficulty = params.get('difficulty') || '';
  const sort = params.get('sort') || 'newest';
  const page = Number(params.get('page') || 1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listKata({ search, difficulty, sort, page })
      .then((res) => {
        if (cancelled) return;
        setItems(res.data);
        setMeta(res.meta);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [search, difficulty, sort, page]);

  function updateParam(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set('page', '1');
    setParams(next);
  }

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Каталог ката</h1>
          <p className="page-subtitle">26 канонических форм стиля Шотокан (松濤館流) и их изучение</p>
        </div>
        {isAdmin && (
          <Link to="/kata/create" className="btn btn-primary">
            + Добавить ката
          </Link>
        )}
      </div>

      <div className="toolbar">
        <div className="field field--grow">
          <label>Поиск по названию</label>
          <input value={search} onChange={(e) => updateParam('search', e.target.value)} placeholder="Хэйан Шодан…" />
        </div>
        <div className="field">
          <label>Сложность</label>
          <select value={difficulty} onChange={(e) => updateParam('difficulty', e.target.value)}>
            <option value="">Любая</option>
            {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Сортировка</label>
          <select value={sort} onChange={(e) => updateParam('sort', e.target.value)}>
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
            <option value="title">По названию</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="loading">Загрузка каталога…</p>
      ) : items.length === 0 ? (
        <p className="empty-state">Ничего не найдено. Попробуйте изменить параметры поиска.</p>
      ) : (
        <div className="grid grid-cards">
          {items.map((kata) => (
            <Link to={`/kata/${kata.Kata_ID}`} key={kata.Kata_ID} className="card">
              <div
                className="card__thumb"
                style={kata.Thumbnail_URL ? { backgroundImage: `url("${resolveMediaUrl(kata.Thumbnail_URL)}")` } : undefined}
              >
                {!kata.Thumbnail_URL && '型 Ката'}
              </div>
              <div className="card__body">
                <div className="card__meta">
                  <StatusBadge status={kata.Status} />
                  {kata.Style && <span>{kata.Style}</span>}
                </div>
                <div className="card__title">{kata.Title}</div>
                <p className="card__desc">{kata.Description || 'Описание пока не добавлено.'}</p>
                <div className="card__meta">
                  <span>{DIFFICULTY_LABELS[kata.Difficulty] || kata.Difficulty}</span>
                  <span>{kata.Author?.Display_Name || kata.Author?.Username}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              className={`btn ${p === page ? 'btn-gold' : ''}`}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set('page', String(p));
                setParams(next);
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
