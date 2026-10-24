// Deterministic layout for the illustrated quest map.
// Map coordinates are *illustrative* — they are NOT geographic. Real location
// data (city, locality, venue, lat/lng) is always shown from the event itself.

export const MAP_W = 1200;
export const MAP_H = 800;

// Decorative fantasy regions. `categories` decides which region an event's
// paper is pinned to; unknown categories fall back to Lantern Village.
export const REGIONS = [
  { id: 'woods', name: 'Whispering Woods', theme: 'Workshops & learning', categories: ['Workshops', 'Education'], cx: 235, cy: 215, rx: 205, ry: 150 },
  { id: 'meadow', name: 'Music Meadow', theme: 'Performances & open mics', categories: ['Music'], cx: 930, cy: 205, rx: 215, ry: 150 },
  { id: 'village', name: 'Lantern Village', theme: 'Community meetups', categories: ['Community activities'], cx: 600, cy: 400, rx: 190, ry: 130 },
  { id: 'forge', name: "Maker's Forge", theme: 'Tech & hackathons', categories: ['Technology'], cx: 215, cy: 610, rx: 205, ry: 140 },
  { id: 'arena', name: 'Sunlit Arena', theme: 'Sports & gaming', categories: ['Sports', 'Gaming'], cx: 615, cy: 655, rx: 190, ry: 115 },
  { id: 'garden', name: 'Hidden Garden', theme: 'Culture & social', categories: ['Art and culture'], cx: 975, cy: 600, rx: 195, ry: 140 },
];

const FALLBACK_REGION = REGIONS.find((r) => r.id === 'village');

export function regionForCategory(category) {
  const key = String(category || '').trim().toLowerCase();
  return REGIONS.find((r) => r.categories.some((c) => c.toLowerCase() === key)) || FALLBACK_REGION;
}

// FNV-1a 32-bit hash → stable pseudo-random numbers from an event id.
export function hash32(text) {
  let h = 0x811c9dc5;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// Small deterministic generator seeded from a hash.
export function seeded(seed) {
  let state = seed || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}

export const PAPER_W = 168; // minimum centre-to-centre spacing used for overlap relaxation
export const PAPER_H = 128;
const MARGIN_X = 90;
const MARGIN_Y = 70;

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

// Chebyshev-style clearance: < 1 means two papers would overlap.
function clearance(a, b) {
  return Math.max(Math.abs(a.x - b.x) / PAPER_W, Math.abs(a.y - b.y) / PAPER_H);
}

function minClearance(point, placed) {
  return placed.reduce((min, other) => Math.min(min, clearance(point, other)), Infinity);
}

/**
 * Lay out every event on the map. Depends only on event ids + categories, and is
 * processed in id order, so positions do not change when filters change or when
 * the event list arrives in a different order.
 * Returns { [eventId]: { x, y, rot, regionId } }.
 */
export function layoutEvents(events) {
  const list = [...(events || [])]
    .filter((event) => event && event.id !== undefined && event.id !== null)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const placed = [];
  const result = {};

  list.forEach((event) => {
    const id = String(event.id);
    const region = regionForCategory(event.category);
    const rand = seeded(hash32(id));
    let best = null;
    let bestClearance = -1;

    // Sample candidates inside (and slightly beyond) the region. Accept the first
    // one that clears every placed paper; otherwise keep the roomiest candidate.
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const angle = rand() * Math.PI * 2;
      const spread = Math.min(1.7, 0.7 + attempt * 0.02);
      const radius = Math.sqrt(rand()) * spread;
      const candidate = {
        x: clamp(region.cx + Math.cos(angle) * region.rx * radius, MARGIN_X, MAP_W - MARGIN_X),
        y: clamp(region.cy + Math.sin(angle) * region.ry * radius, MARGIN_Y, MAP_H - MARGIN_Y),
      };
      const room = minClearance(candidate, placed);
      if (room > bestClearance) { best = candidate; bestClearance = room; }
      if (room >= 1) break;
    }

    const rot = (hash32(`${id}:rot`) % 7) - 3; // -3° … +3°
    const point = { x: Math.round(best.x), y: Math.round(best.y), rot, regionId: region.id };
    placed.push(point);
    result[id] = point;
  });

  return result;
}
