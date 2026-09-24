import { useEffect, useState } from 'react';
import { kataApi } from '../api/endpoints';
import KataCard from '../components/ui/KataCard';

const STYLES = ['Shotokan', 'Goju-Ryu', 'Shito-Ryu', 'Wado-Ryu'];

export default function Catalog() {
  const [items, setItems] = useState([]);
  const [style, setStyle] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    kataApi.list({ style: style || undefined, search: search || undefined }).then((r) => setItems(r.data.data));
  }, [style, search]);

  return (
    <div className="container section">
      <h1 style={{ marginBottom: 24 }}>Каталог ката</h1>

      <div className="filters-bar">
        <input
          placeholder="Поиск по названию (рус/яп)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={style} onChange={(e) => setStyle(e.target.value)}>
          <option value="">Все стили</option>
          {STYLES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="card-grid">
        {items.map((k) => (
          <KataCard key={k.id} kata={k} />
        ))}
        {items.length === 0 && <p style={{ color: 'var(--washi-dim)' }}>Ката не найдены.</p>}
      </div>
    </div>
  );
}
