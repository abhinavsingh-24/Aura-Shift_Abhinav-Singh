const BASE = '/api/locations';

async function call(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch {
    throw new Error('Cannot reach the SIDEQUEST server.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Request failed (HTTP ${response.status}).`);
    error.status = response.status;
    error.details = data.errors || [];
    throw error;
  }
  return data;
}

function qs(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.append(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

export const locationApi = {
  countries: () => call('/countries'),
  states: (params) => call(`/states${qs({ limit: 50, ...params })}`),
  districts: (stateId, params) => call(`/states/${encodeURIComponent(stateId)}/districts${qs({ limit: 50, ...params })}`),
  cities: (districtId, params) => call(`/districts/${encodeURIComponent(districtId)}/cities${qs({ limit: 50, ...params })}`),
  districtLocalities: (districtId, params) => call(`/districts/${encodeURIComponent(districtId)}/localities${qs({ limit: 50, ...params })}`),
  localities: (cityId, params) => call(`/cities/${encodeURIComponent(cityId)}/localities${qs({ limit: 50, ...params })}`),
  search: (params) => call(`/search${qs(params)}`),
  pincode: (pin) => call(`/postal-codes/${encodeURIComponent(pin)}`),
  validate: (selection) => call('/validate', { method: 'POST', body: JSON.stringify(selection) }),
  detect: (latitude, longitude) => call('/detect', { method: 'POST', body: JSON.stringify({ latitude, longitude }) }),
  getPreferences: () => call('/preferences'),
  savePreferences: (selection) => call('/preferences', { method: 'PUT', body: JSON.stringify({ homeLocation: selection }) }),
  admin: {
    summary: () => call('/admin/summary'),
    records: (params) => call(`/admin/records${qs(params)}`),
    update: (id, patch) => call(`/admin/records/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    imports: () => call('/admin/imports'),
    importDetail: (id) => call(`/admin/imports/${encodeURIComponent(id)}`),
    duplicates: () => call('/admin/duplicates'),
    audit: () => call('/admin/audit'),
    runImport: (body) => call('/import', { method: 'POST', body: JSON.stringify(body || {}) }),
  },
};
