/**
 * Bunkai Explorer — Клиент HTTP-запросов на базе нативного fetch (без Axios).
 * Поддерживает Bearer-токены, автоматическую ротацию refresh-токенов при 401
 * и совместим по сигнатуре с существующими модулями API.
 */

function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    if (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
      return `${window.location.protocol}//${window.location.hostname}:5000/api`;
    }
  }
  return envUrl || 'http://localhost:5000/api';
}

const API_BASE_URL = getApiBaseUrl();

let accessToken = null;
let onUnauthorized = null;
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

function buildUrl(path, params) {
  const fullUrl = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!params) return fullUrl;

  const url = new URL(fullUrl);
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.append(key, String(val));
    }
  });
  return url.toString();
}

async function request(path, options = {}) {
  const { params, headers = {}, body, _retried = false, ...restOptions } = options;
  const url = buildUrl(path, params);

  const requestHeaders = {
    ...headers,
  };

  if (accessToken && !requestHeaders.Authorization) {
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }

  let requestBody = body;
  if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
    requestHeaders['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  const fetchOptions = {
    ...restOptions,
    headers: requestHeaders,
    body: requestBody,
    credentials: 'include', // отправляет httpOnly refresh-cookie
  };

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (netErr) {
    const error = new Error(netErr.message || 'Ошибка сети');
    error.isNetworkError = true;
    throw error;
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (response.ok) {
    return { data, status: response.status, headers: response.headers };
  }

  // Обработка 401 и ротация токенов
  const errorCode = data?.error?.code;
  const isAuthRoute = path.includes('/auth/');

  if (
    response.status === 401 &&
    !isAuthRoute &&
    !_retried &&
    (errorCode === 'TOKEN_EXPIRED' || errorCode === 'NO_TOKEN')
  ) {
    try {
      if (!refreshPromise) {
        refreshPromise = request('/auth/refresh', { method: 'POST', _retried: true }).finally(() => {
          refreshPromise = null;
        });
      }

      const refreshRes = await refreshPromise;
      const newAccessToken = refreshRes?.data?.data?.accessToken;
      if (newAccessToken) {
        setAccessToken(newAccessToken);
        return request(path, { ...options, _retried: true });
      }
    } catch (refreshErr) {
      setAccessToken(null);
      if (onUnauthorized) onUnauthorized();
      const err = new Error(refreshErr.message || 'Сессия истекла');
      err.response = { status: 401, data: refreshErr?.response?.data || null };
      throw err;
    }
  }

  const err = new Error(data?.error?.message || `Ошибка запроса: ${response.status}`);
  err.status = response.status;
  err.response = { status: response.status, data };
  throw err;
}

const api = {
  get: (url, config = {}) => request(url, { ...config, method: 'GET' }),
  post: (url, body, config = {}) => request(url, { ...config, body, method: 'POST' }),
  put: (url, body, config = {}) => request(url, { ...config, body, method: 'PUT' }),
  patch: (url, body, config = {}) => request(url, { ...config, body, method: 'PATCH' }),
  delete: (url, config = {}) => request(url, { ...config, method: 'DELETE' }),
};

export default api;
