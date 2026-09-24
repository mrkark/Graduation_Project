// Клиентская копия утилиты парсинга videoId (та же логика, что и на сервере)
export function parseVideoId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.replace('/', '') || null;
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const match = u.pathname.match(/\/(embed|shorts)\/([^/?]+)/);
      if (match) return match[2];
    }
    return null;
  } catch {
    if (/^[a-zA-Z0-9_-]{6,15}$/.test(url)) return url;
    return null;
  }
}
