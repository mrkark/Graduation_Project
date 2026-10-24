import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listBunkai } from '../api/bunkai';
import StatusBadge from '../components/StatusBadge';
import { HankoSeal, ShotokanTiger, DojoDivider, SearchIcon } from '../components/ui/JapaneseDecor';
import './BunkaiListPage.css';

// Задача 16: Уровни сложности бункаев
const DIFFICULTY_MAP = {
  beginner: 'Базовый уровень (Кю)',
  intermediate: 'Средний уровень (Сэнтэй)',
  advanced: 'Продвинутый уровень',
  master: 'Мастерский уровень (Дан)',
};

function getBunkaiDifficulty(b) {
  const t = (b.Kata_Title || b.Title || '').toLowerCase();
  if (t.includes('heian') || t.includes('хэйан')) {
    return 'beginner'; // Бункай Хэйан — базовый
  }
  if (
    t.includes('unsu') || t.includes('унсу') ||
    t.includes('gankaku') || t.includes('ганкаку') ||
    t.includes('sochin') || t.includes('сочин') ||
    t.includes('nijushiho') || t.includes('нидзюсихо') ||
    t.includes('gojushiho') || t.includes('годзюсихо') ||
    t.includes('meikyo') || t.includes('мэйкё') ||
    t.includes('chinte') || t.includes('чинтэ') ||
    t.includes('wankan') || t.includes('ванкан')
  ) {
    return 'master'; // Бункай Унсу и высших ката — мастерский
  }
  return 'intermediate';
}

function isStandardBunkai(b) {
  const authorName = (b.Author?.Username || b.Author?.Display_Name || '').toLowerCase();
  return !b.Author || authorName === 'admin' || authorName.includes('мастер') || !b.Author?.Display_Name;
}

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
    listBunkai({ sort, page: 1, pageSize: 60 })
      .then((res) => {
        if (cancelled) return;
        setItems(res.data || []);
        setMeta(res.meta || { total: res.data?.length || 0 });
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [sort]);

  function updateParam(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  // Задача 15: поиск только по названию бункай
  const filteredItems = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return items.filter((b) => {
      if (!q) return true;
      const title = (b.Title || '').toLowerCase();
      return title.includes(q);
    });
  }, [items, search]);

  return (
    <div className="container bunkai-catalog">
      {/* 1. ЭДИЦИОННАЯ ШАПКА РАЗБОРОВ БУНКАЙ С ДОДЗЁ-АТРИБУТИКОЙ */}
      <header className="bunkai-header">
        <div className="bunkai-header__left">
          <div className="bunkai-header__badge-row">
            <span className="bunkai-header__eyebrow">
              <span className="bunkai-header__eyebrow-kanji">応用分解</span>
              <span>Оё-Бункай · Боевое применение</span>
            </span>
          </div>
          <div className="bunkai-header__title-row">
            <h1 className="bunkai-header__title">Каталог боевых сценариев</h1>
            <HankoSeal text="分解" size="md" variant="vermilion" shape="square" />
          </div>
          <p className="bunkai-header__subtitle">
            Практическая расшифровка скрытых боевых техник ката против реальных ударов, захватов и вооруженных атак в трёхмерном пространстве.
          </p>
        </div>

        <div className="bunkai-header__actions">
          <Link to="/bunkai/new" className="btn btn-primary">
            <span>+ Сконструировать бункай</span>
            <HankoSeal text="作" size="sm" variant="gold" shape="circle" />
          </Link>
        </div>
      </header>

      {/* 2. ПОИСК И СОРТИРОВКА В ДИЗАЙНЕ СТРАНИЦЫ КАТА (Задача 15) */}
      <div className="atlas-search-section" style={{ marginBottom: '2rem' }}>
        <div className="atlas-search-strip">
          <div className="atlas-search-box">
            <div className="atlas-search-icon-badge">
              <SearchIcon size={19} color="#d4a24c" className="atlas-search-icon" />
            </div>
            <input
              type="text"
              className="atlas-search-input"
              value={search}
              style={{ paddingLeft: '3.8rem' }}
              onChange={(e) => updateParam('search', e.target.value)}
              placeholder="Поиск по названию бункай (Хэйан, Бассай-дай, Канку-дай, Унсу)…"
            />
            {search && (
              <button
                type="button"
                className="atlas-search-clear-btn"
                onClick={() => updateParam('search', '')}
                title="Очистить поиск"
              >
                ✕
              </button>
            )}
          </div>

          <div className="atlas-search-meta-group">
            <span className="atlas-found-badge">
              Найдено: <strong>{filteredItems.length}</strong> сценариев
            </span>

            <select
              className="atlas-sort-select"
              value={sort}
              onChange={(e) => updateParam('sort', e.target.value)}
            >
              <option value="newest">Сначала новые сценарии</option>
              <option value="oldest">Сначала ранние сценарии</option>
              <option value="title">По алфавиту (А–Я)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. СПИСОК БОЕВЫХ СИТУАЦИЙ */}
      {loading ? (
        <p className="loading">Загрузка боевых сценариев…</p>
      ) : filteredItems.length === 0 ? (
        <p className="empty-state">Боевые сценарии бункай не найдены.</p>
      ) : (
        <div className="bunkai-grid">
          {filteredItems.map((b) => {
            const diffKey = getBunkaiDifficulty(b);
            const diffLabel = DIFFICULTY_MAP[diffKey] || 'Практика';
            const standard = isStandardBunkai(b);

            return (
              <Link to={`/bunkai/${b.Bunkai_ID}`} key={b.Bunkai_ID} className="bunkai-unit">
                <div>
                  <div className="bunkai-unit__dynamic-strip">
                    <span className="bunkai-unit__roles">
                      <span className="bunkai-role-tag bunkai-role-tag--uke">
                        <span className="bunkai-role-kanji">受</span>
                        <span>Укэ</span>
                      </span>
                      <span className="bunkai-unit__role-arrow">⇄</span>
                      <span className="bunkai-role-tag bunkai-role-tag--tori">
                        <span className="bunkai-role-kanji">取</span>
                        <span>Тори</span>
                      </span>
                    </span>
                    <span className={`bunkai-unit__difficulty bunkai-unit__difficulty--${diffKey}`}>{diffLabel}</span>
                  </div>

                  <h3 className="bunkai-unit__title">{b.Title}</h3>

                  <p className="bunkai-unit__desc">
                    {b.Description ||
                      'Пошаговый тактический разбор выхода на дистанцию контратаки с выведением противника из равновесия.'}
                  </p>
                </div>

                <div>
                  {/* Задача 17: Дистанция Ма-ай без переносов */}
                  <div className="bunkai-unit__maai-badge">
                    <span className="bunkai-maai-kanji">間合</span>
                    <span>Дистанция:</span>
                    <strong>{b.Episodes?.length > 1 ? 'Многофазный бой' : 'Иссоку-итто'}</strong>
                  </div>

                  {/* Задача 18: У стандартных бункай нет подписи инструктора */}
                  {/* Задача 19: Текст кнопки "Симуляция 3D" строго в одну строку */}
                  <div className="bunkai-unit__footer">
                    {!standard ? (
                      <span className="bunkai-unit__author">
                        <span className="bunkai-author-label">Инструктор: </span>
                        {b.Author?.Display_Name || b.Author?.Username}
                      </span>
                    ) : (
                      <span className="bunkai-canonical-tag">
                        Канонический разбор
                      </span>
                    )}
                    <span className="bunkai-unit__action">
                      <span>Симуляция 3D</span>
                      <HankoSeal text="解" size="sm" variant="vermilion" shape="square" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
