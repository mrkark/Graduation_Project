import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { listKata } from '../api/kata';
import { useAuthStore } from '../store/authStore';
import {
  HankoSeal,
  ShotokanTiger,
  SearchIcon,
  BeltBadge,
  BELT_GRADATION,
  getKataBeltInfo,
} from '../components/ui/JapaneseDecor';
import './KataListPage.css';

// Каллиграфическая роспись для 26 канонических ката
const KATA_KANJI_MAP = {
  'heian shodan': '平安初段',
  'heian nidan': '平安二段',
  'heian sandan': '平安三段',
  'heian yondan': '平安四段',
  'heian godan': '平安五段',
  'tekki shodan': '鉄騎初段',
  'tekki nidan': '鉄騎二段',
  'tekki sandan': '鉄騎三段',
  'bassai-dai': '披塞大',
  'bassai-sho': '披塞小',
  'kanku-dai': '観空大',
  'kanku-sho': '観空小',
  'jion': '慈恩',
  'jiin': '慈陰',
  'jitte': '十手',
  'empi': '燕飛',
  'hangetsu': '半月',
  'gankaku': '岩鶴',
  'sochin': '壯鎭',
  'nijushiho': '二十四歩',
  'meikyo': '明鏡',
  'unsu': '雲手',
  'wankan': '王冠',
  'gojushiho-dai': '五十四歩大',
  'gojushiho-sho': '五十四歩小',
  'chinte': '珍手',
};

// 4 канонических павильона Сётокан для гармоничной динамической верстки
const CANON_PAVILIONS = [
  {
    id: 'heian',
    title: 'Ступень Хэйан · Базовые Формы Спокойствия',
    kanji: '平安 · 9–4 Кю',
    seal: '平',
    badgeText: '5 Форм Фундамента',
    description: 'Основа каратэдо мастера Гитина Фунакоси: постановка равновесия, базовые блоки и удары. 5 ступеней от белого до красного пояса.',
    matcher: (item) => {
      const t = (item.Title || '').toLowerCase();
      return t.includes('heian') || t.includes('хэйан');
    },
  },
  {
    id: 'tekki',
    title: 'Школа Тэкки · «Железный Всадник» (Найханчи)',
    kanji: '鉄騎 · 3–1 Кю / 1 Дан',
    seal: '騎',
    badgeText: '3 Формы Киба-дати',
    description: 'Бой на узкой тропе исключительно в укорененной стойке Киба-дати без разворотов корпуса. Мощные сбивы локтями и удары уракэн.',
    matcher: (item) => {
      const t = (item.Title || '').toLowerCase();
      return t.includes('tekki') || t.includes('тэкки');
    },
  },
  {
    id: 'sentei',
    title: 'Фундаментальные Сэнтэй-Ката (Коричневые Пояса и 1 Дан)',
    kanji: '選定形 · 3–1 Кю / 1 Дан',
    seal: '選',
    badgeText: '5 Главных Ката',
    description: 'Обязательные классические формы канона Сётокан: Бассай-дай («Взятие крепости»), Канку-дай («Взгляд в небеса»), Дзион, Эмпи, Хангэцу.',
    matcher: (item) => {
      const t = (item.Title || '').toLowerCase();
      return (
        t.includes('bassai-dai') ||
        t.includes('бассай-дай') ||
        t.includes('kanku-dai') ||
        t.includes('канку-дай') ||
        t.includes('jion') ||
        t.includes('дзион') ||
        t.includes('empi') ||
        t.includes('эмпи') ||
        t.includes('hangetsu') ||
        t.includes('хангэцу')
      );
    },
  },
  {
    id: 'yudansha',
    title: 'Высшие Мастерские Формы (Юданся · Даны)',
    kanji: '有段者 · 1–5 Даны',
    seal: '極',
    badgeText: '13 Высших Форм',
    description: 'Сложнейшие формы высших поясов: Унсу («Облачные руки» с прыжком 360°), Ганкаку («Журавль на скале»), Сочин, Нидзюсихо, Годзюсихо и другие.',
    matcher: (item) => {
      const t = (item.Title || '').toLowerCase();
      return (
        !t.includes('heian') &&
        !t.includes('хэйан') &&
        !t.includes('tekki') &&
        !t.includes('тэкки') &&
        !t.includes('bassai-dai') &&
        !t.includes('бассай-дай') &&
        !t.includes('kanku-dai') &&
        !t.includes('канку-дай') &&
        !t.includes('jion') &&
        !t.includes('дзион') &&
        !t.includes('empi') &&
        !t.includes('эмпи') &&
        !t.includes('hangetsu') &&
        !t.includes('хангэцу')
      );
    },
  },
];

// Определение флагманских ката, которые отображаются в увеличенном размере (Bento Hero Cards)
function isHeroKata(item) {
  if (!item) return false;
  const id = Number(item.Kata_ID);
  if ([1, 6, 9, 11, 18, 22].includes(id)) return true;
  const t = (item.Title || '').toLowerCase();
  return (
    t.includes('heian shodan') ||
    t.includes('хэйан шодан') ||
    t.includes('хэйан сёдан') ||
    t.includes('tekki shodan') ||
    t.includes('тэкки шодан') ||
    t.includes('bassai-dai') ||
    t.includes('bassai dai') ||
    t.includes('бассай-дай') ||
    t.includes('kanku-dai') ||
    t.includes('kanku dai') ||
    t.includes('канку-дай') ||
    t.includes('unsu') ||
    t.includes('унсу') ||
    t.includes('gankaku') ||
    t.includes('ганкаку')
  );
}

// Получение URL постера ката
function getKataThumbnail(item) {
  if (item?.Thumbnail_URL) {
    const raw = item.Thumbnail_URL;
    if (raw.startsWith('http') || raw.startsWith('data:')) return raw;
    const clean = raw.startsWith('/') ? raw : `/${raw}`;
    return clean;
  }
  const title = (item?.Title || '').toLowerCase();
  const fileKeys = [
    { key: 'shodan', file: 'kata_heian_shodan.jpg' },
    { key: 'nidan', file: 'kata_heian_nidan.jpg' },
    { key: 'sandan', file: 'kata_heian_sandan.jpg' },
    { key: 'yondan', file: 'kata_heian_yondan.jpg' },
    { key: 'godan', file: 'kata_heian_godan.jpg' },
    { key: 'tekki_shodan', file: 'kata_tekki_shodan.jpg' },
    { key: 'tekki_nidan', file: 'kata_tekki_nidan.jpg' },
    { key: 'tekki_sandan', file: 'kata_tekki_sandan.jpg' },
    { key: 'bassai-dai', file: 'kata_bassai_dai.jpg' },
    { key: 'bassai_dai', file: 'kata_bassai_dai.jpg' },
    { key: 'bassai-sho', file: 'kata_bassai_sho.jpg' },
    { key: 'bassai_sho', file: 'kata_bassai_sho.jpg' },
    { key: 'kanku-dai', file: 'kata_kanku_dai.jpg' },
    { key: 'kanku_dai', file: 'kata_kanku_dai.jpg' },
    { key: 'kanku-sho', file: 'kata_kanku_sho.jpg' },
    { key: 'kanku_sho', file: 'kata_kanku_sho.jpg' },
    { key: 'jion', file: 'kata_jion.jpg' },
    { key: 'jiin', file: 'kata_jiin.jpg' },
    { key: 'jitte', file: 'kata_jitte.jpg' },
    { key: 'empi', file: 'kata_empi.jpg' },
    { key: 'hangetsu', file: 'kata_hangetsu.jpg' },
    { key: 'gankaku', file: 'kata_gankaku.jpg' },
    { key: 'sochin', file: 'kata_sochin.jpg' },
    { key: 'nijushiho', file: 'kata_nijushiho.jpg' },
    { key: 'meikyo', file: 'kata_meikyo.jpg' },
    { key: 'unsu', file: 'kata_unsu.jpg' },
    { key: 'wankan', file: 'kata_wankan.jpg' },
    { key: 'gojushiho-dai', file: 'kata_gojushiho_dai.jpg' },
    { key: 'gojushiho-sho', file: 'kata_gojushiho_sho.jpg' },
    { key: 'chinte', file: 'kata_chinte.jpg' },
  ];
  for (const m of fileKeys) {
    if (title.includes(m.key)) {
      return `/uploads/thumbnails/${m.file}`;
    }
  }
  return '/uploads/thumbnails/sensei-preview.jpg';
}

function getKataKanji(item) {
  const t = (item?.Title || '').toLowerCase();
  for (const [k, v] of Object.entries(KATA_KANJI_MAP)) {
    if (t.includes(k)) return v;
  }
  return item?.Title?.match(/[\u4e00-\u9faf]{1,4}/)?.[0] || '型';
}

export default function KataListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('atlas'); // 'atlas' | 'table'
  const [selectedId, setSelectedId] = useState(null);
  const [selectedBelt, setSelectedBelt] = useState('all');
  const [selectedPavilion, setSelectedPavilion] = useState('all');

  const search = params.get('search') || '';
  const sort = params.get('sort') || 'oldest';

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
          // Канонически первой ката является Хэйан Шодан (#1)
          const first = kataList.find((k) => Number(k.Kata_ID) === 1) || kataList[0];
          setSelectedId(first.Kata_ID);
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

  // Клиентская сортировка для идеального канонического порядка ката
  const sortedItems = useMemo(() => {
    const list = [...items];
    if (sort === 'oldest') {
      return list.sort((a, b) => (Number(a.Kata_ID) || 0) - (Number(b.Kata_ID) || 0));
    } else if (sort === 'newest') {
      return list.sort((a, b) => (Number(b.Kata_ID) || 0) - (Number(a.Kata_ID) || 0));
    } else if (sort === 'title') {
      return list.sort((a, b) => (a.Title || '').localeCompare(b.Title || ''));
    }
    return list.sort((a, b) => (Number(a.Kata_ID) || 0) - (Number(b.Kata_ID) || 0));
  }, [items, sort]);

  // Фильтрация ката с учетом выбранного пояса и павильона
  const filteredItems = useMemo(() => {
    return sortedItems.filter((item) => {
      if (selectedBelt !== 'all') {
        const belt = getKataBeltInfo(item);
        if (belt.id !== selectedBelt) return false;
      }
      if (selectedPavilion !== 'all') {
        const pav = CANON_PAVILIONS.find((p) => p.id === selectedPavilion);
        if (pav && !pav.matcher(item)) return false;
      }
      return true;
    });
  }, [sortedItems, selectedBelt, selectedPavilion]);

  // Активная выбранная ката для блока Spotlight
  const activeKata = useMemo(() => {
    if (!filteredItems.length) return null;
    return filteredItems.find((k) => k.Kata_ID === selectedId) || filteredItems[0];
  }, [filteredItems, selectedId]);

  // Группировка ката по точной градации поясов (для счетчиков поясов)
  const groupedKataByBelt = useMemo(() => {
    const groups = {
      white: [],
      yellow: [],
      green: [],
      blue: [],
      red: [],
      brown: [],
      black: [],
    };
    items.forEach((item) => {
      const belt = getKataBeltInfo(item);
      if (groups[belt.id]) {
        groups[belt.id].push(item);
      } else {
        groups.black.push(item);
      }
    });
    return groups;
  }, [items]);

  const quickSearchTags = ['Хэйан Шодан', 'Бассай-дай', 'Канку-дай', 'Эмпи', 'Унсу'];

  return (
    <div className="container kata-atlas">
      {/* 1. ЭДИЦИОННЫЙ ЗАГОЛОВОК ДОДЗЁ */}
      <header className="atlas-header">
        <div className="atlas-header__brand-block">
          <div className="atlas-header__eyebrow-row">
            <span className="atlas-header__eyebrow">Сётокан Каратэдо · Традиционный канон (型)</span>
            <HankoSeal text="型" size="sm" variant="vermilion" shape="square" />
          </div>
          <div className="atlas-header__title-row">
            <ShotokanTiger size={38} color="var(--gold)" className="atlas-header__tiger" />
            <h1 className="atlas-header__title">Атлас 26 Ката</h1>
          </div>
          <p className="atlas-header__subtitle">
            Интерактивный свод канонических форм мастера Гитина Фунакоси: биомеханика, пошаговая геометрия и 3D-разбор.
          </p>
        </div>

        <div className="atlas-header__controls">
          <div className="atlas-view-toggle">
            <button
              type="button"
              className={`atlas-view-toggle__btn ${viewMode === 'atlas' ? 'active' : ''}`}
              onClick={() => setViewMode('atlas')}
            >
              Динамический атлас
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
              <span>+ Создать форму</span>
              <HankoSeal text="新" size="sm" variant="vermilion" shape="square" />
            </Link>
          )}
        </div>
      </header>

      {/* 2. ПАНЕЛЬ ПОИСКА И СОРТИРОВКИ С АУТЕНТИЧНЫМ ДИЗАЙНОМ */}
      <div className="atlas-search-section">
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
              placeholder="Поиск по названию ката (Хэйан, Бассай-дай, Канку-дай, Эмпи, Унсу)…"
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
              Найдено: <strong>{filteredItems.length}</strong> ката
            </span>

            <select
              className="atlas-sort-select"
              value={sort}
              onChange={(e) => updateParam('sort', e.target.value)}
            >
              <option value="oldest">Традиционный порядок канона (1–26)</option>
              <option value="newest">Сначала новые добавления</option>
              <option value="title">По алфавиту (А–Я)</option>
            </select>
          </div>
        </div>

        {/* Быстрые теги подсказок */}
        <div className="atlas-quick-tags">
          <span className="quick-tags-label">Быстрый выбор:</span>
          {quickSearchTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`quick-tag-chip ${search === tag ? 'active' : ''}`}
              onClick={() => updateParam('search', search === tag ? '' : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* 3. НАВИГАЦИЯ ПО КАНОНИЧЕСКИМ ПАВИЛЬОНАМ (УСТРАНЯЕТ ПУСТЫЕ РЯДЫ ПО 1 КАТА) */}
      <div className="atlas-pavilion-tabs">
        <button
          type="button"
          className={`pavilion-tab ${selectedPavilion === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedPavilion('all')}
        >
          <span className="tab-title">Все 26 Ката Сётокан</span>
          <span className="tab-count">26 форм</span>
        </button>
        {CANON_PAVILIONS.map((pav) => {
          const count = items.filter(pav.matcher).length;
          return (
            <button
              key={pav.id}
              type="button"
              className={`pavilion-tab ${selectedPavilion === pav.id ? 'active' : ''}`}
              onClick={() => setSelectedPavilion(selectedPavilion === pav.id ? 'all' : pav.id)}
            >
              <span className="tab-seal">{pav.seal}</span>
              <span className="tab-title">{pav.badgeText}</span>
              <span className="tab-count">({count})</span>
            </button>
          );
        })}
      </div>

      {/* 4. ПАНЕЛЬ ГРАДАЦИИ ПОЯСОВ (КЮ И ДАНЫ) */}
      <div className="atlas-belt-strip" role="tablist" aria-label="Фильтрация по рангам поясов">
        <button
          type="button"
          className={`atlas-belt-pill ${selectedBelt === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedBelt('all')}
        >
          <span>Все пояса ({items.length})</span>
        </button>
        {BELT_GRADATION.map((b) => {
          const count = groupedKataByBelt[b.id]?.length || 0;
          return (
            <button
              key={b.id}
              type="button"
              className={`atlas-belt-pill atlas-belt-pill--${b.id} ${selectedBelt === b.id ? 'active' : ''}`}
              onClick={() => setSelectedBelt(selectedBelt === b.id ? 'all' : b.id)}
            >
              <span className="atlas-belt-dot" style={{ backgroundColor: b.colorHex, borderColor: b.borderColor }} />
              <span className="atlas-belt-kyu">{b.kyu}</span>
              <span className="atlas-belt-name">{b.name}</span>
              <span className="atlas-belt-count">({count})</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="loading">Загрузка атласа ката…</p>
      ) : filteredItems.length === 0 ? (
        <div className="empty-state-box">
          <ShotokanTiger size={56} color="var(--gold-soft)" opacity={0.35} />
          <h3>Ката не найдены</h3>
          <p>Попробуйте изменить поисковый запрос или сбросить фильтры поясов.</p>
          <button
            type="button"
            className="btn btn-gold btn-sm"
            onClick={() => {
              updateParam('search', '');
              setSelectedBelt('all');
              setSelectedPavilion('all');
            }}
          >
            Сбросить все фильтры
          </button>
        </div>
      ) : viewMode === 'atlas' ? (
        <>
          {/* 5. ИНТЕРАКТИВНЫЙ ФОКУС ВЫБРАННОЙ КАТА (ДЭНСЁ СПОТЛАЙТ) */}
          {activeKata && (
            <section className="atlas-spotlight">
              <div className="atlas-spotlight__body">
                <div>
                  <div className="atlas-spotlight__eyebrow">
                    <BeltBadge belt={getKataBeltInfo(activeKata)} size="md" />
                    <HankoSeal
                      text={getKataKanji(activeKata).slice(0, 2)}
                      size="sm"
                      variant="vermilion"
                      shape="square"
                    />
                    <span className="atlas-spotlight__badge-kanji">{getKataKanji(activeKata)}</span>
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
                      <span>Запустить 3D-разбор формы</span>
                      <span className="btn-arrow">→</span>
                    </Link>
                    <Link
                      to={`/bunkai?search=${encodeURIComponent(activeKata.Title?.split(' ')[0] || '')}`}
                      className="btn btn-subtle"
                    >
                      <span>Смотреть бункай этой ката</span>
                      <HankoSeal text="解" size="sm" variant="vermilion" shape="circle" />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="atlas-spotlight__visual">
                <img
                  src={getKataThumbnail(activeKata)}
                  alt={activeKata.Title}
                  className="atlas-spotlight__img"
                />
                <div className="atlas-spotlight__watermark">
                  <span>{getKataKanji(activeKata)}</span>
                </div>
              </div>
            </section>
          )}

          {/* 6. ДИНАМИЧЕСКИЙ BENTO-АТЛАС КАТА: БОЛЬШИЕ HERO КАРТОЧКИ + СТАНДАРТНЫЕ */}
          {CANON_PAVILIONS.filter((pav) => selectedPavilion === 'all' || pav.id === selectedPavilion).map((pav) => {
            const pavItems = filteredItems.filter(pav.matcher);
            if (pavItems.length === 0) return null;

            return (
              <section key={pav.id} className="atlas-pavilion">
                {/* Заголовок павильона */}
                <div className="atlas-pavilion__header">
                  <div className="atlas-pavilion__title-group">
                    <HankoSeal text={pav.seal} size="md" variant="gold" shape="square" />
                    <div>
                      <h3 className="atlas-pavilion__title">
                        <span>{pav.title}</span>
                        <span className="atlas-pavilion__kanji">{pav.kanji}</span>
                      </h3>
                      <p className="atlas-pavilion__desc">{pav.description}</p>
                    </div>
                  </div>
                  <span className="atlas-pavilion__count">{pavItems.length} форм</span>
                </div>

                {/* Динамическая сетка Bento: сочетание карточек разного размера (Featured и Standard) */}
                <div className="atlas-bento-grid">
                  {pavItems.map((item, idx) => {
                    const isSelected = item.Kata_ID === activeKata?.Kata_ID;
                    const isHero = isHeroKata(item);
                    const kanji = getKataKanji(item);
                    const thumbnail = getKataThumbnail(item);
                    const belt = getKataBeltInfo(item);
                    const stepsCount = item.Steps?.length || (belt.id === 'white' ? 21 : 34);

                    return (
                      <div
                        key={item.Kata_ID}
                        className={`atlas-card ${isHero ? 'atlas-card--hero' : 'atlas-card--standard'} ${
                          isSelected ? 'active' : ''
                        }`}
                        onClick={() => navigate(`/kata/${item.Kata_ID}`)}
                        role="button"
                        tabIndex={0}
                        title={`Открыть форму ${item.Title} в 3D Додзё`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            navigate(`/kata/${item.Kata_ID}`);
                          }
                        }}
                      >
                        {/* Фоновое изображение формы (16:9 widescreen, полностью видно без обрезки) */}
                        <div className="atlas-card__media">
                          <img
                            src={thumbnail}
                            alt={item.Title}
                            className="atlas-card__img"
                            loading="lazy"
                          />
                          <div className="atlas-card__media-overlay" />
                          <div
                            className="atlas-card__belt-ribbon"
                            style={{ backgroundColor: belt.colorHex, borderColor: belt.borderColor }}
                          />

                          {/* Каллиграфический водяной знак */}
                          <span className="atlas-card__watermark-kanji">{kanji}</span>

                          {/* Бейдж номера формы и ранга */}
                          <div className="atlas-card__media-badges">
                            <span className="atlas-card__idx-pill">#{String(idx + 1).padStart(2, '0')}</span>
                            {isHero && <span className="atlas-card__hero-badge">★ Ключевая форма</span>}
                          </div>
                        </div>

                        {/* Тело карточки */}
                        <div className="atlas-card__body">
                          <div className="atlas-card__header-row">
                            <div className="atlas-card__titles">
                              <span className="atlas-card__kanji-subtitle">{kanji}</span>
                              <h4 className="atlas-card__title">{item.Title}</h4>
                            </div>
                            <HankoSeal text="型" size="sm" variant="vermilion" shape="square" />
                          </div>

                          <p className="atlas-card__desc">
                            {item.Description
                              ? (isHero ? item.Description.slice(0, 140) : item.Description.slice(0, 75)) + '…'
                              : 'Каноническая форма Сётокан с выверенной биомеханикой перемещений.'}
                          </p>

                          {/* Нижняя панель с мета-информацией и прямым приглашением в 3D Додзё */}
                          <div className="atlas-card__footer">
                            <div className="atlas-card__meta-badges">
                              <BeltBadge belt={belt} size="sm" showKanji={false} />
                              <span className="atlas-card__steps-pill">{stepsCount} шагов</span>
                            </div>

                            <div className="atlas-card__dojo-tag">
                              <span>3D Додзё</span>
                              <span className="dojo-tag-arrow">→</span>
                            </div>
                          </div>
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
        /* 7. СВОДНЫЙ ТАБЛИЧНЫЙ РЕЕСТР */
        <div className="atlas-table-wrap">
          <table className="atlas-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Превью</th>
                <th>Название Ката</th>
                <th>Ступень / Пояс</th>
                <th>Стиль</th>
                <th>Движений</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => (
                <tr key={item.Kata_ID}>
                  <td>{String(idx + 1).padStart(2, '0')}</td>
                  <td>
                    <img
                      src={getKataThumbnail(item)}
                      alt={item.Title}
                      className="atlas-table__thumb"
                    />
                  </td>
                  <td>
                    <Link to={`/kata/${item.Kata_ID}`} className="atlas-table__title">
                      {item.Title}
                    </Link>
                    <span className="atlas-table__kanji-sub">{getKataKanji(item)}</span>
                  </td>
                  <td>
                    <BeltBadge belt={getKataBeltInfo(item)} size="sm" />
                  </td>
                  <td>{item.Style || 'Сётокан'}</td>
                  <td>{item.Steps?.length || (item.Difficulty === 'beginner' ? 21 : 34)}</td>
                  <td>
                    <Link
                      to={`/kata/${item.Kata_ID}`}
                      className="btn btn-subtle"
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}
                    >
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
