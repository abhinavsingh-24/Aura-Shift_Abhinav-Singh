const API_BASE = '/api';

const BACKEND_HINT = 'Start it from the project root with "npm run dev" (the API listens on port 3001) and try again.';

export class ApiError extends Error {
  constructor(message, { status = 0, code = '', details = [] } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch {
    // fetch only rejects when the request never completed (offline, server down, blocked).
    throw new ApiError(`Cannot reach the SIDEQUEST server. ${BACKEND_HINT}`, { code: 'NETWORK' });
  }

  const raw = await response.text().catch(() => '');
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }

  if (!response.ok) {
    const details = Array.isArray(data.errors) ? data.errors : [];
    if (data.message) {
      throw new ApiError(`${data.message}${details.length ? ` ${details.join(' ')}` : ''}`, { status: response.status, code: data.code || '', details });
    }
    // No JSON message at all: this is almost always the dev proxy answering for a backend that is not running.
    const proxyFailure = [500, 502, 503, 504].includes(response.status) && !raw.trim().startsWith('{');
    throw new ApiError(
      proxyFailure
        ? `The SIDEQUEST server is not responding (HTTP ${response.status}). ${BACKEND_HINT}`
        : `The request failed (HTTP ${response.status}). Please try again.`,
      { status: response.status, code: proxyFailure ? 'BACKEND_DOWN' : '' },
    );
  }

  return data;
}

export function getEvents(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, value);
    }
  });

  const queryString = query.toString();
  return request(`/events${queryString ? `?${queryString}` : ''}`);
}

export function getEventById(id) {
  return request(`/events/${encodeURIComponent(id)}`);
}

export function createEvent(payload) {
  return request('/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getRecommendations(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      query.append(key, value.join(','));
      return;
    }
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, value);
    }
  });

  const queryString = query.toString();
  return request(`/recommendations${queryString ? `?${queryString}` : ''}`);
}

export function registerForEvent(eventId) {
  return request(`/events/${encodeURIComponent(eventId)}/register`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function getInsights() {
  return request('/insights');
}

export function registerAccount(payload) {
  return request('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
}

export function loginAccount(payload) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}

export function getCurrentUser() {
  return request('/auth/me');
}

export function logoutAccount() {
  return request('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
}

export function getHealth() {
  return request('/health');
}

export function getMyRegistrations() {
  return request('/my-registrations');
}

export function submitReport(payload) {
  return request('/reports', { method: 'POST', body: JSON.stringify(payload) });
}

export function getMyReports() {
  return request('/my-reports');
}
