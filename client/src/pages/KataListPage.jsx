import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listKata } from '../api/kata';
import { useAuthStore } from '../store/authStore';
import StatusBadge from '../components/StatusBadge';
import { resolveMediaUrl } from '../utils/media';

const DIFFICULTY_CONFIG = {
  beginner: { label: 'Начальный', belt: 'Белый / Жёлтый пояс', badgeClass: 'belt-badge--yellow' },
  intermediate: { label: 'Средний', belt: 'Зелёный / Синий пояс', badgeClass: 'belt-badge--green' },
  advanced: { label: 'Продвинутый', belt: 'Коричневый пояс', badgeClass: 'belt-badge--brown' },
  master: { label: 'Мастерский', belt: 'Чёрный пояс', badgeClass: 'belt-badge--black' },
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
    <div className="container">
      {/* 1. ЗАГОЛОВОК КАТАЛОГА */}
      <div className="page-header">
        <div>
          <h1>Каталог Ката Сётокан</h1>
          <p className="page-subtitle">26 традиционных форм каратедо: от базовых Хэйан до мастерских высших ката</p>
        </div>
        {isAdmin && (
          <Link to="/kata/create" className="btn btn-primary">
            + Добавить ката
          </Link>
        )}
      </div>

      {/* 2. ПАНЕЛЬ ПОИСКА И СОРТИРОВКИ */}
      <div className="toolbar">
        <div className="field field--grow">
          <input
            value={search}
            onChange={(e) => updateParam('search', e.target.value)}
            placeholder="Поиск ката по названию (Хэйан, Бассай-дай, Канку-дай)…"
          />
        </div>
        <div className="field" style={{ flex: '0 0 200px' }}>
          <select value={sort} onChange={(e) => updateParam('sort', e.target.value)}>
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
            <option value="title">По алфавиту</option>
          </select>
        </div>
      </div>

      {/* 3. ФИЛЬТРЫ РАНГОВ / ПОЯСОВ */}
      <div className="filter-chips">
        <button
          className={`filter-chip ${difficulty === '' ? 'active' : ''}`}
          onClick={() => updateParam('difficulty', '')}
        >
          Все ката ({meta.total || 0})
        </button>
        <button
          className={`filter-chip ${difficulty === 'beginner' ? 'active' : ''}`}
          onClick={() => updateParam('difficulty', difficulty === 'beginner' ? '' : 'beginner')}
        >
          Базовые (Хэйан · 9–7 кю)
        </button>
        <button
          className={`filter-chip ${difficulty === 'intermediate' ? 'active' : ''}`}
          onClick={() => updateParam('difficulty', difficulty === 'intermediate' ? '' : 'intermediate')}
        >
          Средние (Тэкки · 6–4 кю)
        </button>
        <button
          className={`filter-chip ${difficulty === 'advanced' ? 'active' : ''}`}
          onClick={() => updateParam('difficulty', difficulty === 'advanced' ? '' : 'advanced')}
        >
          Продвинутые (3–1 кю)
        </button>
        <button
          className={`filter-chip ${difficulty === 'master' ? 'active' : ''}`}
          onClick={() => updateParam('difficulty', difficulty === 'master' ? '' : 'master')}
        >
          Мастерские (Дан)
        </button>
      </div>

      {/* 4. СПИСОК КАРТОЧЕК КАТА */}
      {loading ? (
        <p className="loading">Загрузка каталога ката…</p>
      ) : items.length === 0 ? (
        <p className="empty-state">Ката по заданным параметрам не найдены.</p>
      ) : (
        <div className="grid grid-cards">
          {items.map((kata) => {
            const conf = DIFFICULTY_CONFIG[kata.Difficulty] || {
              label: kata.Difficulty,
              belt: 'Сётокан',
              badgeClass: '',
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
                    {kata.Style && <span>{kata.Style}</span>}
                  </div>

                  <h3 className="card__title">{kata.Title}</h3>

                  <p className="card__desc">
                    {kata.Description || 'Каноническая последовательность движений стиля Сётокан.'}
                  </p>

                  <div className="card__meta card__meta--footer">
                    <span>{conf.label}</span>
                    <span className="card__view-action">Изучить в 3D →</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* 5. ПАГИНАЦИЯ */}
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
