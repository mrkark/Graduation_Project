/**
 * Преобразует относительный URL медиафайла в полный или проксируемый путь
 */
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

export function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  // Если начинается с /uploads
  if (url.startsWith('/uploads')) {
    return `${SERVER_URL}${url}`;
  }
  if (url.startsWith('/')) {
    return url;
  }
  return `${SERVER_URL}/${url}`;
}

export default resolveMediaUrl;
