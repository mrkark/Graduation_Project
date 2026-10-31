import { useState } from 'react';
import './VideoEmbed.css';

export function getYouTubeEmbedInfo(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname.includes('youtu.be')) {
      id = u.pathname.replace(/^\/+/, '');
    } else if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') {
        id = u.searchParams.get('v');
      } else {
        const match = u.pathname.match(/\/(embed|v|shorts)\/([^/?]+)/);
        if (match) id = match[2];
      }
    }
    if (!id && /^[a-zA-Z0-9_-]{11}$/.test(url)) {
      id = url;
    }
    if (!id) return null;

    let start = 0;
    const t = u.searchParams.get('t') || u.searchParams.get('start');
    if (t) {
      if (/^\d+s?$/.test(t)) {
        start = parseInt(t.replace('s', ''), 10);
      } else {
        const h = (t.match(/(\d+)h/i) || [])[1] || 0;
        const m = (t.match(/(\d+)m/i) || [])[1] || 0;
        const s = (t.match(/(\d+)s/i) || [])[1] || 0;
        start = parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10);
      }
    }

    // Стандартный embed через youtube-nocookie.com (максимальная совместимость)
    const embedSrc = `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&enablejsapi=1${start ? `&start=${start}&autoplay=1` : '&autoplay=1'}`;
    const mirrorSrc = `https://www.youtube.com/embed/${id}?rel=0${start ? `&start=${start}&autoplay=1` : '&autoplay=1'}`;
    const thumbnailUrl = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

    return { id, start, embedSrc, mirrorSrc, thumbnailUrl };
  } catch {
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return {
        id: url,
        start: 0,
        embedSrc: `https://www.youtube-nocookie.com/embed/${url}?rel=0&autoplay=1`,
        mirrorSrc: `https://www.youtube.com/embed/${url}?rel=0&autoplay=1`,
        thumbnailUrl: `https://i.ytimg.com/vi/${url}/hqdefault.jpg`,
      };
    }
    return null;
  }
}

export default function VideoEmbed({ url, autoLoad = false, masterName = 'Мастера JKS · Масао Кагава (9 Дан)', title }) {
  const [isPlaying, setIsPlaying] = useState(autoLoad);
  const [useMirror, setUseMirror] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!url) return null;
  const info = getYouTubeEmbedInfo(url);

  function copyUrl() {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (info) {
    const activeSrc = useMirror ? info.mirrorSrc : info.embedSrc;

    return (
      <div className="video-embed-wrapper">
        <div className="video-embed-container">
          {!isPlaying ? (
            <div
              className="video-embed-facade"
              style={{ backgroundImage: `url(${info.thumbnailUrl})` }}
              onClick={() => setIsPlaying(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsPlaying(true)}
              aria-label="Воспроизвести видео мастера JKS"
            >
              <div className="video-embed-facade__scrim" />

              <div className="video-embed-facade__header">
                <div className="video-embed-facade__badge">
                  <span>🇯🇵 JKS JAPAN KARATE</span>
                </div>
                {info.start > 0 && (
                  <span style={{ fontSize: '0.8rem', color: '#fef08a', background: 'rgba(0,0,0,0.7)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                    Таймкод: {Math.floor(info.start / 60)}:{String(info.start % 60).padStart(2, '0')}
                  </span>
                )}
              </div>

              <div className="video-embed-facade__center">
                <div className="video-embed-play-btn">
                  <svg viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <div className="video-embed-play-text">
                  ▶ Смотреть видео {title ? `«${title}»` : 'техники'}
                </div>
              </div>

              <div className="video-embed-facade__footer">
                <span>{masterName}</span>
                <span style={{ color: 'var(--gold, #d4a24c)' }}>Нажмите для воспроизведения</span>
              </div>
            </div>
          ) : (
            <iframe
              className="video-embed-iframe"
              src={activeSrc}
              title={title || 'Видео техники Сётокан'}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          )}
        </div>

        {/* Панель обхода ограничений и прямой доступ */}
        <div className="video-embed-toolbar">
          <div className="video-embed-toolbar__left">
            <span>🎥 <strong>{masterName}</strong></span>
          </div>

          <div className="video-embed-toolbar__actions">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="video-embed-btn video-embed-btn--youtube"
              title="Открыть видео напрямую на YouTube в новой вкладке"
            >
              ▶ Открыть на YouTube ↗
            </a>

            <button
              type="button"
              className="video-embed-btn video-embed-btn--mirror"
              onClick={() => {
                setUseMirror(!useMirror);
                setIsPlaying(true);
              }}
              title="Переключить домен плеера при блокировках"
            >
              {useMirror ? 'Обычный плеер' : '🪞 Альтернативное зеркало'}
            </button>

            <button
              type="button"
              className="video-embed-btn video-embed-btn--copy"
              onClick={copyUrl}
              title="Скопировать ссылку на видео"
            >
              {copied ? '✔ Скопировано' : '📋 Ссылка'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="video-embed-wrapper">
      <div className="video-embed-container">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video className="video-embed" src={url} controls preload="metadata" />
      </div>
    </div>
  );
}
