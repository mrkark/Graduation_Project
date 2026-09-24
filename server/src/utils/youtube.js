// Утилиты для работы с YouTube-ссылками:
// парсинг videoId из любых форматов ссылок, превью, embed-URL с таймкодом

/**
 * Извлекает videoId из ссылки вида:
 *  - https://www.youtube.com/watch?v=XXXXXXXXXXX
 *  - https://youtu.be/XXXXXXXXXXX
 *  - https://www.youtube.com/embed/XXXXXXXXXXX
 *  - https://www.youtube.com/shorts/XXXXXXXXXXX
 */
function parseVideoId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);

    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace('/', '') || null;
    }

    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') {
        return u.searchParams.get('v');
      }
      const match = u.pathname.match(/\/(embed|shorts)\/([^/?]+)/);
      if (match) return match[2];
    }

    return null;
  } catch (err) {
    // Строка не является валидным URL — считаем, что это уже videoId
    if (/^[a-zA-Z0-9_-]{6,15}$/.test(url)) return url;
    return null;
  }
}

function getThumbnail(videoId) {
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

function getEmbedUrl(videoId, startTime) {
  if (!videoId) return null;
  const start = startTime ? `?start=${Math.floor(startTime)}` : '';
  return `https://www.youtube.com/embed/${videoId}${start}`;
}

module.exports = { parseVideoId, getThumbnail, getEmbedUrl };
