import { Link } from 'react-router-dom';
import karateMasterRealistic from '../assets/karate_master_realistic.jpg';
import './HomePage.css';

export default function HomePage() {
  return (
    <div className="home">
      {/* 1. ПЕРВЫЙ ЭКРАН: ОДИН ЦЕНТР ВНИМАНИЯ, СВОБОДНОЕ ПРОСТРАНСТВО */}
      <section className="hero container">
        <div className="hero__content">
          <span className="hero__kicker">
            Сётокан Каратэдо · Трёхмерная биомеханика
          </span>

          <h1 className="hero__headline">
            Искусство формы. <br />
            Смысл каждого движения.
          </h1>

          <p className="hero__description">
            Интерактивная среда для глубокого освоения 26 канонических ката и расшифровки
            боевого применения бункай через трёхмерное моделирование и пространственный анализ.
          </p>

          <div className="hero__actions">
            <Link to="/kata" className="btn btn-primary hero__btn-main">
              Исследовать каталог ката
            </Link>
            <Link to="/bunkai" className="btn btn-subtle hero__btn-secondary">
              Разборы бункай →
            </Link>
          </div>
        </div>

        <div className="hero__visual">
          <div className="hero__image-frame">
            <img
              src={karateMasterRealistic}
              alt="Мастер Сётокан Каратэ в Додзё"
              className="hero__image"
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* 2. ТРИ ГРАНИ МАСТЕРСТВА (РЕДАКТОРСКАЯ КОМПОЗИЦИЯ С ТОНКИМИ ЛИНИЯМИ) */}
      <section className="pillars-section">
        <div className="container">
          <div className="pillars-grid">
            <div className="pillar-item">
              <span className="pillar-num">01</span>
              <h2 className="pillar-title">Ката (型) · Форма</h2>
              <p className="pillar-text">
                Каноническая последовательность шагов, заложенная мастерами прошлого.
                Изучайте геометрию стоек, линию перемещений эмбусэн и точки концентрации силы кимэ в трёхмерном пространстве.
              </p>
              <Link to="/kata" className="pillar-link">
                Каталог 26 форм →
              </Link>
            </div>

            <div className="pillar-item">
              <span className="pillar-num">02</span>
              <h2 className="pillar-title">Бункай (分解) · Смысл</h2>
              <p className="pillar-text">
                Расшифровка прикладного применения движений ката против реального противника.
                Заломы суставов, выведение из равновесия кудзуси, уходы с линии атаки и опережающие удары.
              </p>
              <Link to="/bunkai" className="pillar-link">
                Сценарии применения →
              </Link>
            </div>

            <div className="pillar-item">
              <span className="pillar-num">03</span>
              <h2 className="pillar-title">Ма-ай (間合い) · Дистанция</h2>
              <p className="pillar-text">
                Чувство боевой дистанции и тайминг атаки. Подключайте камеру смартфона для
                захвата движений через компьютерное зрение Aimokap и сравнивайте исполнение с эталоном.
              </p>
              <Link to="/motion-lab" className="pillar-link">
                Лаборатория Aimokap →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3. КАТА ХЭЙАН: ФУНДАМЕНТ СПОКОЙСТВИЯ */}
      <section className="showcase-section container">
        <div className="showcase-header">
          <div>
            <span className="section-kicker">Базовая школа</span>
            <h2 className="showcase-title">Пять форм Хэйан (Мирный дух)</h2>
          </div>
          <Link to="/kata" className="showcase-all-link">
            Все 26 ката Сётокан →
          </Link>
        </div>

        <div className="showcase-grid">
          <Link to="/kata/1" className="showcase-card">
            <div className="showcase-card__tag">9–7 Кю · Белый / Жёлтый</div>
            <h3 className="showcase-card__title">Хэйан Сёдан</h3>
            <span className="showcase-card__jp">平安初段</span>
            <p className="showcase-card__desc">
              Базовые блоки гэдан-барай, прямолинейные выпады ой-цуки и стойка дзэнкуцу-дати. 21 движение.
            </p>
            <span className="showcase-card__action">Изучить в 3D →</span>
          </Link>

          <Link to="/kata/2" className="showcase-card">
            <div className="showcase-card__tag">6–5 Кю · Зелёный</div>
            <h3 className="showcase-card__title">Хэйан Нидан</h3>
            <span className="showcase-card__jp">平安二段</span>
            <p className="showcase-card__desc">
              Удары ногами маэ-гэри и ёко-гэри, переход в заднюю защитную стойку кокуцу-дати. 26 движений.
            </p>
            <span className="showcase-card__action">Изучить в 3D →</span>
          </Link>

          <Link to="/kata/3" className="showcase-card">
            <div className="showcase-card__tag">4 Кю · Синий</div>
            <h3 className="showcase-card__title">Хэйан Сандан</h3>
            <span className="showcase-card__jp">平安三段</span>
            <p className="showcase-card__desc">
              Освобождение от захватов, блок ути-укэ и переход в низкую прочную стойку киба-дати. 20 движений.
            </p>
            <span className="showcase-card__action">Изучить в 3D →</span>
          </Link>
        </div>
      </section>

      {/* 4. БОЛЬШАЯ СТУДИЯ БУНКАЙ И ТРЁХМЕРНЫЙ АНАЛИЗ */}
      <section className="studio-callout-section">
        <div className="container studio-callout__container">
          <div className="studio-callout__text">
            <span className="section-kicker">Интерактивный конструктор</span>
            <h2 className="studio-callout__title">
              Студия боевого анализа Bunkai
            </h2>
            <p className="studio-callout__desc">
              Создавайте собственные цепочки поединка, регулируйте углы атаки нападающего и
              дистанцию Ма-ай в трёхмерной симуляции двух и трёх каратек в реальном времени.
            </p>
            <Link to="/bunkai/new" className="btn btn-primary">
              Открыть мастерскую бункай
            </Link>
          </div>
        </div>
      </section>

      {/* 5. ФИЛОСОФИЯ МАСТЕРА ФУНАКОСИ (СПОКОЙНОЕ ПРОСТРАНСТВО) */}
      <section className="quote-section container">
        <blockquote className="quote-editorial">
          <p className="quote-text">
            «Каратэ начинается и заканчивается с поклона. В каратэ нет первого нападения.»
          </p>
          <cite className="quote-author">
            — Гитин Фунакоси, основатель стиля Сётокан (Нидзю Кун)
          </cite>
        </blockquote>
      </section>
    </div>
  );
}
