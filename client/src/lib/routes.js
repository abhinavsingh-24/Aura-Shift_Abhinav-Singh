// Single source of truth for every page: navigation, headings, footer, document titles and 404 handling all read this table.

export const GROUPS = {
  explore: { label: 'Explore', blurb: 'Find something to do in your city.' },
  adventure: { label: 'Adventure tools', blurb: 'Plan, shuffle and organise your sidequests.' },
  journal: { label: 'Explorer journal', blurb: 'Your progress, bookings and story.' },
  organize: { label: 'For organizers', blurb: 'Publish and manage real experiences.' },
  trust: { label: 'Trust & community', blurb: 'Keep SIDEQUEST welcoming.' },
};

// `nav`: where the link appears — 'primary' (top bar), 'adventure' (tools menu), 'account' (account menu), 'footer' only, or none.
export const ROUTES = [
  { id: 'home', path: '/', label: 'Quest Map', title: 'Your next adventure', group: 'explore', nav: 'primary', blurb: '' },
  { id: 'quests', path: '/quests', label: 'Quest Board', title: 'Find your next quest', group: 'explore', nav: 'primary', blurb: 'Search, filter and browse every upcoming quest, on the map or as a list.' },
  { id: 'nearby', path: '/nearby', label: 'Nearby', title: 'Explore nearby', group: 'explore', nav: 'primary', blurb: 'Quests close to you. Location is only requested when you ask for it.' },
  { id: 'recommended', path: '/recommended', label: 'For You', title: 'Picked for your interests', group: 'explore', nav: 'primary', blurb: 'Recommendations scored from your interests, place and timing, with the reasons shown.' },
  { id: 'saved', path: '/saved', label: 'Saved Quests', title: 'Your saved quests', group: 'explore', nav: 'account', blurb: 'Quests you bookmarked. They feed your calendar, reminders and quest chains.' },

  { id: 'radar', path: '/radar', label: 'Quest Radar', title: 'Find a quest that fits your plans', group: 'adventure', nav: 'adventure', blurb: 'Narrow by time, category and distance to catch what is happening around you.' },
  { id: 'mystery', path: '/mystery', label: 'Mystery Quest', title: 'Let fate choose your next quest', group: 'adventure', nav: 'adventure', blurb: 'Set a few boundaries and reveal a surprise pick from real upcoming events.' },
  { id: 'chains', path: '/chains', label: 'Quest Chains', title: 'Build a mini-adventure', group: 'adventure', nav: 'adventure', blurb: 'Line up several quests into one outing.' },
  { id: 'calendar', path: '/calendar', label: 'Quest Calendar', title: 'Your quest calendar', group: 'adventure', nav: 'adventure', blurb: 'Saved quests and planned stops by date, with .ics export.' },
  { id: 'reminders', path: '/reminders', label: 'Reminders', title: 'Never miss a saved quest', group: 'adventure', nav: 'adventure', blurb: 'Optional browser reminders before your saved quests begin.' },
  { id: 'assistant', path: '/assistant', label: 'Quest Guide', title: 'Ask the quest guide', group: 'adventure', nav: 'adventure', blurb: 'Describe an outing and get matches from the current event list.' },
  { id: 'chat', path: '/chat', label: 'Party Chat', title: 'Coordinate with your party', group: 'adventure', nav: 'adventure', blurb: 'Plan with a party for a quest. Messages are stored on this device only.' },

  { id: 'profile', path: '/profile', label: 'Explorer Profile', title: 'Your explorer profile', group: 'journal', nav: 'account', blurb: 'Your field notes and explorer card.' },
  { id: 'achievements', path: '/achievements', label: 'Achievements', title: 'Your adventure milestones', group: 'journal', nav: 'account', blurb: 'Badges earned from what you actually do in SIDEQUEST.' },
  { id: 'levels', path: '/levels', label: 'Explorer XP', title: 'Your explorer journey', group: 'journal', nav: 'account', blurb: 'XP and ranks calculated from your activity.' },
  { id: 'bookings', path: '/bookings', label: 'My Bookings', title: 'Your bookings & tickets', group: 'journal', nav: 'account', blurb: 'Quests you have joined.', auth: true },

  { id: 'publish', path: '/publish', label: 'Publish a Quest', title: 'Create a new quest', group: 'organize', nav: 'primary-action', blurb: 'Share a real experience with your city. Organizer accounts publish; everyone can see how.' },
  { id: 'organizer', path: '/organizer', label: 'Organizer Hub', title: 'Organizer dashboard', group: 'organize', nav: 'account', blurb: 'Your published quests and their registrations.', role: 'organizer' },

  { id: 'safety', path: '/safety', label: 'Safety & Reports', title: 'Trust, safety & reports', group: 'trust', nav: 'footer', blurb: 'Report listings that look unsafe or misleading.' },
  { id: 'insights', path: '/insights', label: 'Community Notes', title: 'Community field notes', group: 'trust', nav: 'footer', blurb: 'Aggregate activity across SIDEQUEST. No personal data.' },
];

const DETAIL = { id: 'quest-detail', label: 'Quest', title: 'Quest details', group: 'explore', nav: '', blurb: 'Everything you need to decide and join.' };
const NOT_FOUND = { id: 'not-found', path: '', label: 'Not found', title: 'This part of the map is uncharted', group: 'explore', nav: '', blurb: '' };

export function normalizePath(pathname) {
  const clean = String(pathname || '/').split(/[?#]/)[0].replace(/\/{2,}/g, '/');
  return clean.length > 1 ? clean.replace(/\/+$/, '') : '/';
}

/** Resolve a URL path to a route. Unknown paths resolve to the 'not-found' route instead of silently showing the home page. */
export function resolveRoute(pathname) {
  const path = normalizePath(pathname);
  const detail = path.match(/^\/quests\/([^/]+)$/);
  if (detail) { let id = detail[1]; try { id = decodeURIComponent(id); } catch { /* keep raw id */ } return { route: DETAIL, params: { id } }; }
  const found = ROUTES.find((route) => route.path === path);
  return found ? { route: found, params: {} } : { route: NOT_FOUND, params: {} };
}

export const routeById = (id) => ROUTES.find((route) => route.id === id) || (id === DETAIL.id ? DETAIL : id === NOT_FOUND.id ? NOT_FOUND : null);
export const siblingsOf = (group) => ROUTES.filter((route) => route.group === group && route.nav !== 'footer');

/** Routes that belong in a given navigation slot for this user. Role-restricted routes are only listed for matching users. */
export function navFor(slot, user) {
  return ROUTES.filter((route) => route.nav === slot && (!route.role || (user && user.role === route.role)) && (!route.auth || user));
}

export function documentTitle(route, params = {}) {
  if (route.id === 'home') return 'SIDEQUEST — Your City. Your Next Quest.';
  if (route.id === 'quest-detail') return `Quest details · SIDEQUEST`;
  return `${route.id === 'not-found' ? 'Page not found' : route.label} · SIDEQUEST`;
}

/** True only for same-origin, in-app links that the client router may handle without a full page load. */
export function isClientNavigable(href, origin = 'http://localhost') {
  if (!href || /^(mailto:|tel:|javascript:)/i.test(href)) return false;
  let url;
  try { url = new URL(href, origin); } catch { return false; }
  if (url.origin !== new URL(origin).origin) return false;
  if (/^\/(api|brand)\//.test(url.pathname) || /\.[a-z0-9]{2,5}$/i.test(url.pathname)) return false;
  return true;
}

/** Safe post-login redirect: only same-site absolute paths. */
export function safeNextPath(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/';
}
