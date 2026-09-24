import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { kataApi } from '../api/endpoints';
import TimecodePlayer from '../components/youtube/TimecodePlayer';
import KataTreeGraph from '../components/three/KataTreeGraph';
import { parseVideoId } from '../utils/youtube';

export default function KataPage() {
  const { id } = useParams();
  const [kata, setKata] = useState(null);
  const [activeMovementId, setActiveMovementId] = useState(null);
  const [expanded, setExpanded] = useState({});
  const playerRef = useRef(null);

  useEffect(() => {
    kataApi.getOne(id).then((r) => setKata(r.data.data));
  }, [id]);

  if (!kata) return <div className="page-loader">Загрузка ката…</div>;

  const videoId = parseVideoId(kata.youtubeUrl);

  function handleSelectMovement(movementId, startTime) {
    setActiveMovementId(movementId);
    if (startTime != null) playerRef.current?.seekTo(startTime);
  }

  function toggleSeq(seqId) {
    setExpanded((e) => ({ ...e, [seqId]: !e[seqId] }));
  }

  return (
    <div className="container section">
      <div className="kata-page-head">
        <p className="kata-page-jp">{kata.nameJp}</p>
        <h1 className="kata-page-title">{kata.name}</h1>
        <p className="kata-page-meta">{kata.style} · {kata.kyuLevel}</p>
        {kata.description && <p style={{ maxWidth: 720, color: 'var(--washi-dim)', marginTop: 12 }}>{kata.description}</p>}
      </div>

      <div className="kata-layout">
        <div>
          <TimecodePlayer ref={playerRef} videoId={videoId} />
          <div className="tree-list" style={{ marginTop: 24 }}>
            {(kata.sequences || []).map((seq) => (
              <div key={seq.id} className="washi-panel tree-sequence">
                <button
                  className="tree-sequence-name"
                  onClick={() => toggleSeq(seq.id)}
                  style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', color: 'var(--gold-soft)' }}
                >
                  {expanded[seq.id] === false ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  {seq.name}
                </button>
                {expanded[seq.id] !== false && (
                  <div>
                    {(seq.movements || []).map((mv) => (
                      <div key={mv.id}>
                        <div
                          className={`tree-movement ${activeMovementId === mv.id ? 'is-active' : ''}`}
                          onClick={() => handleSelectMovement(mv.id, mv.startTime)}
                        >
                          <div>
                            <div className="tree-movement-name">{mv.name}</div>
                            <div className="tree-movement-jp">{mv.nameJp} · {mv.stance}</div>
                          </div>
                          <span className="tree-movement-bunkai-count">{(mv.bunkaiList || []).length} бункай</span>
                        </div>
                        {activeMovementId === mv.id && (mv.bunkaiList || []).length > 0 && (
                          <div className="movement-bunkai-list">
                            {mv.bunkaiList.map((b) => (
                              <Link key={b.id} to={`/bunkai/${b.id}`} className="movement-bunkai-item">
                                → {b.title}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: 14 }}>Дерево ката в 3D</h3>
          <KataTreeGraph kata={kata} activeMovementId={activeMovementId} onSelectMovement={(mvId) => {
            const mv = (kata.sequences || []).flatMap((s) => s.movements || []).find((m) => m.id === mvId);
            handleSelectMovement(mvId, mv?.startTime);
          }} />
          {kata.history && (
            <div className="washi-panel" style={{ padding: 18, marginTop: 20 }}>
              <h4 style={{ marginBottom: 8, color: 'var(--gold-soft)' }}>История</h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--washi-dim)' }}>{kata.history}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
