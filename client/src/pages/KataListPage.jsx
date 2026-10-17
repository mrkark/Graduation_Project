import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listKata } from '../api/kata';
import { useAuthStore } from '../store/authStore';
import StatusBadge from '../components/StatusBadge';
import { resolveMediaUrl } from '../utils/media';

const DIFFICULTY_CONFIG = {
  beginner: { label: 'Начальный', belt: 'Белый / Желтый', badgeClass: 'belt-white', kanji: '初段' },
  intermediate: { label: 'Средний', belt: 'Зеленый / Синий', badgeClass: 'belt-green', kanji: '中段' },
  advanced: { label: 'Продвинутый', belt: 'Коричневый', badgeClass: 'belt-brown', kanji: '上段' },
  master: { label: 'Мастер', belt: 'Черный пояс', badgeClass: 'belt-black', kanji: '奥伝' },
};

const DIFFICULTY_LABELS = {
  beginner: 'Начальный (Кю 9-7)',
  intermediate: 'Средний (Кю 6-4)',
  advanced: 'Продвинутый (Кю 3-1)',
  master: 'Мастер (Дан 1-5)',
};

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
          <p className="page-subtitle">26 канонических форм стиля Шотокан (松濤館流) и их 3D разбор</p>
        </div>
        {isAdmin && (
          <Link to="/kata/create" className="btn btn-primary">
            + Добавить ката
          </Link>
        )}
      </div>

      <div className="toolbar">
        <div className="field field--grow">
          <label>Поиск по названию или кандзи</label>
          <input value={search} onChange={(e) => updateParam('search', e.target.value)} placeholder="Хэйан Шодан, Бассай-дай…" />
        </div>
        <div className="field">
          <label>Ранг / Пояс</label>
          <select value={difficulty} onChange={(e) => updateParam('difficulty', e.target.value)}>
            <option value="">Все уровни</option>
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

      {/* Быстрые фильтры по поясам */}
      <div className="filter-chips">
        <button
          className={`filter-chip ${difficulty === '' ? 'active' : ''}`}
          onClick={() => updateParam('difficulty', '')}
        >
          Все ({meta.total || 0})
        </button>
        <button
          className={`filter-chip ${difficulty === 'beginner' ? 'active' : ''}`}
          onClick={() => updateParam('difficulty', difficulty === 'beginner' ? '' : 'beginner')}
        >
          ⚪ Начальный (Белый/Желтый)
        </button>
        <button
          className={`filter-chip ${difficulty === 'intermediate' ? 'active' : ''}`}
          onClick={() => updateParam('difficulty', difficulty === 'intermediate' ? '' : 'intermediate')}
        >
          🟢 Средний (Зеленый/Синий)
        </button>
        <button
          className={`filter-chip ${difficulty === 'advanced' ? 'active' : ''}`}
          onClick={() => updateParam('difficulty', difficulty === 'advanced' ? '' : 'advanced')}
        >
          🟤 Продвинутый (Коричневый)
        </button>
        <button
          className={`filter-chip ${difficulty === 'master' ? 'active' : ''}`}
          onClick={() => updateParam('difficulty', difficulty === 'master' ? '' : 'master')}
        >
          ⚫ Мастер (Черный пояс)
        </button>
      </div>

      {loading ? (
        <p className="loading">Загрузка каталога ката…</p>
      ) : items.length === 0 ? (
        <p className="empty-state">Ката не найдены. Попробуйте сбросить фильтры.</p>
      ) : (
        <div className="grid grid-cards">
          {items.map((kata) => {
            const conf = DIFFICULTY_CONFIG[kata.Difficulty] || {
              label: kata.Difficulty,
              belt: 'Шотокан',
              badgeClass: 'belt-white',
              kanji: '型',
            };
            return (
              <Link to={`/kata/${kata.Kata_ID}`} key={kata.Kata_ID} className="card">
                <div
                  className="card__thumb"
                  style={kata.Thumbnail_URL ? { backgroundImage: `url("${resolveMediaUrl(kata.Thumbnail_URL)}")` } : undefined}
                >
                  <span className={`card__belt-badge ${conf.badgeClass}`}>
                    {conf.belt}
                  </span>
                  <span className="card__kanji-seal">
                    {conf.kanji}
                  </span>
                  {!kata.Thumbnail_URL && (
                    <div className="card__fallback">
                      <span className="card__kanji">型</span>
                      <span>Ката</span>
                    </div>
                  )}
                </div>
                <div className="card__body">
                  <div className="card__meta">
                    <StatusBadge status={kata.Status} />
                    {kata.Style && <span style={{ color: 'var(--gold)' }}>🥋 {kata.Style}</span>}
                  </div>
                  <div className="card__title">{kata.Title}</div>
                  <p className="card__desc">{kata.Description || 'Каноническая форма карате Шотокан.'}</p>
                  <div className="card__meta card__meta--footer">
                    <span style={{ color: 'var(--washi-dim)', fontSize: '0.78rem' }}>{conf.label}</span>
                    <span className="card__view-action">3D разбор →</span>
                  </div>
                </div>
              </Link>
            );
          })}
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
