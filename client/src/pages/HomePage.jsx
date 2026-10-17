import { Link } from 'react-router-dom';
import karateMasterRealistic from '../assets/karate_master_realistic.jpg';
import './HomePage.css';

export default function HomePage() {
  return (
    <div className="home">
      {/* 1. ПЕРВЫЙ ЭКРАН: АНАТОМИЯ МАСТЕРСТВА И ВЕКТОРЫ СИЛЫ */}
      <section className="hero container">
        <div className="hero__content">
          <span className="hero__kicker">
            松濤館流 · JKA Анатомия мастерства
          </span>

          <h1 className="hero__headline">
            Анатомия формы. <br />
            Биомеханика поединка.
          </h1>

          <p className="hero__description">
            Интерактивный свод 26 канонических ката Сётокан. Траектории перемещений эмбусэн,
            геометрия стоек и расшифровка прикладного бункай в трёхмерном пространстве.
          </p>

          <div className="hero__telemetry">
            <span>Стандарт: <strong>JKA</strong></span>
            <span>·</span>
            <span>Вектор: <strong>Сёмэн (0°)</strong></span>
            <span>·</span>
            <span>Фокус силы: <strong>Кимэ (Тюдан)</strong></span>
          </div>

          <div className="hero__actions">
            <Link to="/kata" className="btn btn-primary hero__btn-main">
              Изучить 26 ката в 3D →
            </Link>
            <Link to="/bunkai" className="btn btn-subtle hero__btn-secondary">
              Боевая механика Бункай
            </Link>
          </div>
        </div>

        <div className="hero__visual">
          <div className="hero__image-frame">
            <img
              src={karateMasterRealistic}
              alt="Мастер Сётокан Каратэ в момент Кимэ"
              className="hero__image"
              loading="eager"
            />
            <div className="hero__image-badge">
              <span className="hero__image-badge-title">極め · KIME (Фокус силы)</span>
              <span className="hero__image-badge-sub">Стойка Дзэнкуцу-дати</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ТРИ СТОЛПА КАНОНИЧЕСКОЙ БИОМЕХАНИКИ */}
      <section className="pillars-section">
        <div className="container">
          <div className="pillars-grid">
            <div className="pillar-item">
              <span className="pillar-num">01</span>
              <h2 className="pillar-title">Эмбусэн (演武線) · Векторы</h2>
              <p className="pillar-text">
                Пространственная геометрия шагов и поворотов. Изучайте ось баланса, углы скручивания
                бёдер и траектории перемещения в интерактивном 3D-пространстве.
              </p>
              <Link to="/kata" className="pillar-link">
                Каталог 26 форм →
              </Link>
            </div>

            <div className="pillar-item">
              <span className="pillar-num">02</span>
              <h2 className="pillar-title">Кимэ (極め) · Фокус</h2>
              <p className="pillar-text">
                Предельная концентрация взрывной силы в точке удара с мгновенной фиксацией суставов
                и брюшного пресса (Тандэн). Точность важнее грубой силы.
              </p>
              <Link to="/bunkai" className="pillar-link">
                Сценарии бункай →
              </Link>
            </div>

            <div className="pillar-item">
              <span className="pillar-num">03</span>
              <h2 className="pillar-title">Ма-ай (間合い) · Дистанция</h2>
              <p className="pillar-text">
                Динамический контроль боевой дистанции между Тори и Укэ. Анализ дистанций
                Тика-ма (ближняя), Иссоку-итто (шаг-удар) и То-ма (дальняя).
              </p>
              <Link to="/motion-lab" className="pillar-link">
                Лаборатория Aimokap →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3. КАТА ХЭЙАН: БАЗОВЫЙ КАНОН */}
      <section className="showcase-section container">
        <div className="showcase-header">
          <div>
            <span className="section-kicker">Базовая школа Сётокан</span>
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
            <span className="showcase-card__jp">平安初段 · 21 шаг</span>
            <p className="showcase-card__desc">
              Базовые блоки гэдан-барай, прямолинейные выпады ой-цуки и стойка дзэнкуцу-дати. Освоение оси эмбусэн.
            </p>
            <span className="showcase-card__action">Изучить в 3D →</span>
          </Link>

          <Link to="/kata/2" className="showcase-card">
            <div className="showcase-card__tag">6–5 Кю · Зелёный</div>
            <h3 className="showcase-card__title">Хэйан Нидан</h3>
            <span className="showcase-card__jp">平安二段 · 26 шагов</span>
            <p className="showcase-card__desc">
              Удары ногами маэ-гэри и ёко-гэри, переход в заднюю защитную стойку кокуцу-дати с блоком сюто-укэ.
            </p>
            <span className="showcase-card__action">Изучить в 3D →</span>
          </Link>

          <Link to="/kata/3" className="showcase-card">
            <div className="showcase-card__tag">4 Кю · Синий</div>
            <h3 className="showcase-card__title">Хэйан Сандан</h3>
            <span className="showcase-card__jp">平安三段 · 20 шагов</span>
            <p className="showcase-card__desc">
              Освобождение от захватов, блок ути-укэ и переход в низкую прочную стойку киба-дати (всадник).
            </p>
            <span className="showcase-card__action">Изучить в 3D →</span>
          </Link>
        </div>
      </section>

      {/* 4. МАСТЕРСКАЯ БОЕВОГО МОДЕЛИРОВАНИЯ (СТУДИЯ) */}
      <section className="studio-callout-section">
        <div className="container studio-callout__container">
          <div className="studio-callout__text">
            <span className="section-kicker">Трёхмерная симуляция поединка</span>
            <h2 className="studio-callout__title">
              Студия боевого анализа Bunkai
            </h2>
            <p className="studio-callout__desc">
              Конструируйте собственные цепочки поединка, регулируйте углы атаки нападающего и
              дистанцию Ма-ай в трёхмерной симуляции двух и трёх каратек в реальном времени.
            </p>
            <Link to="/bunkai/new" className="btn btn-primary">
              Открыть мастерскую бункай
            </Link>
          </div>
        </div>
      </section>

      {/* 5. ФИЛОСОФСКОЕ НАСТАВЛЕНИЕ МАСТЕРА ФУНАКОСИ */}
      <section className="quote-section container">
        <blockquote className="quote-editorial">
          <p className="quote-text">
            «Каратэ начинается и заканчивается с поклона. В каратэ нет первого нападения (Каратэ ни сэнтэ наси).»
          </p>
          <cite className="quote-author">
            — Гитин Фунакоси, основатель стиля Сётокан (Нидзю Кун)
          </cite>
        </blockquote>
      </section>
    </div>
  );
}
