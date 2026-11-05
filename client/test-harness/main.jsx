// Test harness: mounts the REAL map, detail panel, region filter and detail store with a controllable fetcher.
// The list below is a minimal mirror of App's list (same boardEvents, same selection callbacks) — it is not App's JSX.
import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import WorldMap from '../src/components/map/WorldMap';
import QuestDetailPanel from '../src/components/map/QuestDetailPanel';
import RegionFilter from '../src/components/map/RegionFilter';
import { createQuestDetailStore } from '../src/lib/questDetailStore';
import { filterByRegion, regionCounts, reconcileSelection } from '../src/lib/questSelection';
import '../src/components/brand.css';
import '../src/components/map/map.css';

const CATS = ['Music', 'Technology', 'Sports', 'Art and culture', 'Workshops', 'Gaming', 'Community activities', 'Education'];
const params = new URLSearchParams(window.location.search);
const dense = Number(params.get('dense') || 0);

function makeEvents() {
  const list = [];
  for (let i = 0; i < 16; i += 1) list.push({ id: `evt-${String(i).padStart(2, '0')}`, title: `Quest ${i} with a rather long title that must truncate gracefully`, category: CATS[i % CATS.length], date: '2026-11-10', startTime: '18:00', venue: 'Venue', locality: 'Locality', city: 'Mumbai', description: `Listing description ${i}`, organizerName: 'Host' });
  for (let i = 0; i < dense; i += 1) list.push({ id: `dense-${String(i).padStart(3, '0')}`, title: `Dense ${i}`, category: 'Music', date: '2026-11-11', startTime: '19:00', venue: 'Hall', locality: 'Bandra', city: 'Mumbai', description: 'dense', organizerName: 'Host' });
  return list;
}
const ALL = makeEvents();

// Every fetch is recorded and resolved/rejected by the test, so ordering and failures are fully controlled.
window.__requests = [];
const store = createQuestDetailStore((id, { signal }) => new Promise((resolve, reject) => {
  const req = { id, aborted: false, resolve: (v) => resolve(v), reject: (m) => reject(new Error(m)) };
  signal.addEventListener('abort', () => { req.aborted = true; reject(new Error('aborted')); });
  window.__requests.push(req);
  if (params.get('auto')) setTimeout(() => resolve({ id, description: `Fetched detail ${id}` }), 30);
}));

function Harness() {
  const [events] = useState(ALL);
  const [selectedId, setSelectedId] = useState(null);
  const [region, setRegion] = useState('all');
  const [view, setView] = useState('map');
  const select = useCallback((item) => setSelectedId(item ? item.id : null), []);
  const preview = useCallback((item) => store.prefetch(item.id), []);
  const board = useMemo(() => filterByRegion(events, region), [events, region]);
  const counts = useMemo(() => regionCounts(events), [events]);
  const selected = useMemo(() => board.find((e) => String(e.id) === String(selectedId)) || null, [board, selectedId]);
  useEffect(() => { setSelectedId((cur) => reconcileSelection(cur, board)); }, [board]);
  const siblings = useMemo(() => board, [board]);
  return (
    <main style={{ padding: 12 }}>
      <div className="board-toolbar">
        <div className="view-toggle" role="group" aria-label="Choose how to view quests">
          <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>Map</button>
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
        </div>
        <span className="board-count" data-testid="count">{board.length} quests</span>
      </div>
      <RegionFilter value={region} onChange={setRegion} total={events.length} counts={counts} />
      <div className="board-layout">
        <div className="board-main">
          {view === 'map' ? (
            <WorldMap events={board} allEvents={events} loading={false} selectedId={selectedId} onSelect={select} onPreview={preview} savedIds={[]} regionCounts={counts} activeRegion={region} onRegionChange={setRegion} onClearFilters={() => setRegion('all')} hasActiveFilters={false} />
          ) : (
            <div className="card-grid" data-testid="list">
              {board.map((e) => (
                <article key={e.id} className={`event-card${String(e.id) === String(selectedId) ? ' is-selected' : ''}`} data-quest-id={e.id} aria-current={String(e.id) === String(selectedId) ? 'true' : undefined}>
                  <h3><button type="button" className="card-title-btn" aria-pressed={String(e.id) === String(selectedId)} onClick={() => select(e)}>{e.title}</button></h3>
                </article>
              ))}
            </div>
          )}
        </div>
        <QuestDetailPanel store={store} event={selected} siblings={siblings.filter((s) => s.category === selected?.category)} saved={false} onToggleSave={() => {}} onRegister={() => {}} onSelect={select} onClose={() => select(null)} counts={counts} />
      </div>
    </main>
  );
}
createRoot(document.getElementById('root')).render(<StrictMode><Harness /></StrictMode>);
