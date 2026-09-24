import { Link } from 'react-router-dom';
import karateMasterRealistic from '../assets/karate_master_realistic.jpg';
import './HomePage.css';

export default function HomePage() {
  return (
    <div className="home-page">
      {/* --- HERO ЭКРАН: ТЕКСТ СЛЕВА, РЕАЛИСТИЧНЫЙ МАСТЕР СПРАВА --- */}
      <section className="hero-split">
        {/* Фоновое полотно с реалистичным мастером каратэ */}
        <div
          className="hero-split__bg"
          style={{ backgroundImage: `url(${karateMasterRealistic})` }}
        />

        {/* Затемняющий градиент слева для безупречной читаемости текста */}
        <div className="hero-split__gradient-overlay" />

        <div className="container hero-split__container">
          {/* Левая колонка: описание приложения */}
          <div className="hero-split__text-col">
            <div className="hero-split__badge">
              <span className="hanko">分解</span>
              <span className="hero-split__badge-text">
                ЭНЦИКЛОПЕДИЯ БОЕВОГО ИСКУССТВА
              </span>
            </div>

            <h1 className="hero-split__title">
              <span className="hero-split__title-gold">BUNKAI</span> EXPLORER
            </h1>

            <div className="hero-split__kanji-title">
              <span className="kanji-main">分解探検家</span>
              <span className="kanji-separator">·</span>
              <span className="kanji-sub">空手道の真髄</span>
            </div>

            <blockquote className="hero-split__quote">
              «Ката учит форме. Бункай раскрывает, зачем она нужна».
            </blockquote>

            <p className="hero-split__desc">
              Интерактивная энциклопедия традиционного каратэдо: изучайте технику по шагам,
              исследуйте скрытые боевые применения каждого движения, делитесь своими трактовками
              и обсуждайте мастерство с додзё в реальном времени.
            </p>

            <div className="hero-split__actions">
              <Link to="/kata" className="btn btn-primary btn-hero-split">
                <span className="btn-kanji">型</span>
                <span>Открыть каталог ката</span>
              </Link>
              <Link to="/bunkai" className="btn btn-gold btn-hero-split">
                <span className="btn-kanji">解</span>
                <span>Каталог бункаев</span>
              </Link>
            </div>

            <div className="hero-split__stats">
              <div className="stat-pill">
                <span className="stat-pill__num">4</span>
                <span className="stat-pill__txt">Традиционных стиля</span>
              </div>
              <div className="stat-pill-divider" />
              <div className="stat-pill">
                <span className="stat-pill__num">20+</span>
                <span className="stat-pill__txt">Канонических форм</span>
              </div>
              <div className="stat-pill-divider" />
              <div className="stat-pill">
                <span className="stat-pill__num">100%</span>
                <span className="stat-pill__txt">Разборы бункай</span>
              </div>
            </div>
          </div>
        </div>

        {/* Нижний индикатор прокрутки */}
        <a href="#pillars" className="hero-split__scroll-hint">
          <span>Столпы практики</span>
          <span className="scroll-arrow">↓</span>
        </a>
      </section>

      {/* --- DOJO PILLARS / СТОЛПЫ ПРАКТИКИ (В 1 ЛИНИЮ НА БОЛЬШИХ ЭКРАНАХ) --- */}
      <section id="pillars" className="dojo-pillars container">
        <div className="section-title-wrap">
          <span className="section-kanji-sub">道場の柱</span>
          <h2 className="section-title">Столпы Практики Каратэ</h2>
          <div className="section-line" />
        </div>

        <div className="pillars-grid">
          <div className="pillar-card">
            <div className="pillar-card__top">
              <div className="pillar-card__kanji-badge">型</div>
              <span className="pillar-card__en">KATA</span>
            </div>
            <h3 className="pillar-card__title">Традиционные Ката</h3>
            <p className="pillar-card__desc">
              Энциклопедия канонических форм стилей Сётокан, Годзю-рю, Вадо-рю и Сито-рю.
              Пошаговый разбор стоек, траекторий блоков и направлений взгляда (эмбусэн).
            </p>
            <Link to="/kata" className="pillar-card__link">
              Изучить каталог ката →
            </Link>
          </div>

          <div className="pillar-card">
            <div className="pillar-card__top">
              <div className="pillar-card__kanji-badge">解</div>
              <span className="pillar-card__en">BUNKAI</span>
            </div>
            <h3 className="pillar-card__title">Практический Бункай</h3>
            <p className="pillar-card__desc">
              Раскрытие скрытого боевого смысла движений формы. Анализ дистанции поражения (ма-ай),
              уязвимых точек и контрприёмов от реального нападения.
            </p>
            <Link to="/bunkai" className="pillar-card__link">
              Смотреть разборы бункай →
            </Link>
          </div>

          <div className="pillar-card">
            <div className="pillar-card__top">
              <div className="pillar-card__kanji-badge">話</div>
              <span className="pillar-card__en">DOJO CHAT</span>
            </div>
            <h3 className="pillar-card__title">Живое Общение Додзё</h3>
            <p className="pillar-card__desc">
              Обсуждайте техники в общем тренировочном зале, задавайте вопросы опытным практикам
              и ведите персональные диалоги с соратниками в реальном времени.
            </p>
            <Link to="/chat" className="pillar-card__link">
              Войти в зал общения →
            </Link>
          </div>

          <div className="pillar-card">
            <div className="pillar-card__top">
              <div className="pillar-card__kanji-badge">友</div>
              <span className="pillar-card__en">NAKAMA</span>
            </div>
            <h3 className="pillar-card__title">Братство Мастеров</h3>
            <p className="pillar-card__desc">
              Находите единомышленников по вашей школе каратэ, добавляйте в друзья, обменивайтесь
              видеоматериалами и формируйте тренировочные группы.
            </p>
            <Link to="/friends" className="pillar-card__link">
              Найти соратников →
            </Link>
          </div>
        </div>
      </section>

      {/* --- NIJU KUN / ФИЛОСОФИЯ МАСТЕРА --- */}
      <section className="philosophy-section container">
        <div className="philosophy-inner">
          <div className="philosophy-watermark">空手</div>
          <div className="philosophy-content">
            <span className="philosophy-eyebrow">松濤館流 · ДВАДЦАТЬ НАСТАВЛЕНИЙ КАРАТЭ</span>
            <h2 className="philosophy-heading">Принципы Истинного Мастера (Нидзю Кун)</h2>
            <div className="philosophy-rules">
              <div className="philosophy-rule">
                <span className="philosophy-rule__num">一</span>
                <div>
                  <strong>Каратэ начинается и заканчивается поклоном</strong>
                  <p>Уважение к сопернику, залу и наставнику — основа любого боевого искусства.</p>
                </div>
              </div>
              <div className="philosophy-rule">
                <span className="philosophy-rule__num">二</span>
                <div>
                  <strong>В каратэ нет первого нападения (Каратэ ни сэнтэ наси)</strong>
                  <p>Оружие каратиста используется только ради защиты справедливости и жизни.</p>
                </div>
              </div>
              <div className="philosophy-rule">
                <span className="philosophy-rule__num">三</span>
                <div>
                  <strong>Сначала познай себя, затем познай других</strong>
                  <p>Победа над собственными слабостями предшествует победе в поединке.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
