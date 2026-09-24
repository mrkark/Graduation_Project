import { useEffect, useState } from 'react';
import { bunkaiApi } from '../api/endpoints';
import BunkaiCard from '../components/ui/BunkaiCard';

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

export default function BunkaiCatalog() {
  const [items, setItems] = useState([]);
  const [difficulty, setDifficulty] = useState('');

  useEffect(() => {
    bunkaiApi.list({ difficulty: difficulty || undefined, limit: 40 }).then((r) => setItems(r.data.data.items));
  }, [difficulty]);

  return (
    <div className="container section">
      <h1 style={{ marginBottom: 24 }}>Бункай</h1>

      <div className="filters-bar">
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="">Любая сложность</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="card-grid">
        {items.map((b) => (
          <BunkaiCard key={b.id} bunkai={b} />
        ))}
        {items.length === 0 && <p style={{ color: 'var(--washi-dim)' }}>Бункай не найдены.</p>}
      </div>
    </div>
  );
}
