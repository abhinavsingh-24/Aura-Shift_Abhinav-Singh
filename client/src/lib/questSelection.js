// Pure selection/camera helpers shared by the map and the list, so both views derive from the same rules.
import { MAP_W, MAP_H, regionForCategory } from './mapLayout.js';

/** Region filter: ONE implementation used by the map, the list, the counts and the toolbar. */
export function filterByRegion(events, regionId) {
  if (!regionId || regionId === 'all') return events;
  return events.filter((event) => regionForCategory(event.category).id === regionId);
}

export function regionCounts(events) {
  return events.reduce((acc, event) => {
    const id = regionForCategory(event.category).id;
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});
}

/** Keep the selection only while that event is still eligible. Returns the id to keep (or null). */
export function reconcileSelection(selectedId, visibleEvents) {
  if (selectedId === null || selectedId === undefined) return null;
  return visibleEvents.some((event) => String(event.id) === String(selectedId)) ? selectedId : null;
}

/** Move the selection by +1 / -1 through an ordered list, wrapping around. Starts at the first/last when nothing is selected. */
export function stepSelection(ordered, selectedId, delta) {
  if (!ordered.length) return null;
  const index = ordered.findIndex((event) => String(event.id) === String(selectedId));
  if (index === -1) return ordered[delta > 0 ? 0 : ordered.length - 1];
  return ordered[(index + delta + ordered.length) % ordered.length];
}

/**
 * Camera that reveals a marker WITHOUT changing zoom. If the marker is already comfortably on screen the exact
 * same camera object is returned, so selecting an event never moves or zooms the map.
 * cam = { x, y, k }; viewport = { vw, vh }; point = map units.
 */
export function revealPoint(cam, viewport, point, { padX = 110, padY = 90 } = {}) {
  const { vw, vh } = viewport;
  const cw = vw * cam.k;
  const ch = (vw * MAP_H / MAP_W) * cam.k;
  const sx = cam.x + (point.x / MAP_W) * cw;
  const sy = cam.y + (point.y / MAP_H) * ch;
  if (sx >= padX && sx <= vw - padX && sy >= padY && sy <= vh - padY) return cam;
  const dx = sx < padX ? padX - sx : sx > vw - padX ? vw - padX - sx : 0;
  const dy = sy < padY ? padY - sy : sy > vh - padY ? vh - padY - sy : 0;
  return { ...cam, x: cam.x + dx, y: cam.y + dy };
}
