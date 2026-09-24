import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { bunkaiApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import TimecodePlayer from '../components/youtube/TimecodePlayer';
import BunkaiCard from '../components/ui/BunkaiCard';
import Badge from '../components/ui/Badge';
import { parseVideoId } from '../utils/youtube';

export default function BunkaiPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [bunkai, setBunkai] = useState(null);
  const [comments, setComments] = useState([]);
  const [relations, setRelations] = useState([]);
  const [text, setText] = useState('');
  const [myVote, setMyVote] = useState(0);

  function load() {
    bunkaiApi.getOne(id).then((r) => setBunkai(r.data.data));
    bunkaiApi.comments(id).then((r) => setComments(r.data.data));
    bunkaiApi.relations(id).then((r) => setRelations(r.data.data));
  }

  useEffect(load, [id]);

  async function handleVote(value) {
    if (!user) return;
    const next = myVote === value ? 0 : value;
    setMyVote(next);
    const { data } = await bunkaiApi.vote(id, value);
    setBunkai((b) => ({ ...b, rating: data.data.rating }));
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const { data } = await bunkaiApi.addComment(id, text);
    setComments((c) => [...c, data.data]);
    setText('');
  }

  if (!bunkai) return <div className="page-loader">Загрузка…</div>;

  const videoId = parseVideoId(bunkai.youtubeUrl);

  return (
    <div className="container section">
      <div className="bunkai-page-top">
        <div>
          <TimecodePlayer videoId={videoId} />
        </div>
        <div>
          <Badge tone={bunkai.difficulty}>{bunkai.difficulty}</Badge>
          <h1 className="bunkai-page-title">{bunkai.title}</h1>
          {bunkai.movement && (
            <p style={{ color: 'var(--washi-dim)', fontSize: '0.88rem' }}>
              Движение: {bunkai.movement.name}
            </p>
          )}
          <p style={{ color: 'var(--washi-dim)', marginTop: 12 }}>{bunkai.description}</p>

          {bunkai.tags?.length > 0 && (
            <div className="bunkai-tags">
              {bunkai.tags.map((t) => (
                <span key={t.id} className="tag-chip">#{t.name}</span>
              ))}
            </div>
          )}

          <div className="vote-row">
            <button className={`vote-btn ${myVote === 1 ? 'active' : ''}`} onClick={() => handleVote(1)}>
              <ThumbsUp size={16} />
            </button>
            <span className="rating-total">{bunkai.rating}</span>
            <button className={`vote-btn ${myVote === -1 ? 'active' : ''}`} onClick={() => handleVote(-1)}>
              <ThumbsDown size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="comments-section">
        <h3>Комментарии</h3>
        {comments.map((c) => (
          <div key={c.id} className="washi-panel comment-item">
            <p className="comment-author">{c.user?.username}</p>
            <p className="comment-text">{c.text}</p>
          </div>
        ))}
        {comments.length === 0 && <p style={{ color: 'var(--washi-dim)' }}>Пока нет комментариев.</p>}

        {user ? (
          <form className="comment-form" onSubmit={submitComment}>
            <textarea
              placeholder="Поделитесь своим мнением…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">Отправить</button>
          </form>
        ) : (
          <p style={{ color: 'var(--washi-dim)', marginTop: 14 }}>Войдите, чтобы оставить комментарий.</p>
        )}
      </div>

      {relations.length > 0 && (
        <div>
          <h3>Связанные бункай</h3>
          <div className="relations-grid">
            {relations.map((r) => (
              <BunkaiCard key={r.id} bunkai={r.toBunkai} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
