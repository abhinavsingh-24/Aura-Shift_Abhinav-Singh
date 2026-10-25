import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapTerrain from './MapTerrain';
import QuestPaper from './QuestPaper';
import SelectedQuestPreview from './SelectedQuestPreview';
import { MAP_W, MAP_H, REGIONS, layoutEvents } from '../../lib/mapLayout';
import './map.css';

const MAX_K = 3.5;
const ASPECT = MAP_H / MAP_W;
const clampNum = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Illustrated, pannable, zoomable quest map.
 * `events` are the quests currently visible (already filtered); `allEvents` is used only so papers keep
 * stable positions when filters change. Camera = translate + scale on one canvas that holds terrain AND papers,
 * so markers can never drift out of alignment with the terrain.
 */
export default function WorldMap({ events, allEvents, loading, selectedId, onSelect, savedIds, onToggleSave, onClearFilters, hasActiveFilters }) {
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const camRef = useRef({ x: 0, y: 0, k: 1 });
  const [cam, setCam] = useState({ x: 0, y: 0, k: 1 });
  const [animate, setAnimate] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [ready, setReady] = useState(false);
  const [activeRegion, setActiveRegion] = useState('all');

  const layout = useMemo(() => {
    const byId = new Map();
    [...(allEvents || []), ...events].forEach((e) => byId.set(String(e.id), e));
    return layoutEvents([...byId.values()]);
  }, [allEvents, events]);

  const regionEvents = useMemo(() => activeRegion === 'all' ? events : events.filter((event) => layout[String(event.id)]?.regionId === activeRegion), [events, layout, activeRegion]);

  const counts = useMemo(() => regionEvents.reduce((acc, e) => {
    const r = layout[String(e.id)]?.regionId;
    if (r) acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {}), [regionEvents, layout]);

  const selected = useMemo(() => events.find((e) => String(e.id) === String(selectedId)) || null, [events, selectedId]);

  const [minScale, setMinScale] = useState(1);

  const size = useCallback(() => {
    const el = viewportRef.current;
    const b = el ? el.getBoundingClientRect() : { width: 1200, height: 800 };
    return { vw: b.width || 1200, vh: b.height || 800 };
  }, []);
  const minK = useCallback(() => { const { vw, vh } = size(); return Math.max(1, vh / (vw * ASPECT)); }, [size]);

  const clampCam = useCallback((next) => {
    const { vw, vh } = size();
    const k = clampNum(next.k, minK(), MAX_K);
    const cw = vw * k; const ch = vw * ASPECT * k;
    return { k, x: cw <= vw ? (vw - cw) / 2 : clampNum(next.x, vw - cw, 0), y: ch <= vh ? (vh - ch) / 2 : clampNum(next.y, vh - ch, 0) };
  }, [minK, size]);

  const apply = useCallback((next, animated) => {
    const c = clampCam(next);
    camRef.current = c; setAnimate(Boolean(animated)); setCam(c);
  }, [clampCam]);

  const initialCam = useCallback(() => {
    const { vw, vh } = size();
    const k = vw < 700 ? 2.4 : Math.max(1, minK());
    const cw = vw * k; const ch = vw * ASPECT * k;
    return { k, x: (vw - cw) / 2, y: (vh - ch) / 2 };
  }, [minK, size]);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      apply(initialCam(), false);
      const { vw, vh } = size();
      setMinScale(Math.max(1, vh / (vw * ASPECT)));
      setReady(true);
    });
    return () => cancelAnimationFrame(frameId);
  }, [apply, initialCam, size]);

  // Keep the camera valid when the viewport resizes (rotation, window resize).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const { vw, vh } = size();
      setMinScale(Math.max(1, vh / (vw * ASPECT)));
      apply(camRef.current, false);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [apply, size]);

  const zoomAt = useCallback((factor, mx, my, animated = true) => {
    const { vw, vh } = size();
    const c = camRef.current;
    const k = clampNum(c.k * factor, minK(), MAX_K);
    const px = mx ?? vw / 2; const py = my ?? vh / 2;
    apply({ k, x: px - (px - c.x) * (k / c.k), y: py - (py - c.y) * (k / c.k) }, animated);
  }, [apply, minK, size]);

  const centerOn = useCallback((id, zoomTo) => {
    const p = layout[String(id)];
    if (!p) return;
    const { vw, vh } = size();
    const k = Math.max(camRef.current.k, zoomTo || 1);
    const cw = vw * k; const ch = vw * ASPECT * k;
    apply({ k, x: vw / 2 - (p.x / MAP_W) * cw, y: vh / 2 - (p.y / MAP_H) * ch }, true);
  }, [layout, apply, size]);

  // Ctrl/⌘ + wheel zooms toward the cursor (plain wheel keeps scrolling the page).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const b = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX - b.left, e.clientY - b.top, false);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // Selecting from anywhere (paper click, keyboard, deep link) gently moves the camera to it.
  const lastCentered = useRef(null);
  useEffect(() => {
    if (selectedId && lastCentered.current !== selectedId && selected) centerOn(selectedId, 1.5);
    lastCentered.current = selectedId || null;
  }, [selectedId, selected, centerOn]);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    dragRef.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: camRef.current.x, cy: camRef.current.y, active: false };
    movedRef.current = false;
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx; const dy = e.clientY - d.sy;
    if (!d.active) {
      if (Math.hypot(dx, dy) < 5) return;
      d.active = true; movedRef.current = true; setDragging(true);
      try { viewportRef.current.setPointerCapture(e.pointerId); } catch { /* pointer may already be released */ }
    }
    apply({ ...camRef.current, x: d.cx + dx, y: d.cy + dy }, false);
  };
  const endDrag = (e) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null; setDragging(false);
    window.setTimeout(() => { movedRef.current = false; }, 0);
  };

  const onKeyDown = (e) => {
    if (e.target !== viewportRef.current) return;
    const step = 70;
    const c = camRef.current;
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) { e.preventDefault(); apply({ ...c, x: c.x + moves[e.key][0], y: c.y + moves[e.key][1] }, true); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(1.3); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAt(1 / 1.3); }
    else if (e.key === '0') { e.preventDefault(); apply(initialCam(), true); }
  };

  // Focus by keyboard moves the camera to the paper, so a focused paper is never off-screen.
  const onFocusPaper = useCallback((event) => {
    const el = viewportRef.current;
    if (el) { el.scrollLeft = 0; el.scrollTop = 0; }
    const p = layout[String(event.id)];
    if (!p || !el) return;
    const { vw, vh } = size();
    const c = camRef.current;
    const sx = c.x + (p.x / MAP_W) * vw * c.k; const sy = c.y + (p.y / MAP_H) * vw * ASPECT * c.k;
    if (sx < 60 || sx > vw - 60 || sy < 50 || sy > vh - 50) centerOn(event.id, c.k);
  }, [layout, centerOn, size]);

  const handleSelect = useCallback((event) => { if (!movedRef.current) onSelect(event); }, [onSelect]);

  const saved = useMemo(() => new Set((savedIds || []).map(String)), [savedIds]);
  const zoomPct = Math.round(cam.k * 100);

  return (
    <div className="world-map-layout" onKeyDown={(e) => { if (e.key === 'Escape' && selectedId) { e.stopPropagation(); onSelect(null); } }}>
      <div className="world-map">
        <div className="map-region-filter" role="group" aria-label="Explore map regions">
          <button type="button" className={activeRegion === 'all' ? 'active' : ''} aria-pressed={activeRegion === 'all'} onClick={() => { setActiveRegion('all'); onSelect(null); }}>Whole map <span>{events.length}</span></button>
          {REGIONS.map((region) => <button key={region.id} type="button" className={activeRegion === region.id ? 'active' : ''} aria-pressed={activeRegion === region.id} onClick={() => { setActiveRegion(region.id); onSelect(null); }}><span className="region-filter-name">{region.name}</span><span>{events.filter((event) => layout[String(event.id)]?.regionId === region.id).length}</span></button>)}
        </div>
        <div
          ref={viewportRef}
          className={`map-viewport${dragging ? ' is-dragging' : ''}`}
          role="group"
          aria-roledescription="map"
          aria-label={`Illustrated quest map showing ${regionEvents.length} quest${regionEvents.length === 1 ? '' : 's'}. Drag to pan, plus and minus keys to zoom, arrow keys to move, 0 to reset, Escape to close the preview.`}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          onClickCapture={(e) => { if (movedRef.current) { e.stopPropagation(); e.preventDefault(); } }}
          style={{ visibility: ready ? 'visible' : 'hidden' }}
        >
          <div className="map-haze" aria-hidden="true" style={{ transform: `translate(${cam.x * 0.3}px, ${cam.y * 0.3}px)` }} />
          <div
            className={`map-canvas${animate ? ' is-animating' : ''}`}
            data-testid="map-canvas"
            data-zoom={cam.k.toFixed(3)}
            style={{ width: `${cam.k * 100}%`, aspectRatio: `${MAP_W} / ${MAP_H}`, transform: `translate(${cam.x}px, ${cam.y}px)` }}
          >
            <MapTerrain counts={counts} />
            <div className="map-fireflies" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</div>
            {regionEvents.map((event) => {
              const point = layout[String(event.id)];
              if (!point) return null;
              return <QuestPaper key={event.id} event={event} point={point} selected={String(event.id) === String(selectedId)} saved={saved.has(String(event.id))} onSelect={handleSelect} onFocusPaper={onFocusPaper} />;
            })}
          </div>

          {loading && <div className="map-status" role="status">Unfurling the map…</div>}
          {!loading && regionEvents.length === 0 && (
            <div className="map-empty" role="status">
              <strong>No quests on this stretch of the map.</strong>
              <p>{activeRegion !== 'all' ? 'This region has no quests matching your current selection.' : hasActiveFilters ? 'Nothing matches your current search and filters.' : 'No upcoming quests have been published yet.'}</p>
              {activeRegion !== 'all' && <button type="button" className="secondary-btn" onClick={() => { setActiveRegion('all'); onSelect(null); }}>Explore the whole map</button>}
              {hasActiveFilters && <button type="button" className="secondary-btn" onClick={onClearFilters}>Clear filters</button>}
              {!hasActiveFilters && <a className="primary-btn" href="/publish">Publish the first quest</a>}
            </div>
          )}
        </div>

        <div className="map-controls" role="group" aria-label="Map controls">
          <button type="button" onClick={() => zoomAt(1.3)} aria-label="Zoom in" disabled={cam.k >= MAX_K - 0.001}>+</button>
          <button type="button" onClick={() => zoomAt(1 / 1.3)} aria-label="Zoom out" disabled={cam.k <= minScale + 0.001}>−</button>
          <button type="button" className="map-reset" onClick={() => apply(initialCam(), true)} aria-label="Reset map view">Reset</button>
          <span className="map-zoom-readout" aria-hidden="true">{zoomPct}%</span>
        </div>
        <p className="map-hint">Drag to explore · +/− or Ctrl/⌘ + scroll to zoom · Tab to move between quests</p>
      </div>

      <SelectedQuestPreview event={selected} saved={selected ? saved.has(String(selected.id)) : false} onToggleSave={onToggleSave} onClose={() => onSelect(null)} counts={counts} />
    </div>
  );
}
