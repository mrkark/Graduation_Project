import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listBunkai } from '../api/bunkai';
import StatusBadge from '../components/StatusBadge';

const DIFFICULTY_LABELS = { beginner: 'Начальный', intermediate: 'Средний', advanced: 'Продвинутый', master: 'Мастер' };

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
    <div>
      <div className="page-header">
        <h1>Каталог бункаев</h1>
        <Link to="/bunkai/create" className="btn btn-primary">
          + Добавить бункай
        </Link>
      </div>

      <div className="toolbar">
        <div className="field field--grow">
          <label>Поиск по названию</label>
          <input value={search} onChange={(e) => updateParam('search', e.target.value)} placeholder="Разбор блока…" />
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
        <p className="empty-state">Ничего не найдено.</p>
      ) : (
        <div className="grid grid-cards">
          {items.map((b) => (
            <Link to={`/bunkai/${b.Bunkai_ID}`} key={b.Bunkai_ID} className="card">
              <div className="card__thumb" style={b.Thumbnail_URL ? { backgroundImage: `url(${b.Thumbnail_URL})` } : undefined}>
                {!b.Thumbnail_URL && '分解 Бункай'}
              </div>
              <div className="card__body">
                <div className="card__meta">
                  <StatusBadge status={b.Status} />
                  {b.Kata && <span>{b.Kata.Title}</span>}
                </div>
                <div className="card__title">{b.Title}</div>
                <p className="card__desc">{b.Description || 'Описание пока не добавлено.'}</p>
                <div className="card__meta">
                  <span>{DIFFICULTY_LABELS[b.Difficulty] || b.Difficulty}</span>
                  <span>{b.Author?.Display_Name || b.Author?.Username}</span>
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
