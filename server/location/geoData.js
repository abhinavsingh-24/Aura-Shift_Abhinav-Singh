// Authoritative list of India's 28 states and 8 Union Territories.
// `code` is the ISO 3166-2:IN subdivision code. `altNames` are alternate
// spellings, also used to match source datasets (India Post uses upper case).
const COUNTRY = { id: 'IN', name: 'India', code: 'IN', altNames: ['Bharat', 'Republic of India'] };

const STATES = [
  ['Andhra Pradesh', 'IN-AP', 'state'], ['Arunachal Pradesh', 'IN-AR', 'state'], ['Assam', 'IN-AS', 'state'],
  ['Bihar', 'IN-BR', 'state'], ['Chhattisgarh', 'IN-CT', 'state'], ['Goa', 'IN-GA', 'state'],
  ['Gujarat', 'IN-GJ', 'state'], ['Haryana', 'IN-HR', 'state'], ['Himachal Pradesh', 'IN-HP', 'state'],
  ['Jharkhand', 'IN-JH', 'state'], ['Karnataka', 'IN-KA', 'state'], ['Kerala', 'IN-KL', 'state'],
  ['Madhya Pradesh', 'IN-MP', 'state'], ['Maharashtra', 'IN-MH', 'state'], ['Manipur', 'IN-MN', 'state'],
  ['Meghalaya', 'IN-ML', 'state'], ['Mizoram', 'IN-MZ', 'state'], ['Nagaland', 'IN-NL', 'state'],
  ['Odisha', 'IN-OR', 'state', ['Orissa']], ['Punjab', 'IN-PB', 'state'], ['Rajasthan', 'IN-RJ', 'state'],
  ['Sikkim', 'IN-SK', 'state'], ['Tamil Nadu', 'IN-TN', 'state'], ['Telangana', 'IN-TG', 'state'],
  ['Tripura', 'IN-TR', 'state'], ['Uttar Pradesh', 'IN-UP', 'state'], ['Uttarakhand', 'IN-UT', 'state', ['Uttaranchal']],
  ['West Bengal', 'IN-WB', 'state'],
  ['Andaman and Nicobar Islands', 'IN-AN', 'union_territory', ['Andaman & Nicobar Islands']],
  ['Chandigarh', 'IN-CH', 'union_territory'],
  ['Dadra and Nagar Haveli and Daman and Diu', 'IN-DH', 'union_territory'],
  ['Delhi', 'IN-DL', 'union_territory', ['NCT of Delhi', 'National Capital Territory of Delhi']],
  ['Jammu and Kashmir', 'IN-JK', 'union_territory', ['Jammu & Kashmir']],
  ['Ladakh', 'IN-LA', 'union_territory'],
  ['Lakshadweep', 'IN-LD', 'union_territory'],
  ['Puducherry', 'IN-PY', 'union_territory', ['Pondicherry']],
].map(([name, code, kind, alt = []]) => ({ id: code, name, code, kind, altNames: alt }));

const normalizeKey = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const stateByKey = new Map();
STATES.forEach((state) => {
  [state.name, ...state.altNames].forEach((n) => stateByKey.set(normalizeKey(n), state));
});

function resolveState(name) {
  const key = normalizeKey(name);
  return stateByKey.get(key) || stateByKey.get(key.replace(/^the /, '')) || null;
}

module.exports = { COUNTRY, STATES, resolveState, normalizeKey };
