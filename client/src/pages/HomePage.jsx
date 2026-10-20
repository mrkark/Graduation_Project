import { Link } from 'react-router-dom';
import { HankoSeal, ShotokanTiger, DojoDivider, KakejikuScroll } from '../components/ui/JapaneseDecor';
import './HomePage.css';

export default function HomePage() {
  return (
    <div className="home fade-in">
      {/* 1. ПЕРВЫЙ ЭКРАН: ФОТОГРАФИЯ МАСТЕРА В ТРАДИЦИОННОМ ДОДЗЁ + СВИТОК КАКЭМОНО */}
      <section className="hero-dojo">
        {/* Фоновое аутентичное фото мастера в традиционном зале */}
        <div className="hero-dojo__bg" />
        {/* Многослойное градиентное затемнение для идеального контраста */}
        <div className="hero-dojo__scrim" />
        {/* Тонкий карниз додзё */}
        <div className="hero-dojo__timber-top" />

        <div className="container hero-dojo__container">
          <div className="hero-dojo__composite">
            {/* Традиционный вертикальный свиток какэмоно */}
            <div className="hero-dojo__scroll-col">
              <KakejikuScroll
                title="空手道"
                subtitle="松濤館流"
                sealText="武徳"
                className="hero-dojo__kakejiku"
              />
            </div>

            {/* Главный текстовый блок первого экрана */}
            <div className="hero-dojo__content">
              <div className="hero-dojo__kicker-wrap">
                <span className="hero-dojo__kicker">
                  伝統空手道 · 松濤館流
                </span>
                <HankoSeal text="正伝" size="sm" variant="vermilion" shape="square" title="Каноническая традиция Сётокан" />
              </div>

              <h1 className="hero-dojo__headline">
                Путь истинной формы. <br />
                Боевой дух Додзё.
              </h1>

              <p className="hero-dojo__description">
                Интерактивная среда изучения 26 канонических ката мастера Гитина Фунакоси.
                Пространственная геометрия эмбусэн, механика стоек и прикладной бункай в трёхмерном пространстве.
              </p>

              {/* Телеметрия школы Сётокан */}
              <div className="hero-dojo__telemetry">
                <div className="hero-dojo__telemetry-item">
                  <span className="hero-dojo__telemetry-kanji">型</span>
                  <span><strong>26</strong> Канонических ката</span>
                </div>
                <span className="hero-dojo__telemetry-sep">·</span>
                <div className="hero-dojo__telemetry-item">
                  <span className="hero-dojo__telemetry-kanji">分</span>
                  <span><strong>3D</strong> Боевой Бункай</span>
                </div>
                <span className="hero-dojo__telemetry-sep">·</span>
                <div className="hero-dojo__telemetry-item">
                  <span className="hero-dojo__telemetry-kanji">線</span>
                  <span><strong>Оси</strong> Эмбусэн</span>
                </div>
              </div>

              <div className="hero-dojo__actions">
                <Link to="/kata" className="btn btn-primary hero-dojo__btn-main">
                  <span>Войти в зал Ката (3D)</span>
                  <span className="btn-arrow">→</span>
                </Link>
                <Link to="/bunkai" className="btn btn-subtle hero-dojo__btn-secondary">
                  <span>Боевые разборы Бункай</span>
                  <HankoSeal text="解" size="sm" variant="vermilion" shape="circle" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ТРИ СТОЛПА ДОДЗЁ (ФОРМА, СМЫСЛ, ДИСТАНЦИЯ) */}
      <section className="pillars-section">
        <div className="container">
          <div className="section-head-dojo">
            <span className="section-kicker">Основы воинского искусства</span>
            <h2 className="section-title-dojo">Три столпа мастерства Сётокан</h2>
          </div>

          <div className="pillars-grid">
            {/* Столп 1: Эмбусэн */}
            <div className="pillar-item">
              <div className="pillar-header">
                <span className="pillar-num">一</span>
                <HankoSeal text="線" size="sm" variant="gold" shape="square" />
              </div>
              <h3 className="pillar-title">Эмбусэн (演武線) · Векторы</h3>
              <p className="pillar-text">
                Пространственная геометрия шагов и поворотов. Изучайте ось баланса, углы скручивания
                бёдер (Koshi) и траектории перемещения в интерактивном 3D-пространстве.
              </p>
              <Link to="/kata" className="pillar-link">
                <span>Каталог 26 форм</span>
                <span className="pillar-link-arr">→</span>
              </Link>
            </div>

            {/* Столп 2: Кимэ */}
            <div className="pillar-item">
              <div className="pillar-header">
                <span className="pillar-num">二</span>
                <HankoSeal text="極" size="sm" variant="vermilion" shape="square" />
              </div>
              <h3 className="pillar-title">Кимэ (極め) · Фокус силы</h3>
              <p className="pillar-text">
                Предельная концентрация взрывной силы в точке удара с мгновенной фиксацией суставов
                и брюшного пресса (Тандэн). Точность важнее грубой силы.
              </p>
              <Link to="/bunkai" className="pillar-link">
                <span>Сценарии бункай</span>
                <span className="pillar-link-arr">→</span>
              </Link>
            </div>

            {/* Столп 3: Ма-ай */}
            <div className="pillar-item">
              <div className="pillar-header">
                <span className="pillar-num">三</span>
                <HankoSeal text="間" size="sm" variant="gold" shape="square" />
              </div>
              <h3 className="pillar-title">Ма-ай (間合い) · Дистанция</h3>
              <p className="pillar-text">
                Динамический контроль боевой дистанции между Тори и Укэ. Анализ дистанций
                Тика-ма (ближняя), Иссоку-итто (шаг-удар) и То-ма (дальняя).
              </p>
              <Link to="/karate-studio" className="pillar-link">
                <span>3D Мокап Студия</span>
                <span className="pillar-link-arr">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Японский орнаментальный разделитель */}
      <DojoDivider kanji="松濤館" />

      {/* 3. ВИТРИНА НАЧАЛЬНЫХ ФОРМ ХЭЙАН */}
      <section className="showcase-section container">
        <div className="showcase-header">
          <div>
            <span className="section-kicker">Базовая школа Сётокан · 平安五段</span>
            <h2 className="showcase-title">Пять форм Хэйан (Мирный дух)</h2>
          </div>
          <Link to="/kata" className="showcase-all-link">
            <span>Все 26 ката Сётокан</span>
            <span className="showcase-all-arr">→</span>
          </Link>
        </div>

        <div className="showcase-grid">
          {/* Хэйан Сёдан */}
          <Link to="/kata/1" className="showcase-card">
            <div className="showcase-card__top">
              <span className="showcase-card__tag showcase-card__tag--white">
                9–7 Кю · Белый / Жёлтый
              </span>
              <HankoSeal text="初段" size="sm" variant="vermilion" shape="square" />
            </div>
            <h3 className="showcase-card__title">Хэйан Сёдан</h3>
            <span className="showcase-card__jp">平安初段 · 21 шаг</span>
            <p className="showcase-card__desc">
              Базовые блоки гэдан-барай, прямолинейные выпады ой-цуки и стойка дзэнкуцу-дати. Освоение крестообразной оси эмбусэн.
            </p>
            <span className="showcase-card__action">Изучить в 3D →</span>
          </Link>

          {/* Хэйан Нидан */}
          <Link to="/kata/2" className="showcase-card">
            <div className="showcase-card__top">
              <span className="showcase-card__tag showcase-card__tag--green">
                6–5 Кю · Зелёный
              </span>
              <HankoSeal text="二段" size="sm" variant="vermilion" shape="square" />
            </div>
            <h3 className="showcase-card__title">Хэйан Нидан</h3>
            <span className="showcase-card__jp">平安二段 · 26 шагов</span>
            <p className="showcase-card__desc">
              Удары ногами маэ-гэри и ёко-гэри, переход в заднюю защитную стойку кокуцу-дати с блоком сюто-укэ.
            </p>
            <span className="showcase-card__action">Изучить в 3D →</span>
          </Link>

          {/* Хэйан Сандан */}
          <Link to="/kata/3" className="showcase-card">
            <div className="showcase-card__top">
              <span className="showcase-card__tag showcase-card__tag--blue">
                4 Кю · Синий
              </span>
              <HankoSeal text="三段" size="sm" variant="vermilion" shape="square" />
            </div>
            <h3 className="showcase-card__title">Хэйан Сандан</h3>
            <span className="showcase-card__jp">平安三段 · 20 шагов</span>
            <p className="showcase-card__desc">
              Освобождение от захватов, блок ути-укэ и переход в низкую прочную стойку киба-дати (стойка всадника).
            </p>
            <span className="showcase-card__action">Изучить в 3D →</span>
          </Link>
        </div>
      </section>

      {/* 4. ТЕМАТИЧЕСКИЙ БАННЕР-СВИТОК «ЭМБУСЭН» (ДЭНСЁ / 伝書) */}
      <section className="container">
        <div className="scroll-banner">
          <div className="scroll-banner__roller scroll-banner__roller--top" />
          <div className="scroll-banner__inner">
            <div className="scroll-banner__left">
              <div className="scroll-banner__stamp-row">
                <span className="scroll-banner__stamp">演武線の掟 · КАНОН ПЕРЕМЕЩЕНИЙ</span>
                <HankoSeal text="演武" size="sm" variant="vermilion" shape="square" />
              </div>
              <h3 className="scroll-banner__title">Священная Линия «Эмбусэн»</h3>
              <p className="scroll-banner__quote">
                «Ката — это не танец. Каждый шаг на линии эмбусэн — это решение реального поединка, где жизнь и смерть разделены долей секунды.»
              </p>
              <span className="scroll-banner__author">— Мастер Анко Итосу, реформатор окинавского каратэ</span>
            </div>

            <div className="scroll-banner__axis-box">
              <div className="scroll-banner__axis-header">
                <span>4 Направления боя (Сихо · 四方)</span>
                <HankoSeal text="方" size="sm" variant="gold" shape="circle" />
              </div>
              <div className="scroll-banner__axis-grid">
                <div className="scroll-banner__axis-item">
                  <strong>Сёмэн (正面)</strong> · Фронт (0°)
                </div>
                <div className="scroll-banner__axis-item">
                  <strong>Усиро (後ろ)</strong> · Тыл (180°)
                </div>
                <div className="scroll-banner__axis-item">
                  <strong>Миги (右)</strong> · Правый фланг (90°)
                </div>
                <div className="scroll-banner__axis-item">
                  <strong>Хидари (左)</strong> · Левый фланг (270°)
                </div>
              </div>
            </div>
          </div>
          <div className="scroll-banner__roller scroll-banner__roller--bottom" />
        </div>
      </section>

      {/* 5. МАСТЕРСКАЯ БОЕВОГО МОДЕЛИРОВАНИЯ (СТУДИЯ БУНКАЙ) */}
      <section className="studio-callout-section">
        <div className="container studio-callout__container">
          <div className="studio-callout__text">
            <div className="studio-callout__crest-row">
              <ShotokanTiger size={42} color="var(--gold)" />
            </div>
            <span className="section-kicker">Трёхмерная симуляция поединка · 応用分解</span>
            <h2 className="studio-callout__title">
              Студия боевого анализа Bunkai
            </h2>
            <p className="studio-callout__desc">
              Конструируйте собственные цепочки поединка, регулируйте углы атаки нападающего и
              дистанцию Ма-ай в трёхмерной симуляции двух и трёх каратек в реальном времени.
            </p>
            <div className="studio-callout__actions">
              <Link to="/bunkai/new" className="btn btn-vermilion">
                <span>Открыть мастерскую бункай</span>
                <HankoSeal text="鍛" size="sm" variant="gold" shape="square" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. ФИЛОСОФСКОЕ НАСТАВЛЕНИЕ МАСТЕРА ФУНАКОСИ (НИДЗЮ КУН) */}
      <section className="quote-section container">
        <div className="quote-editorial-plaque">
          <div className="quote-editorial-plaque__crest">
            <ShotokanTiger size={32} color="var(--gold-soft)" />
          </div>
          <blockquote className="quote-editorial">
            <p className="quote-text">
              «Каратэ начинается и заканчивается с поклона. В каратэ нет первого нападения (Каратэ ни сэнтэ наси).»
            </p>
            <cite className="quote-author">
              <span className="quote-author-name">— Гитин Фунакоси, основатель стиля Сётокан</span>
              <span className="quote-author-jp">船越 義珍 · 二十条</span>
            </cite>
          </blockquote>
          <HankoSeal text="松濤" size="md" variant="vermilion" shape="square" className="quote-editorial-plaque__seal" />
        </div>
      </section>
    </div>
  );
}
