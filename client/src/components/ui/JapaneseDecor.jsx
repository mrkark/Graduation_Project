import React from 'react';
import { Search, Swords, Shield } from 'lucide-react';
import './JapaneseDecor.css';

/**
 * HankoSeal — Традиционная японская печать (Ханко / 印鑑 / 落款印)
 * Варианты:
 * - variant: 'vermilion' (классический красный оттиск), 'gold' (латунный штамп), 'outline' (тонкий контур)
 * - shape: 'square' (квадратная), 'circle' (круглая), 'oval' (овальная)
 * - size: 'sm' (24px), 'md' (36px), 'lg' (48px), 'xl' (64px)
 */
export function HankoSeal({
  text = '武道',
  subtext,
  variant = 'vermilion',
  shape = 'square',
  size = 'md',
  className = '',
  title,
}) {
  return (
    <span
      className={`hanko-seal hanko-seal--${variant} hanko-seal--${shape} hanko-seal--${size} ${className}`}
      title={title || text}
      aria-label={title || text}
    >
      <span className="hanko-seal__inner">
        <span className="hanko-seal__kanji">{text}</span>
        {subtext && <span className="hanko-seal__sub">{subtext}</span>}
      </span>
    </span>
  );
}

/**
 * ShotokanTiger — Символ боевого духа Шотокан (открытый источник: Lucide Icons)
 */
export function ShotokanTiger({ size = 32, color = 'currentColor', className = '' }) {
  return (
    <Swords
      size={size}
      color={color}
      className={`shotokan-tiger-svg ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * JapaneseKamon — Традиционный герб Додзё (открытый источник: Lucide Icons)
 */
export function JapaneseKamon({ size = 32, color = 'currentColor', className = '' }) {
  return (
    <Shield
      size={size}
      color={color}
      className={`kamon-svg ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * DojoDivider — Аутентичный разделитель секций с японским орнаментом и центральным мон
 */
export function DojoDivider({ kanji = '空手道', withKamon = true, className = '' }) {
  return (
    <div className={`dojo-divider ${className}`} role="separator">
      <div className="dojo-divider__line dojo-divider__line--left" />
      <div className="dojo-divider__center">
        {withKamon && <ShotokanTiger size={22} color="var(--gold)" className="dojo-divider__tiger" />}
        {kanji && <span className="dojo-divider__kanji">{kanji}</span>}
        <HankoSeal text="武" size="sm" shape="square" variant="vermilion" />
      </div>
      <div className="dojo-divider__line dojo-divider__line--right" />
    </div>
  );
}

/**
 * KakejikuScroll — Вертикальный свиток какэмоно / настенный баннер нобори
 * Свиток с традиционным валиком, шелковой каймой хёгу и вертикальной каллиграфией.
 */
export function KakejikuScroll({
  title = '空手道',
  subtitle = '松濤館流',
  sealText = '武徳',
  side = 'left',
  className = '',
}) {
  return (
    <aside className={`kakejiku-scroll kakejiku-scroll--${side} ${className}`} aria-label="Традиционный свиток Додзё">
      {/* Верхний шнур подвеса (Какэо / 掛け緒) */}
      <div className="kakejiku-scroll__hanger">
        <div className="kakejiku-scroll__cord" />
      </div>

      {/* Верхний деревянный валик с латунными наконечниками (Хёмоку / 八双) */}
      <div className="kakejiku-scroll__rod kakejiku-scroll__rod--top">
        <span className="kakejiku-scroll__finial" />
        <span className="kakejiku-scroll__shaft" />
        <span className="kakejiku-scroll__finial" />
      </div>

      {/* Шёлковые полосы фринжа (Футай / 風帯) */}
      <div className="kakejiku-scroll__futai">
        <span className="kakejiku-scroll__ribbon" />
        <span className="kakejiku-scroll__ribbon" />
      </div>

      {/* Полотно свитка из состаренной бумаги васи с шёлковой окантовкой */}
      <div className="kakejiku-scroll__body">
        <div className="kakejiku-scroll__brocade-top" />
        <div className="kakejiku-scroll__paper">
          <div className="kakejiku-scroll__kanji-col">
            {title.split('').map((char, idx) => (
              <span key={idx} className="kakejiku-scroll__char">
                {char}
              </span>
            ))}
          </div>

          <div className="kakejiku-scroll__subcol">
            {subtitle.split('').map((char, idx) => (
              <span key={idx} className="kakejiku-scroll__subchar">
                {char}
              </span>
            ))}
          </div>

          {/* Красная резная печать мастера (Ханко) */}
          <div className="kakejiku-scroll__seal-wrap">
            <HankoSeal text={sealText} size="md" variant="vermilion" shape="square" />
          </div>
        </div>
        <div className="kakejiku-scroll__brocade-bottom" />
      </div>

      {/* Нижний массивный деревянный валик с утяжелителем (Дзикуги / 軸木) */}
      <div className="kakejiku-scroll__rod kakejiku-scroll__rod--bottom">
        <span className="kakejiku-scroll__finial kakejiku-scroll__finial--bottom" />
        <span className="kakejiku-scroll__shaft kakejiku-scroll__shaft--bottom" />
        <span className="kakejiku-scroll__finial kakejiku-scroll__finial--bottom" />
      </div>
    </aside>
  );
}

/**
 * MeifudaPlaque — Деревянная табличка наставлений и ката (Мэйфуда / 名札)
 */
export function MeifudaPlaque({
  kanji,
  title,
  subtitle,
  seal = '型',
  highlight = false,
  className = '',
  children,
}) {
  return (
    <div className={`meifuda-plaque ${highlight ? 'meifuda-plaque--highlight' : ''} ${className}`}>
      <div className="meifuda-plaque__header">
        {kanji && <span className="meifuda-plaque__kanji">{kanji}</span>}
        <div className="meifuda-plaque__title-block">
          {title && <h3 className="meifuda-plaque__title">{title}</h3>}
          {subtitle && <span className="meifuda-plaque__sub">{subtitle}</span>}
        </div>
        {seal && <HankoSeal text={seal} size="sm" variant="vermilion" shape="square" />}
      </div>
      {children && <div className="meifuda-plaque__content">{children}</div>}
    </div>
  );
}

/**
 * SearchIcon — Иконка поиска (открытый источник: Lucide Icons)
 */
export function SearchIcon({ size = 18, color = 'currentColor', className = '' }) {
  return (
    <Search
      size={size}
      color={color}
      className={`search-icon-svg ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * Градация поясов Шотокан каратэдо (Кю и Даны)
 * 9–8: белый
 * 7: желтый
 * 6: зеленый
 * 5: синий
 * 4: красный
 * 3–1: коричневый
 * потом черные (Даны)
 */
export const BELT_GRADATION = [
  {
    id: 'white',
    kyu: '9–8 Кю',
    name: 'Белый пояс',
    kanji: '白帯',
    colorHex: '#f8fafc',
    textColor: '#0f172a',
    borderColor: '#cbd5e1',
    description: 'Начало пути. Чистота помыслов, базовые стойки и удары.',
  },
  {
    id: 'yellow',
    kyu: '7 Кю',
    name: 'Жёлтый пояс',
    kanji: '黄帯',
    colorHex: '#eab308',
    textColor: '#422006',
    borderColor: '#ca8a04',
    description: 'Первый луч солнца, понимание траектории и центра тяжести.',
  },
  {
    id: 'green',
    kyu: '6 Кю',
    name: 'Зелёный пояс',
    kanji: '緑帯',
    colorHex: '#16a34a',
    textColor: '#f0fdf4',
    borderColor: '#15803d',
    description: 'Росток силы, координация движений и хлесткость ударов.',
  },
  {
    id: 'blue',
    kyu: '5 Кю',
    name: 'Синий пояс',
    kanji: '青帯',
    colorHex: '#2563eb',
    textColor: '#eff6ff',
    borderColor: '#1d4ed8',
    description: 'Глубина неба и воды, скорость и плавность переходов стоек.',
  },
  {
    id: 'red',
    kyu: '4 Кю',
    name: 'Красный пояс',
    kanji: '赤帯',
    colorHex: '#dc2626',
    textColor: '#fef2f2',
    borderColor: '#b91c1c',
    description: 'Огонь мастерства, боевой напор и мощь концентрации кимэ.',
  },
  {
    id: 'brown',
    kyu: '3–1 Кю',
    name: 'Коричневый пояс',
    kanji: '茶帯',
    colorHex: '#78350f',
    textColor: '#fef3c7',
    borderColor: '#92400e',
    description: 'Зрелость земли и векового дерева. Преддверие мастерских данов.',
  },
  {
    id: 'black',
    kyu: '1+ Дан',
    name: 'Чёрный пояс',
    kanji: '黒帯',
    colorHex: '#111111',
    textColor: '#e6c37a',
    borderColor: '#d4a24c',
    description: 'Круг замкнулся: начало истинного постижения искусства каратэдо.',
  },
];

/**
 * Определение пояса и ступени кю/дан для ката Шотокан
 */
export function getKataBeltInfo(kata) {
  if (!kata) return BELT_GRADATION[0];
  const title = (typeof kata === 'string' ? kata : kata.Title || '').toLowerCase();
  const id = typeof kata === 'object' ? Number(kata.Kata_ID || 0) : 0;

  // 9–8 Кю: Белый пояс (Хэйан Шодан)
  if (id === 1 || (title.includes('shodan') && title.includes('heian')) || (title.includes('шодан') && title.includes('хэйан'))) {
    return BELT_GRADATION[0];
  }
  // 7 Кю: Жёлтый пояс (Хэйан Нидан)
  if (id === 2 || (title.includes('nidan') && title.includes('heian')) || (title.includes('нидан') && title.includes('хэйан'))) {
    return BELT_GRADATION[1];
  }
  // 6 Кю: Зелёный пояс (Хэйан Сандан)
  if (id === 3 || (title.includes('sandan') && title.includes('heian')) || (title.includes('сандан') && title.includes('хэйан'))) {
    return BELT_GRADATION[2];
  }
  // 5 Кю: Синий пояс (Хэйан Ёндан)
  if (id === 4 || (title.includes('yondan') && title.includes('heian')) || (title.includes('ёндан') && title.includes('хэйан'))) {
    return BELT_GRADATION[3];
  }
  // 4 Кю: Красный пояс (Хэйан Годан)
  if (id === 5 || (title.includes('godan') && title.includes('heian')) || (title.includes('годан') && title.includes('хэйан'))) {
    return BELT_GRADATION[4];
  }
  // 3–1 Кю: Коричневый пояс (Тэкки Шодан, Бассай Дай, Канку Дай, Дзион, Эмпи, Хангэцу, Джиттэ, Тэкки Нидан, Тэкки Сандан)
  if (
    id === 6 || id === 7 || id === 8 || id === 9 || id === 11 || id === 13 || id === 15 || id === 16 || id === 17 ||
    title.includes('tekki') || title.includes('тэкки') ||
    title.includes('bassai dai') || title.includes('бассай дай') ||
    title.includes('kanku dai') || title.includes('канку дай') ||
    title.includes('jion') || title.includes('дзион') ||
    title.includes('jitte') || title.includes('джиттэ') ||
    title.includes('empi') || title.includes('эмпи') ||
    title.includes('hangetsu') || title.includes('хангэцу')
  ) {
    return BELT_GRADATION[5];
  }

  // По умолчанию для начинающих/средних, если нет в списке
  if (kata.Difficulty === 'beginner') return BELT_GRADATION[0];
  if (kata.Difficulty === 'intermediate') return BELT_GRADATION[3];
  if (kata.Difficulty === 'advanced') return BELT_GRADATION[5];

  // Мастерские формы (Бассай Шо, Канку Шо, Ганкаку, Сочин, Нидзюсихо, Унсу, Чинтэ и др.) -> Чёрный пояс
  return BELT_GRADATION[6];
}

/**
 * BeltBadge — Визуальный аутентичный бейдж пояса каратэ
 */
export function BeltBadge({ belt, size = 'md', showKanji = true, className = '' }) {
  const info = typeof belt === 'string'
    ? (BELT_GRADATION.find((b) => b.id === belt || b.kyu.includes(belt)) || BELT_GRADATION[0])
    : (belt || BELT_GRADATION[0]);

  const displayName = info.name.replace(/\s*пояс\s*/i, '').trim();

  return (
    <span
      className={`dojo-belt-badge dojo-belt-badge--${info.id} dojo-belt-badge--${size} ${className}`}
      style={{
        backgroundColor: info.colorHex,
        color: info.textColor,
        borderColor: info.borderColor,
      }}
      title={`${info.kyu} · ${info.name}: ${info.description}`}
    >
      <span className="dojo-belt-badge__knot" style={{ backgroundColor: info.borderColor }} />
      <span className="dojo-belt-badge__kyu">{info.kyu}</span>
      <span className="dojo-belt-badge__name">{displayName}</span>
      {showKanji && <span className="dojo-belt-badge__kanji">{info.kanji}</span>}
    </span>
  );
}

