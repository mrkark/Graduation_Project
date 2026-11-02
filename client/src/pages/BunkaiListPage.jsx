import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listBunkai } from '../api/bunkai';
import { useFavoritesStore } from '../store/favoritesStore';
import StatusBadge from '../components/StatusBadge';
import VideoModal from '../components/VideoModal';
import { HankoSeal, ShotokanTiger, DojoDivider, SearchIcon } from '../components/ui/JapaneseDecor';
import { Heart, Video, X, Swords } from 'lucide-react';
import LazySection from '../components/ui/LazySection';
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const searchBoxRef = useRef(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Избранные бункай (Задача 8)
  const { bunkaiFavorites, isBunkaiFavorite, toggle: toggleFavorite, fetchFavorites, loaded: favsLoaded } = useFavoritesStore();

  useEffect(() => {
    if (!favsLoaded) fetchFavorites();
  }, [favsLoaded, fetchFavorites]);

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

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function updateParam(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  // Задача 2: Динамические подсказки в поиске бункай
  const suggestions = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return items
      .filter((b) => (b.Title || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [items, search]);

  function handleSelectSuggestion(bunkai) {
    updateParam('search', bunkai.Title);
    setShowSuggestions(false);
  }

  // Задача 15: поиск по названию бункай + фильтр избранного (Задача 8) + фильтр сложности
  const filteredItems = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return items.filter((b) => {
      if (onlyFavorites && !bunkaiFavorites.includes(Number(b.Bunkai_ID))) {
        return false;
      }
      if (selectedDifficulty !== 'all') {
        const diff = getBunkaiDifficulty(b);
        if (diff !== selectedDifficulty) return false;
      }
      if (!q) return true;
      const title = (b.Title || '').toLowerCase();
      return title.includes(q);
    });
  }, [items, search, onlyFavorites, bunkaiFavorites, selectedDifficulty]);

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

      {/* 2. ПОИСК, ФИЛЬТРЫ И ИЗБРАННОЕ В СТИЛЕ ДОДЗЁ С НАДЕЖНЫМ ПОЗИЦИОНИРОВАНИЕМ */}
      <section className="bunkai-search-card">
        {/* Верхняя строка: Поле поиска со встроенной иконкой лупы */}
        <div className="bunkai-search-field-wrap" ref={searchBoxRef}>
          <div className="bunkai-search-icon-box">
            <SearchIcon size={20} color="#d4a24c" />
          </div>
          <input
            type="text"
            className="bunkai-search-input"
            value={search}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              updateParam('search', e.target.value);
              setShowSuggestions(true);
            }}
            placeholder="Поиск по названию бункай (Хэйан, Бассай-дай, Канку-дай, Унсу)…"
          />
          {search && (
            <button
              type="button"
              className="bunkai-search-clear-btn"
              onClick={() => {
                updateParam('search', '');
                setShowSuggestions(false);
              }}
              title="Очистить поиск"
              aria-label="Очистить поиск"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={14} />
            </button>
          )}

          {/* Выпадающие динамические подсказки в поиске бункай */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="bunkai-search-suggestions">
              <div className="bunkai-search-suggestions-header">
                Подходящие сценарии бункай ({suggestions.length}):
              </div>
              {suggestions.map((b) => (
                <div
                  key={b.Bunkai_ID}
                  className="bunkai-suggestion-item"
                  onMouseDown={() => handleSelectSuggestion(b)}
                >
                  <span className="bunkai-suggestion-icon"><Swords size={14} /></span>
                  <div className="bunkai-suggestion-text">
                    <span className="bunkai-suggestion-title">{b.Title}</span>
                    <span className="bunkai-suggestion-meta">
                      {b.Difficulty ? `Сложность: ${b.Difficulty}` : 'Канонический разбор'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Нижняя строка: Фильтры (Избранное, Уровни сложности), Сортировка и Счетчик */}
        <div className="bunkai-filters-toolbar">
          <div className="bunkai-filters-toolbar__left">
            <button
              type="button"
              className={`bunkai-fav-toggle-btn ${onlyFavorites ? 'active' : ''}`}
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              title={onlyFavorites ? 'Показать все сценарии' : 'Показать только избранные'}
            >
              <span className="bunkai-fav-toggle-icon">{onlyFavorites ? <Heart size={14} fill='#ef4444' color='#ef4444' /> : <Heart size={14} />}</span>
              <span>{onlyFavorites ? 'Только избранные' : 'Избранное'}</span>
              <span className="bunkai-fav-toggle-badge">{bunkaiFavorites.length}</span>
            </button>

            <div className="bunkai-difficulty-pills">
              <button
                type="button"
                className={`bunkai-diff-pill ${selectedDifficulty === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedDifficulty('all')}
              >
                Все уровни
              </button>
              <button
                type="button"
                className={`bunkai-diff-pill ${selectedDifficulty === 'beginner' ? 'active' : ''}`}
                onClick={() => setSelectedDifficulty('beginner')}
              >
                Базовый (Кю)
              </button>
              <button
                type="button"
                className={`bunkai-diff-pill ${selectedDifficulty === 'intermediate' ? 'active' : ''}`}
                onClick={() => setSelectedDifficulty('intermediate')}
              >
                Средний (Сэнтэй)
              </button>
              <button
                type="button"
                className={`bunkai-diff-pill ${selectedDifficulty === 'master' ? 'active' : ''}`}
                onClick={() => setSelectedDifficulty('master')}
              >
                Мастерский (Дан)
              </button>
            </div>
          </div>

          <div className="bunkai-filters-toolbar__right">
            <span className="bunkai-results-count">
              Найдено: <strong>{filteredItems.length}</strong> {filteredItems.length === 1 ? 'сценарий' : 'сценариев'}
            </span>

            <div className="bunkai-sort-wrap">
              <select
                className="bunkai-sort-select"
                value={sort}
                onChange={(e) => updateParam('sort', e.target.value)}
                aria-label="Сортировка каталога бункай"
              >
                <option value="newest">Сначала новые сценарии</option>
                <option value="oldest">Сначала ранние сценарии</option>
                <option value="title">По алфавиту (А–Я)</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* 3. СПИСОК БОЕВЫХ СИТУАЦИЙ */}
      {loading ? (
        <p className="loading">Загрузка боевых сценариев…</p>
      ) : filteredItems.length === 0 ? (
        <p className="empty-state">Боевые сценарии бункай не найдены.</p>
      ) : (
        <div className="bunkai-grid">
          {/* 1-й экран: первые 6 сценариев загружаются немедленно */}
          {filteredItems.slice(0, 6).map((b) => {
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={`bunkai-unit__difficulty bunkai-unit__difficulty--${diffKey}`}>{diffLabel}</span>
                      <button
                        type="button"
                        className={`bunkai-fav-btn ${isBunkaiFavorite(b.Bunkai_ID) ? 'active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFavorite('bunkai', b.Bunkai_ID);
                        }}
                        title={isBunkaiFavorite(b.Bunkai_ID) ? 'Удалить из избранного' : 'Добавить в избранное'}
                        aria-label="Избранное"
                      >
                        {isBunkaiFavorite(b.Bunkai_ID) ? <Heart size={15} fill='#ef4444' color='#ef4444' /> : <Heart size={15} />}
                      </button>
                    </div>
                  </div>

                  <h3 className="bunkai-unit__title">{b.Title}</h3>

                  <p className="bunkai-unit__desc">
                    {b.Description ||
                      'Пошаговый тактический разбор выхода на дистанцию контратаки с выведением противника из равновесия.'}
                  </p>
                </div>

                <div>
                  {/* Задача 17: Дистанция Ма-ай без переносов и кнопка Видео бункая */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <div className="bunkai-unit__maai-badge" style={{ marginBottom: 0 }}>
                      <span className="bunkai-maai-kanji">間合</span>
                      <span>Дистанция:</span>
                      <strong>{b.Episodes?.length > 1 ? 'Многофазный бой' : 'Иссоку-итто'}</strong>
                    </div>

                    {b.Video_URL && (
                      <button
                        type="button"
                        className="bunkai-video-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveVideo({
                            url: b.Video_URL,
                            title: b.Title,
                            subtitle: 'Оё-Бункай (боевой разбор) · Мастера JKS (Japan Karate Shoto Federation)',
                          });
                        }}
                        title="Смотреть видеоразбор бункая мастеров JKS с таймкода"
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Video size={13} /> Видео JKS</span>
                      </button>
                    )}
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

      {/* Модальное окно просмотра канонического японского видео бункая с таймкода */}
      <VideoModal
        isOpen={!!activeVideo}
        onClose={() => setActiveVideo(null)}
        videoUrl={activeVideo?.url}
        title={activeVideo?.title}
        subtitle={activeVideo?.subtitle}
      />
    </div>
  );
}
