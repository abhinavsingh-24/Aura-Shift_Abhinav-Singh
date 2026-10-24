const API_BASE = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const validationDetails = Array.isArray(data.errors) && data.errors.length
      ? ` ${data.errors.join(' ')}`
      : '';
    const message = `${data.message || 'Something went wrong.'}${validationDetails}`;
    throw new Error(message);
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

export function registerForEvent(eventId, participantName, participantId) {
  return request(`/events/${encodeURIComponent(eventId)}/register`, {
    method: 'POST',
    body: JSON.stringify({ participantName, participantId }),
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
