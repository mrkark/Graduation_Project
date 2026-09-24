import { useState, useMemo } from 'react';
import { SHOTOKAN_CATEGORIES, SHOTOKAN_TECHNIQUES } from '../data/shotokanTechniques';
import './TechniquePicker.css';

export default function TechniquePicker({ onSelect, onCancel }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredTechniques = useMemo(() => {
    const query = search.trim().toLowerCase();
    return SHOTOKAN_TECHNIQUES.filter((tech) => {
      const matchCategory = activeCategory === 'all' || tech.category === activeCategory;
      if (!matchCategory) return false;
      if (!query) return true;

      return (
        tech.nameRu.toLowerCase().includes(query) ||
        tech.nameRomaji.toLowerCase().includes(query) ||
        tech.kanji.includes(query) ||
        tech.level.toLowerCase().includes(query) ||
        tech.description.toLowerCase().includes(query)
      );
    });
  }, [search, activeCategory]);

  return (
    <div className="tech-picker">
      <div className="tech-picker__header">
        <div className="tech-picker__title-row">
          <span className="hanko">松濤館</span>
          <h3>Каталог техник Сётокан каратэдо</h3>
          {onCancel && (
            <button type="button" className="btn btn-close-picker" onClick={onCancel}>
              ✕
            </button>
          )}
        </div>
        <p className="tech-picker__subtitle">
          Введите название стойки, блока или удара для мгновенной фильтрации
        </p>

        {/* Поле живого поиска */}
        <div className="tech-picker__search-wrap">
          <input
            type="text"
            className="tech-picker__search-input"
            placeholder="Поиск техники (например: Дзэнкуцу, Укэ, Гяку, Маэ-гэри, Zenkutsu)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button
              type="button"
              className="tech-picker__clear-btn"
              onClick={() => setSearch('')}
            >
              ✕
            </button>
          )}
        </div>

        {/* Категории техник */}
        <div className="tech-picker__categories">
          {SHOTOKAN_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`tech-picker__cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span className="cat-kanji">{cat.kanji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Список отфильтрованных техник */}
      <div className="tech-picker__grid">
        {filteredTechniques.length === 0 ? (
          <div className="tech-picker__empty">
            <span className="empty-kanji">無</span>
            <p>Техника с названием «{search}» не найдена в каноне Сётокан.</p>
            <small>Попробуйте ввести базовое название на русском или ромадзи.</small>
          </div>
        ) : (
          filteredTechniques.map((tech) => (
            <div
              key={tech.id}
              className="tech-card"
              onClick={() => onSelect && onSelect(tech)}
            >
              <div className="tech-card__top">
                <div className="tech-card__badge-kanji">{tech.iconSymbol}</div>
                <span className="tech-card__level">{tech.level}</span>
              </div>

              <div className="tech-card__names">
                <h4 className="tech-card__ru">{tech.nameRu}</h4>
                <div className="tech-card__romaji">
                  <span>{tech.nameRomaji}</span>
                  <span className="tech-card__kanji-txt">{tech.kanji}</span>
                </div>
              </div>

              <p className="tech-card__desc">{tech.description}</p>

              <button
                type="button"
                className="btn btn-gold btn-select-tech"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect && onSelect(tech);
                }}
              >
                + Выбрать для шага
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
