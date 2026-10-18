import { Link } from 'react-router-dom';
import { ThumbsUp } from 'lucide-react';
import Badge from './Badge';
import { HankoSeal } from './JapaneseDecor';

export default function BunkaiCard({ bunkai }) {
  return (
    <Link to={`/bunkai/${bunkai.id}`} className="washi-panel bunkai-card">
      <div className="bunkai-card-head">
        <Badge tone={bunkai.difficulty}>{bunkai.difficulty}</Badge>
        <span className="bunkai-card-rating"><ThumbsUp size={14} /> {bunkai.rating}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <h3 className="bunkai-card-title">{bunkai.title}</h3>
        <HankoSeal text="解" size="sm" variant="vermilion" shape="square" />
      </div>
      <p className="bunkai-card-desc">{bunkai.description}</p>
      {bunkai.author && <p className="bunkai-card-author">от {bunkai.author.username}</p>}
    </Link>
  );
}
