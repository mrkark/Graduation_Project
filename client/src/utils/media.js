/**
 * Преобразует относительный URL медиафайла в полный или проксируемый путь.
 * Динамически учитывает хост текущего клиента для корректной работы со смартфонов в локальной сети.
 */
export function getBackendBaseUrl() {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:5000`;
  }
  return 'http://localhost:5000';
}

export function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const baseUrl = getBackendBaseUrl();
  const clean = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${clean}`;
}

export default resolveMediaUrl;
