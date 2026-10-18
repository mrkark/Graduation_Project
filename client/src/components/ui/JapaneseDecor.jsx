import React from 'react';
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
 * ShotokanTiger — Канонический круглый тигр Сётокан (Тора-но маки / 虎の巻)
 * Эмблема мастера Хоана Косуги для первого трактата Гитина Фунакоси.
 */
export function ShotokanTiger({ size = 48, color = 'currentColor', className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shotokan-tiger-svg ${className}`}
      aria-hidden="true"
    >
      {/* Внешнее кольцо с двойным традиционным кантом */}
      <circle cx="50" cy="50" r="46" stroke={color} strokeWidth="3" strokeDasharray="300" strokeDashoffset="0" opacity="0.9" />
      <circle cx="50" cy="50" r="42" stroke={color} strokeWidth="1" strokeOpacity="0.6" />

      {/* Стилизованный круглый тигр Сётокан */}
      <g stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Голова и оскал тигра */}
        <path d="M 46 22 C 48 18, 54 18, 56 22 C 58 25, 62 26, 65 24 C 64 28, 62 31, 59 33 C 58 37, 54 40, 50 40 C 46 40, 42 37, 41 33 C 38 31, 36 28, 35 24 C 38 26, 42 25, 44 22 Z" />
        {/* Глаза и лобные полосы */}
        <circle cx="45" cy="28" r="1.5" fill={color} />
        <circle cx="55" cy="28" r="1.5" fill={color} />
        <path d="M 50 20 L 50 26 M 47 24 L 53 24" strokeWidth="1.5" />

        {/* Выгнутая мощная спина в прыжке по кругу */}
        <path d="M 59 31 C 68 32, 78 40, 78 52 C 78 64, 70 76, 56 78 C 42 80, 28 74, 24 60 C 20 46, 28 32, 41 30" />

        {/* Полосы тигра (традиционные каллиграфические росчерки) */}
        <path d="M 72 44 C 67 46, 64 50, 65 54" strokeWidth="2.5" />
        <path d="M 75 53 C 69 55, 66 59, 67 63" strokeWidth="2.5" />
        <path d="M 70 63 C 65 65, 62 69, 61 73" strokeWidth="2" />
        <path d="M 28 50 C 33 52, 35 56, 33 60" strokeWidth="2" />
        <path d="M 32 61 C 37 63, 38 67, 36 71" strokeWidth="2" />

        {/* Лапы с когтями */}
        <path d="M 58 38 C 64 42, 68 47, 65 52 M 63 53 L 67 52 M 64 55 L 68 55" />
        <path d="M 42 38 C 36 43, 33 48, 36 53 M 34 54 L 38 53" />
        <path d="M 36 70 C 38 75, 42 77, 47 76 M 44 79 L 46 76 M 47 80 L 49 76" />

        {/* Хвост тигра, закрученный вверх к небу */}
        <path d="M 25 58 C 22 52, 23 42, 30 36 C 33 33, 35 34, 34 37 C 32 40, 27 46, 30 52" strokeWidth="2.4" />
      </g>
    </svg>
  );
}

/**
 * JapaneseKamon — Традиционный японский герб (Мон / 家紋)
 * symbol: 'mitsu-tomoe' (три вихря), 'takanoha' (перья ястреба), 'asanoha' (лист конопли)
 */
export function JapaneseKamon({ symbol = 'mitsu-tomoe', size = 32, color = 'currentColor', className = '' }) {
  if (symbol === 'asanoha') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={`kamon-svg ${className}`}>
        <circle cx="20" cy="20" r="18" stroke={color} strokeWidth="1.5" />
        <path d="M 20 2 L 35.6 11 L 35.6 29 L 20 38 L 4.4 29 L 4.4 11 Z" stroke={color} strokeWidth="1" />
        <path d="M 20 2 L 20 38 M 4.4 11 L 35.6 29 M 4.4 29 L 35.6 11" stroke={color} strokeWidth="1" />
        <path d="M 20 20 L 20 2 M 20 20 L 35.6 11 M 20 20 L 35.6 29 M 20 20 L 20 38 M 20 20 L 4.4 29 M 20 20 L 4.4 11" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  }

  // По умолчанию: Mitsu-Tomoe (Три вихря духа Будо)
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={`kamon-svg ${className}`}>
      <circle cx="50" cy="50" r="46" stroke={color} strokeWidth="3" />
      <circle cx="50" cy="50" r="42" stroke={color} strokeWidth="1" strokeOpacity="0.5" />
      <g fill={color} opacity="0.9">
        {/* Tomoe 1 (Верхний вихрь) */}
        <path d="M 50 16 C 60 16, 68 24, 68 34 C 68 44, 60 50, 50 50 C 44 50, 40 46, 40 40 C 40 26, 44 16, 50 16 Z" />
        <path d="M 68 34 C 68 54, 50 70, 32 64 C 40 68, 56 64, 60 48 C 64 36, 60 26, 50 16 C 62 18, 68 24, 68 34 Z" />
        {/* Tomoe 2 (Правый нижний вихрь) */}
        <g transform="rotate(120 50 50)">
          <path d="M 50 16 C 60 16, 68 24, 68 34 C 68 44, 60 50, 50 50 C 44 50, 40 46, 40 40 C 40 26, 44 16, 50 16 Z" />
          <path d="M 68 34 C 68 54, 50 70, 32 64 C 40 68, 56 64, 60 48 C 64 36, 60 26, 50 16 C 62 18, 68 24, 68 34 Z" />
        </g>
        {/* Tomoe 3 (Левый нижний вихрь) */}
        <g transform="rotate(240 50 50)">
          <path d="M 50 16 C 60 16, 68 24, 68 34 C 68 44, 60 50, 50 50 C 44 50, 40 46, 40 40 C 40 26, 44 16, 50 16 Z" />
          <path d="M 68 34 C 68 54, 50 70, 32 64 C 40 68, 56 64, 60 48 C 64 36, 60 26, 50 16 C 62 18, 68 24, 68 34 Z" />
        </g>
      </g>
    </svg>
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
 * SearchIcon — Минималистичная монохромная иконка лупы в традиционном стиле
 */
export function SearchIcon({ size = 18, color = 'currentColor', className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`search-icon-svg ${className}`}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7.5" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  );
}

/**
 * Градация поясов Сётокан каратэдо (Кю и Даны)
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
 * Определение пояса и ступени кю/дан для ката Сётокан
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
      <span className="dojo-belt-badge__name">{info.name}</span>
      {showKanji && <span className="dojo-belt-badge__kanji">{info.kanji}</span>}
    </span>
  );
}

