import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listBunkai } from '../api/bunkai';
import StatusBadge from '../components/StatusBadge';
import { resolveMediaUrl } from '../utils/media';

const DIFFICULTY_CONFIG = {
  beginner: { label: 'Базовый', belt: 'Начальный' },
  intermediate: { label: 'Средний', belt: 'Средний' },
  advanced: { label: 'Продвинутый', belt: 'Продвинутый' },
  master: { label: 'Мастерский', belt: 'Мастерский' },
};

export default function BunkaiListPage() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 12 });
  const [loading, setLoading] = useState(true);

  const search = params.get('search') || '';
  const sort = params.get('sort') || 'newest';
  const page = Number(params.get('page') || 1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listBunkai({ search, sort, page })
      .then((res) => {
        if (cancelled) return;
        setItems(res.data);
        setMeta(res.meta);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [search, sort, page]);

  function updateParam(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set('page', '1');
    setParams(next);
  }

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));

  return (
    <div className="container">
      {/* 1. ЗАГОЛОВОК СТРАНИЦЫ */}
      <div className="page-header">
        <div>
          <h1>Каталог разборов бункай</h1>
          <p className="page-subtitle">Практическое применение движений ката против противников (Оё-бункай)</p>
        </div>
        <Link to="/bunkai/new" className="btn btn-primary">
          + Создать бункай в студии
        </Link>
      </div>

      {/* 2. ПАНЕЛЬ ПОИСКА */}
      <div className="toolbar">
        <div className="field field--grow">
          <input
            value={search}
            onChange={(e) => updateParam('search', e.target.value)}
            placeholder="Поиск по названию или технике (сюто-укэ, залом запястья, контратака)…"
          />
        </div>
        <div className="field" style={{ flex: '0 0 200px' }}>
          <select value={sort} onChange={(e) => updateParam('sort', e.target.value)}>
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
            <option value="title">По названию</option>
          </select>
        </div>
      </div>

      {/* 3. КАРТОЧКИ БУНКАЙ */}
      {loading ? (
        <p className="loading">Загрузка каталога бункаев…</p>
      ) : items.length === 0 ? (
        <p className="empty-state">Разборы бункай не найдены.</p>
      ) : (
        <div className="grid grid-cards">
          {items.map((b) => {
            const conf = DIFFICULTY_CONFIG[b.Difficulty] || {
              label: b.Difficulty,
              belt: 'Бункай',
            };
            return (
              <Link to={`/bunkai/${b.Bunkai_ID}`} key={b.Bunkai_ID} className="card">
                <div
                  className="card__thumb"
                  style={
                    b.Thumbnail_URL
                      ? { backgroundImage: `url("${resolveMediaUrl(b.Thumbnail_URL)}")` }
                      : undefined
                  }
                >
                  <span className="card__belt-badge">
                    {conf.belt}
                  </span>
                  {!b.Thumbnail_URL && (
                    <div className="card__fallback">
                      <span className="card__kanji">分解</span>
                      <span>Бункай</span>
                    </div>
                  )}
                </div>

                <div className="card__body">
                  <div className="card__meta">
                    <StatusBadge status={b.Status} />
                    {b.Kata && <span>Ката: {b.Kata.Title}</span>}
                  </div>

                  <h3 className="card__title">{b.Title}</h3>

                  <p className="card__desc">
                    {b.Description || 'Боевой разбор канонического движения против нападающего.'}
                  </p>

                  <div className="card__meta card__meta--footer">
                    <span>{conf.label}</span>
                    <span className="card__view-action">3D симуляция →</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* 4. ПАГИНАЦИЯ */}
      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              className={`btn ${p === page ? 'btn-primary' : ''}`}
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
