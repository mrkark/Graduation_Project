function getYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
  } catch {
    return null;
  }
  return null;
}

export default function VideoEmbed({ url }) {
  if (!url) return null;
  const ytId = getYouTubeId(url);

  if (ytId) {
    return (
      <iframe
        className="video-embed"
        src={`https://www.youtube.com/embed/${ytId}`}
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
