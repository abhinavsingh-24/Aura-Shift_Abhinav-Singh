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
      credentials: 'include',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch {
    throw new ApiError(`Cannot reach the SIDEQUEST server. ${BACKEND_HINT}`, { code: 'NETWORK' });
  }

  const raw = await response.text().catch(() => '');
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }

  if (!response.ok) {
    const details = Array.isArray(data.errors) ? data.errors : [];
    if (response.status === 429) {
      const retryAfter = response.headers?.get ? response.headers.get('Retry-After') : null;
      const retryHint = retryAfter ? ` Please wait ${retryAfter} second${retryAfter === '1' ? '' : 's'} before trying again.` : '';
      throw new ApiError(`${data.message || 'Too many requests.'}${retryHint}`, { status: 429, code: 'RATE_LIMITED', details });
    }
    if (data.message) {
      throw new ApiError(`${data.message}${details.length ? ` ${details.join(' ')}` : ''}`, { status: response.status, code: data.code || '', details });
    }
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

export function updateEvent(id, payload) {
  return request(`/events/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function updateEventStatus(id, status) {
  return request(`/events/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
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

// Payment & Booking functions
export function createPaymentOrder(payload) {
  return request('/payments/create-order', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function verifyPayment(payload) {
  return request('/payments/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function sandboxPay(payload) {
  return request('/payments/sandbox-pay', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getMyBookings() {
  return request('/my-bookings');
}

export function cancelBooking(bookingId, reason = 'User cancelled') {
  return request(`/bookings/${encodeURIComponent(bookingId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// Organizer Portal functions
export function getOrganizerEvents() {
  return request('/organizer/events');
}

export function getOrganizerAttendees(eventId) {
  return request(`/organizer/events/${encodeURIComponent(eventId)}/attendees`);
}

export function checkInTicket(payload) {
  return request('/organizer/check-in', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getOrganizerStats() {
  return request('/organizer/stats');
}

// Admin Portal functions
export function getAdminOverview() {
  return request('/admin/overview');
}

export function getAdminEvents() {
  return request('/admin/events');
}

export function moderateAdminEvent(eventId, action) {
  return request(`/admin/events/${encodeURIComponent(eventId)}/moderate`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });
}

export function importAdminEvents(events) {
  return request('/admin/import', {
    method: 'POST',
    body: JSON.stringify({ events }),
  });
}

export function getAdminReports() {
  return request('/admin/reports');
}

export function updateAdminReport(reportId, status) {
  return request(`/admin/reports/${encodeURIComponent(reportId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function getAdminAuditLogs() {
  return request('/admin/audit-logs');
}

// Legacy registration & insights
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
