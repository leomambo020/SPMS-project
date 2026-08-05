// API client with automatic access-token refresh (single-flight).
//
// Key behaviors:
//  - Attaches Authorization: Bearer <accessToken> to every request.
//  - On a 401 with error "Access token expired.", triggers a single
//    refresh (concurrent requests queue up and are retried after).
//  - Refresh tokens are single-use + rotating: we always store the
//    newest pair and never fire concurrent refreshes with the same token.
//  - Any other 401 (invalid/revoked) forces a full re-login.

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const TOKEN_KEY = 'spms_access_token';
const REFRESH_KEY = 'spms_refresh_token';
const USER_KEY = 'spms_user';

let accessToken = localStorage.getItem(TOKEN_KEY) || null;
let refreshToken = localStorage.getItem(REFRESH_KEY) || null;

// Decoded user snapshot: { employeeId, role, deptId }
let currentUser = null;
try {
  currentUser = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
} catch {
  currentUser = null;
}

// Single-flight refresh: while a refresh is in flight, all other
// requests that hit a 401-expired wait on this promise instead of
// firing their own refresh (which would rotate/reuse the token).
let refreshPromise = null;

function persistTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

function persistUser(user) {
  currentUser = user;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

function formatApiError(data, status) {
  const baseMessage = data?.error || `Request failed with status ${status}`;
  const details = Array.isArray(data?.details) ? data.details : [];

  if (!details.length) {
    return baseMessage;
  }

  const detailText = details
    .map((detail) => {
      if (!detail || typeof detail !== 'object') return null;
      const field = detail.field ? `${detail.field}: ` : '';
      return `${field}${detail.message || 'Invalid value.'}`;
    })
    .filter(Boolean)
    .join('; ');

  return detailText ? `${baseMessage} ${detailText}` : baseMessage;
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

export function getCurrentUser() {
  return currentUser;
}

export function isAuthenticated() {
  return Boolean(accessToken && currentUser);
}

export function setSession({ accessToken: access, refreshToken: refresh, user }) {
  persistTokens(access, refresh);
  persistUser(user);
}

export function clearSession() {
  accessToken = null;
  refreshToken = null;
  currentUser = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

async function refreshAccessToken() {
  if (!refreshToken) {
    throw new Error('No refresh token available.');
  }

  // Single-flight: reuse the in-flight refresh promise.
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        // Invalid/revoked/rotated token — force re-login.
        clearSession();
        const data = await res.json().catch(() => ({}));
        const err = new Error(data.error || 'Session expired. Please log in again.');
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      persistTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function request(path, { method = 'GET', body, params, auth = true, retry = true } = {}) {
  let url = `${API_BASE}${path}`;
  if (params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        search.set(key, value);
      }
    }
    const qs = search.toString();
    if (qs) url += `?${qs}`;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const networkErr = new Error('Network error. Is the backend running?');
    networkErr.status = 0;
    throw networkErr;
  }

  // Access token expired → refresh once, then retry the original request.
  if (res.status === 401 && retry && auth) {
    const data = await res.json().catch(() => ({}));
    if (data.error === 'Access token expired.') {
      try {
        await refreshAccessToken();
      } catch (refreshErr) {
        throw refreshErr;
      }
      return request(path, { method, body, params, auth, retry: false });
    }
  }

  if (res.status === 204) {
    return null;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(formatApiError(data, res.status));
    err.status = res.status;
    err.details = data.details;
    throw err;
  }

  return data;
}

export const api = {
  get: (path, params) => request(path, { method: 'GET', params }),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),

  // Auth endpoints (no Authorization header needed).
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: { username, password }, auth: false }),
  logout: () =>
    request('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }).catch(() => {}),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
};
