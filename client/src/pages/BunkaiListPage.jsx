import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listBunkai } from '../api/bunkai';
import StatusBadge from '../components/StatusBadge';
import './BunkaiListPage.css';

const DIFFICULTY_MAP = {
  beginner: 'Базовый уровень',
  intermediate: 'Средний уровень',
  advanced: 'Продвинутый уровень',
  master: 'Мастерский уровень',
};

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
    listBunkai({ search, sort, page, pageSize: 24 })
      .then((res) => {
        if (cancelled) return;
        setItems(res.data || []);
        setMeta(res.meta || { total: res.data?.length || 0 });
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [search, sort, page]);

  function updateParam(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set('page', '1');
    setParams(next);
  }

  return (
    <div className="container bunkai-catalog">
      {/* 1. ЭДИЦИОННАЯ ШАПКА РАЗБОРОВ БУНКАЙ */}
      <header className="bunkai-header">
        <div>
          <span className="bunkai-header__eyebrow">Оё-Бункай · Боевое применение</span>
          <h1 className="bunkai-header__title">Каталог боевых сценариев</h1>
          <p className="bunkai-header__subtitle">
            Практическая расшифровка скрытых боевых техник ката против реальных ударов, захватов и вооруженных атак в трёхмерном пространстве.
          </p>
        </div>

        <Link to="/bunkai/new" className="btn btn-primary">
          + Сконструировать бункай
        </Link>
      </header>

      {/* 2. ПОИСК */}
      <div className="bunkai-search-bar">
        <input
          type="text"
          className="bunkai-search-input"
          value={search}
          onChange={(e) => updateParam('search', e.target.value)}
          placeholder="Поиск по названию или технике (гэдан-барай, залом кисти, кудзуси, маэ-гэри)…"
        />
      </div>

      {/* 3. СПИСОК БОЕВЫХ СИТУАЦИЙ */}
      {loading ? (
        <p className="loading">Загрузка боевых сценариев…</p>
      ) : items.length === 0 ? (
        <p className="empty-state">Боевые сценарии бункай не найдены.</p>
      ) : (
        <div className="bunkai-grid">
          {items.map((b) => {
            const diffLabel = DIFFICULTY_MAP[b.Difficulty] || b.Difficulty || 'Практика';
            return (
              <Link to={`/bunkai/${b.Bunkai_ID}`} key={b.Bunkai_ID} className="bunkai-unit">
                <div>
                  <div className="bunkai-unit__dynamic-strip">
                    <span className="bunkai-unit__roles">
                      <span>Укэ (Атака)</span>
                      <span className="bunkai-unit__role-arrow">→</span>
                      <span>Тори (Защита)</span>
                    </span>
                    <span className="bunkai-unit__difficulty">{diffLabel}</span>
                  </div>

                  <h3 className="bunkai-unit__title">{b.Title}</h3>

                  <p className="bunkai-unit__desc">
                    {b.Description ||
                      'Пошаговый тактический разбор выхода на дистанцию контратаки с выведением противника из равновесия.'}
                  </p>
                </div>

                <div>
                  <div className="bunkai-unit__maai-badge">
                    <span>🥋 Ма-ай:</span>
                    <strong>{b.Episodes?.length > 1 ? 'Многофазный бой' : 'Иссоку-итто (Рабочая дистанция)'}</strong>
                  </div>

                  <div className="bunkai-unit__footer">
                    <span className="bunkai-unit__author">
                      {b.Author?.Display_Name || b.Author?.Username || 'Мастер Додзё'}
                    </span>
                    <span className="bunkai-unit__action">
                      Симуляция 3D →
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
