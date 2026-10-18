import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listBunkai } from '../api/bunkai';
import StatusBadge from '../components/StatusBadge';
import { HankoSeal, ShotokanTiger, DojoDivider } from '../components/ui/JapaneseDecor';
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

      {/* 2. ПОИСК И СОРТИРОВКА */}
      <div className="bunkai-search-bar">
        <input
          type="text"
          className="bunkai-search-input"
          value={search}
          onChange={(e) => updateParam('search', e.target.value)}
          placeholder="Поиск по названию или технике (гэдан-барай, залом кисти, кудзуси, маэ-гэри)…"
        />
        <select
          className="bunkai-sort-select"
          value={sort}
          onChange={(e) => updateParam('sort', e.target.value)}
          style={{ width: 'auto', minWidth: '220px' }}
        >
          <option value="newest">Сначала новые сценарии</option>
          <option value="oldest">Сначала ранние сценарии</option>
          <option value="title">По названию (А–Я)</option>
        </select>
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
                    <span className="bunkai-maai-kanji">間合</span>
                    <span>Ма-ай:</span>
                    <strong>{b.Episodes?.length > 1 ? 'Многофазный бой' : 'Иссоку-итто (Рабочая дистанция)'}</strong>
                  </div>

                  <div className="bunkai-unit__footer">
                    <span className="bunkai-unit__author">
                      <span className="bunkai-author-label">Инструктор: </span>
                      {b.Author?.Display_Name || b.Author?.Username || 'Мастер Додзё'}
                    </span>
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
    </div>
  );
}
