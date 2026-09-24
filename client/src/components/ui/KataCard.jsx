import { Link } from 'react-router-dom';

export default function KataCard({ kata }) {
  return (
    <Link to={`/kata/${kata.id}`} className="washi-panel kata-card">
      <div className="kata-card-thumb" style={{ backgroundImage: `url(${kata.thumbnailUrl || ''})` }} />
      <div className="kata-card-body">
        <p className="kata-card-jp">{kata.nameJp}</p>
        <h3 className="kata-card-title">{kata.name}</h3>
        <p className="kata-card-meta">{kata.style} · {kata.kyuLevel}</p>
      </div>
    </Link>
  );
}
