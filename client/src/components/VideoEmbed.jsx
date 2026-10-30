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

    const embedSrc = `https://www.youtube.com/embed/${id}?rel=0${start ? `&start=${start}&autoplay=1` : ''}`;
    return { id, start, embedSrc };
  } catch {
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return { id: url, start: 0, embedSrc: `https://www.youtube.com/embed/${url}?rel=0` };
    }
    return null;
  }
}

export default function VideoEmbed({ url }) {
  if (!url) return null;
  const info = getYouTubeEmbedInfo(url);

  if (info) {
    return (
      <iframe
        className="video-embed"
        src={info.embedSrc}
        title="Видео техники"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video className="video-embed" src={url} controls preload="metadata" />
  );
}
