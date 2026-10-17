import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listKata } from '../api/kata';
import { useAuthStore } from '../store/authStore';
import { resolveMediaUrl } from '../utils/media';
import './KataListPage.css';

const BELT_CATEGORIES = [
  {
    id: 'beginner',
    title: 'Начальная школа (Хэйан)',
    kanji: '平安 · 9–7 Кю',
    description: 'Пять базовых форм для освоения равновесия, базовых блоков и прямолинейных ударов.',
  },
  {
    id: 'intermediate',
    title: 'Уровень стойкости (Тэкки)',
    kanji: '鉄騎 · 6–4 Кю',
    description: 'Боковой бой в низкой стойке Киба-дати, развитие силы бёдер и укороченных траекторий.',
  },
  {
    id: 'advanced',
    title: 'Мастерский прорыв',
    kanji: '強固 · 3–1 Кю',
    description: 'Динамичные ката высокой сложности: Бассай-дай (прорыв крепости), Канку-дай (взгляд в небо), Дзион, Эмпи.',
  },
  {
    id: 'master',
    title: 'Высшие формы мастеров',
    kanji: '奥義 · Даны',
    description: 'Вершина искусства Сётокан: Ганкаку (журавль на скале), Сочин, Нидзюсихо, Унсу, Чинтэ, Мэйкё.',
  },
];

export default function KataListPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('atlas'); // 'atlas' | 'table'
  const [selectedId, setSelectedId] = useState(null);

  const search = params.get('search') || '';
  const sort = params.get('sort') || 'newest';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Загружаем полный реестр 26 ката за один раз через pageSize: 40
    listKata({ search, sort, page: 1, pageSize: 40 })
      .then((res) => {
        if (cancelled) return;
        const kataList = res.data || [];
        setItems(kataList);
        if (kataList.length > 0 && !selectedId) {
          setSelectedId(kataList[0].Kata_ID);
        }
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [search, sort]);

  function updateParam(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  // Активная выбранная ката для блока Spotlight
  const activeKata = useMemo(() => {
    if (!items.length) return null;
    return items.find((k) => k.Kata_ID === selectedId) || items[0];
  }, [items, selectedId]);

  // Группировка ката по павильонам сложности
  const groupedKata = useMemo(() => {
    const groups = {
      beginner: [],
      intermediate: [],
      advanced: [],
      master: [],
    };

    items.forEach((item) => {
      const diff = item.Difficulty || 'beginner';
      if (groups[diff]) {
        groups[diff].push(item);
      } else {
        groups.beginner.push(item);
      }
    });

    return groups;
  }, [items]);

  return (
    <div className="container kata-atlas">
      {/* 1. ВЕРХНИЙ ЭДИЦИОННЫЙ ЗАГОЛОВОК */}
      <header className="atlas-header">
        <div>
          <span className="atlas-header__eyebrow">Сётокан Каратэдо · Традиционный канон</span>
          <h1 className="atlas-header__title">Атлас 26 Ката</h1>
          <p className="atlas-header__subtitle">
            Интерактивный свод канонических форм мастера Гитина Фунакоси: биомеханика, геометрия перемещений и 3D-разбор.
          </p>
        </div>

        <div className="atlas-header__controls">
          <div className="atlas-view-toggle">
            <button
              type="button"
              className={`atlas-view-toggle__btn ${viewMode === 'atlas' ? 'active' : ''}`}
              onClick={() => setViewMode('atlas')}
            >
              Атлас с фокусом
            </button>
            <button
              type="button"
              className={`atlas-view-toggle__btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              Сводный реестр
            </button>
          </div>

          {isAdmin && (
            <Link to="/kata/create" className="btn btn-primary">
              + Создать форму
            </Link>
          )}
        </div>
      </header>

      {/* 2. ПАНЕЛЬ ПОИСКА И СОРТИРОВКИ */}
      <div className="atlas-search-strip">
        <div className="atlas-search-box">
          <input
            type="text"
            className="atlas-search-input"
            value={search}
            onChange={(e) => updateParam('search', e.target.value)}
            placeholder="Поиск по названию ката (Хэйан, Бассай-дай, Канку-дай, Эмпи)…"
          />
        </div>
        <select
          className="atlas-sort-select"
          value={sort}
          onChange={(e) => updateParam('sort', e.target.value)}
        >
          <option value="newest">Сначала новые добавления</option>
          <option value="oldest">Традиционный порядок</option>
          <option value="title">По алфавиту</option>
        </select>
      </div>

      {loading ? (
        <p className="loading">Загрузка атласа ката…</p>
      ) : items.length === 0 ? (
        <p className="empty-state">Ката по заданному запросу не найдены.</p>
      ) : viewMode === 'atlas' ? (
        <>
          {/* 3. ИНТЕРАКТИВНЫЙ ФОКУС ВЫБРАННОЙ КАТА (SPOTLIGHT) */}
          {activeKata && (
            <section className="atlas-spotlight">
              <div className="atlas-spotlight__body">
                <div>
                  <div className="atlas-spotlight__eyebrow">
                    <span className="atlas-spotlight__belt">
                      {activeKata.Difficulty === 'beginner'
                        ? 'Белый / Жёлтый пояс · 9–7 Кю'
                        : activeKata.Difficulty === 'intermediate'
                        ? 'Зелёный / Синий пояс · 6–4 Кю'
                        : activeKata.Difficulty === 'advanced'
                        ? 'Коричневый пояс · 3–1 Кю'
                        : 'Чёрный пояс · Дан'}
                    </span>
                    <span className="atlas-spotlight__kanji-stamp">
                      {activeKata.Title?.includes('(')
                        ? activeKata.Title.split('(')[1]?.replace(')', '')
                        : '型'}
                    </span>
                  </div>

                  <h2 className="atlas-spotlight__title">{activeKata.Title}</h2>
                  <p className="atlas-spotlight__desc">
                    {activeKata.Description ||
                      'Каноническая форма Сётокан с выверенной биомеханикой перемещений и концентрацией силы кимэ.'}
                  </p>
                </div>

                <div>
                  <div className="atlas-spotlight__stats">
                    <div className="atlas-spotlight__stat-item">
                      <span className="atlas-spotlight__stat-val">
                        {activeKata.Steps?.length || (activeKata.Difficulty === 'beginner' ? 21 : 34)}
                      </span>
                      <span className="atlas-spotlight__stat-lbl">Движений формы</span>
                    </div>
                    <div className="atlas-spotlight__stat-item">
                      <span className="atlas-spotlight__stat-val">
                        {activeKata.Style || 'Сётокан'}
                      </span>
                      <span className="atlas-spotlight__stat-lbl">Стиль / Традиция</span>
                    </div>
                    <div className="atlas-spotlight__stat-item">
                      <span className="atlas-spotlight__stat-val">3D</span>
                      <span className="atlas-spotlight__stat-lbl">Анимированный аватар</span>
                    </div>
                  </div>

                  <div className="atlas-spotlight__actions">
                    <Link
                      to={`/kata/${activeKata.Kata_ID}`}
                      className="btn btn-primary"
                    >
                      Запустить 3D-разбор формы →
                    </Link>
                    <Link
                      to={`/bunkai?search=${encodeURIComponent(activeKata.Title?.split(' ')[0] || '')}`}
                      className="btn btn-subtle"
                    >
                      Смотреть бункай этой ката
                    </Link>
                  </div>
                </div>
              </div>

              <div className="atlas-spotlight__visual">
                {activeKata.Thumbnail_URL ? (
                  <img
                    src={resolveMediaUrl(activeKata.Thumbnail_URL)}
                    alt={activeKata.Title}
                    className="atlas-spotlight__img"
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <span style={{ fontSize: '3rem', opacity: 0.3 }}>🥋</span>
                    <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Канонический аватар</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 4. ПАВИЛЬОНЫ СТУПЕНЕЙ МАСТЕРСТВА */}
          {BELT_CATEGORIES.map((cat) => {
            const catItems = groupedKata[cat.id] || [];
            if (catItems.length === 0) return null;

            return (
              <section key={cat.id} className="atlas-pavilion">
                <div className="atlas-pavilion__header">
                  <h3 className="atlas-pavilion__title">
                    <span>{cat.title}</span>
                    <span className="atlas-pavilion__kanji">{cat.kanji}</span>
                  </h3>
                  <span className="atlas-pavilion__count">{catItems.length} форм</span>
                </div>

                <div className="atlas-pavilion__grid">
                  {catItems.map((item, idx) => {
                    const isSelected = item.Kata_ID === activeKata?.Kata_ID;
                    return (
                      <div
                        key={item.Kata_ID}
                        className={`atlas-item ${isSelected ? 'active' : ''}`}
                        onClick={() => setSelectedId(item.Kata_ID)}
                      >
                        <div className="atlas-item__top">
                          <span className="atlas-item__num">
                            #{String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="atlas-item__kanji">
                            {item.Title?.includes('(') ? item.Title.split('(')[0].trim() : '型'}
                          </span>
                        </div>

                        <div>
                          <h4 className="atlas-item__title">{item.Title}</h4>
                          <div className="atlas-item__meta">
                            {item.Description
                              ? item.Description.slice(0, 75) + '…'
                              : 'Каноническая форма стиля Сётокан.'}
                          </div>
                        </div>

                        <div className="atlas-item__footer">
                          <span className="atlas-item__step-pill">
                            {item.Steps?.length || (cat.id === 'beginner' ? 21 : 32)} движений
                          </span>
                          <Link
                            to={`/kata/${item.Kata_ID}`}
                            className="atlas-item__link-text"
                            onClick={(e) => e.stopPropagation()}
                          >
                            В 3D плеер →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </>
      ) : (
        /* 5. СВОДНЫЙ ТАБЛИЧНЫЙ РЕЕСТР */
        <div className="atlas-table-wrap">
          <table className="atlas-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Название Ката</th>
                <th>Ступень / Пояс</th>
                <th>Стиль</th>
                <th>Движений</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.Kata_ID}>
                  <td>{String(idx + 1).padStart(2, '0')}</td>
                  <td>
                    <Link to={`/kata/${item.Kata_ID}`} className="atlas-table__title">
                      {item.Title}
                    </Link>
                  </td>
                  <td>
                    {item.Difficulty === 'beginner'
                      ? 'Белый / Жёлтый (9–7 Кю)'
                      : item.Difficulty === 'intermediate'
                      ? 'Зелёный / Синий (6–4 Кю)'
                      : item.Difficulty === 'advanced'
                      ? 'Коричневый (3–1 Кю)'
                      : 'Чёрный (Дан)'}
                  </td>
                  <td>{item.Style || 'Сётокан'}</td>
                  <td>{item.Steps?.length || (item.Difficulty === 'beginner' ? 21 : 30)}</td>
                  <td>
                    <Link to={`/kata/${item.Kata_ID}`} className="btn btn-subtle" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                      Открыть 3D →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
