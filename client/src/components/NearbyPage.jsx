import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getNearbyEvents } from '../services/api';

const RADIUS_OPTIONS = [1, 5, 10, 25, 50];
const SORT_OPTIONS = [
  { value: 'nearest', label: 'Nearest first' },
  { value: 'soonest', label: 'Soonest upcoming' },
  { value: 'newest', label: 'Newest listed' },
];

function formatDistance(km) {
  if (!Number.isFinite(km)) return '';
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m away`;
  return `${km.toFixed(1)} km away`;
}

function formatWhen(event) {
  if (!event?.date) return 'Date TBD';
  const parsed = new Date(`${event.date}T${event.startTime || '09:00'}:00`);
  if (Number.isNaN(parsed.getTime())) return String(event.date);
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(parsed);
}

function geolocationMessage(error) {
  if (!error) return 'Could not determine your location.';
  if (error.code === 1) return 'Location permission was denied. You can still pick a city below to search around it.';
  if (error.code === 2) return 'Your device could not determine its location (location services may be off). Pick a city below instead.';
  if (error.code === 3) return 'Finding your location took too long. Try again, or pick a city below.';
  return 'Could not determine your location.';
}

export default function NearbyPage({ allEvents = [], categories = [], onViewDetails, onBook }) {
  const [location, setLocation] = useState(null); // { latitude, longitude, label, source }
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState(null); // { tone, text }
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [radiusKm, setRadiusKm] = useState(10);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('nearest');
  const [refreshTick, setRefreshTick] = useState(0);
  const [state, setState] = useState({ status: 'idle', events: [], total: 0, withoutCoordinates: 0, error: '' });
  const requestId = useRef(0);

  // Manual fallback: cities that have real events with coordinates; centre = average of those events.
  const manualCities = useMemo(() => {
    const groups = new Map();
    allEvents.forEach((event) => {
      const lat = Number(event.latitude);
      const lon = Number(event.longitude);
      if (!event.city || event.latitude === '' || event.longitude === '' || event.latitude == null || event.longitude == null) return;
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
      const group = groups.get(event.city) || { city: event.city, lat: 0, lon: 0, n: 0 };
      group.lat += lat; group.lon += lon; group.n += 1;
      groups.set(event.city, group);
    });
    return [...groups.values()]
      .map((g) => ({ city: g.city, latitude: g.lat / g.n, longitude: g.lon / g.n }))
      .sort((a, b) => a.city.localeCompare(b.city));
  }, [allEvents]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const useMyLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationNotice({ tone: 'error', text: 'This browser does not support location detection. Pick a city below to search around it.' });
      return;
    }
    setLocating(true);
    setLocationNotice(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position?.coords?.latitude;
        const longitude = position?.coords?.longitude;
        const valid = Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
        setLocating(false);
        if (!valid) {
          setLocationNotice({ tone: 'error', text: 'Your browser returned invalid coordinates. Try again or pick a city below.' });
          return;
        }
        setLocation({ latitude, longitude, label: 'Your current location', source: 'device' });
        setLocationNotice({ tone: 'ok', text: 'Location detected. Showing quests around you.' });
      },
      (error) => {
        setLocating(false);
        setLocationNotice({ tone: 'error', text: geolocationMessage(error) });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const chooseCity = (cityName) => {
    if (!cityName) return;
    const match = manualCities.find((item) => item.city === cityName);
    if (!match) return;
    setLocation({ latitude: match.latitude, longitude: match.longitude, label: `${match.city} (selected)`, source: 'manual' });
    setLocationNotice(null);
  };

  useEffect(() => {
    if (!location) return undefined;
    const id = ++requestId.current;
    setState((current) => ({ ...current, status: 'loading', error: '' }));
    getNearbyEvents({
      latitude: location.latitude,
      longitude: location.longitude,
      radiusKm,
      category: category === 'all' ? '' : category,
      search,
      sort,
    })
      .then((response) => {
        if (id !== requestId.current) return;
        setState({ status: 'ready', events: response.events || [], total: response.total ?? (response.events || []).length, withoutCoordinates: response.withoutCoordinates || 0, error: '' });
      })
      .catch((error) => {
        if (id !== requestId.current) return;
        setState({ status: 'error', events: [], total: 0, withoutCoordinates: 0, error: error?.message || 'Could not load nearby quests.' });
      });
    return () => { requestId.current += 1; };
  }, [location, radiusKm, category, search, sort, refreshTick]);

  const { status, events, total, withoutCoordinates, error } = state;

  return (
    <section className="nearby-page" aria-labelledby="nearby-heading">
      <div className="nearby-head">
        <h2 id="nearby-heading">Nearby Quests</h2>
        <p className="description">Discover what’s happening around you.</p>
      </div>

      <div className="nearby-location" aria-live="polite">
        <div className="nearby-location-info">
          <span className="eyebrow">Search centre</span>
          <strong>{location ? `📍 ${location.label}` : 'No location selected yet'}</strong>
        </div>
        <button type="button" className="primary-btn" onClick={useMyLocation} disabled={locating}>
          {locating ? 'Finding location…' : location?.source === 'device' ? 'Refresh my location' : 'Use My Location'}
        </button>
        <label className="nearby-city-picker">
          <span>Or choose a city</span>
          <select value={location?.source === 'manual' ? location.label.replace(' (selected)', '') : ''} onChange={(event) => chooseCity(event.target.value)} disabled={manualCities.length === 0}>
            <option value="">{manualCities.length ? 'Select a city…' : 'No cities available'}</option>
            {manualCities.map((item) => <option key={item.city} value={item.city}>{item.city}</option>)}
          </select>
        </label>
      </div>
      {locationNotice ? (
        <p className={`message compact ${locationNotice.tone === 'error' ? 'error-message' : ''}`} role={locationNotice.tone === 'error' ? 'alert' : 'status'}>{locationNotice.text}</p>
      ) : null}

      <div className="nearby-filters filter-grid">
        <label><span>Search</span>
          <input type="search" value={searchInput} placeholder="Name or keyword" onChange={(event) => setSearchInput(event.target.value)} />
        </label>
        <label><span>Radius</span>
          <select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}>
            {RADIUS_OPTIONS.map((km) => <option key={km} value={km}>{km} km</option>)}
          </select>
        </label>
        <label><span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label><span>Sort by</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            {SORT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>

      {location ? (
        <div className="nearby-toolbar">
          <span role="status">
            {status === 'ready' ? <><strong>{events.length}</strong> of {total} quest{total === 1 ? '' : 's'} within {radiusKm} km</> : status === 'loading' ? 'Searching…' : ''}
          </span>
          <button type="button" className="secondary-btn btn-sm" onClick={() => setRefreshTick((n) => n + 1)} disabled={status === 'loading'}>Refresh results</button>
        </div>
      ) : null}

      {!location ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">📍</span>
          <h3>Where should we look?</h3>
          <p>Tap “Use My Location” to find quests around you, or choose a city. Your location is only used for this search and is not stored.</p>
        </div>
      ) : status === 'loading' ? (
        <div className="card-grid" aria-busy="true" aria-label="Loading nearby quests">
          {[0, 1, 2].map((i) => <div key={i} className="event-card nearby-skeleton" aria-hidden="true"><div className="nearby-skel-block tall" /><div className="nearby-skel-block" /><div className="nearby-skel-block short" /></div>)}
        </div>
      ) : status === 'error' ? (
        <div className="empty-state" role="alert">
          <span className="empty-icon" aria-hidden="true">⚠️</span>
          <h3>Couldn’t load nearby quests</h3>
          <p>{error}</p>
          <button type="button" className="primary-btn btn-sm" onClick={() => setRefreshTick((n) => n + 1)}>Retry</button>
        </div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">🧭</span>
          <h3>No quests found nearby</h3>
          <p>Try a larger radius{radiusKm < 50 ? ` (currently ${radiusKm} km)` : ''}, another category, a different keyword, or a different location.{withoutCoordinates > 0 ? ` ${withoutCoordinates} listing${withoutCoordinates === 1 ? ' has' : 's have'} no map location and can’t be searched by distance.` : ''}</p>
        </div>
      ) : (
        <div className="card-grid">
          {events.map((event) => (
            <article key={event.id} className="event-card nearby-card">
              {event.imageUrl ? <img className="event-cover-image nearby-cover" src={event.imageUrl} alt={`${event.title} cover`} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : null}
              <div className="card-topline">
                <span className="pill accent">{event.category}</span>
                <span className="pill nearby-distance">{formatDistance(event.distanceKm)}</span>
              </div>
              <h3>{event.title}</h3>
              <p className="description">{event.description}</p>
              <ul className="meta-list">
                <li>📅 {formatWhen(event)}</li>
                <li>📍 {[event.venue, event.locality, event.city].filter(Boolean).join(', ')}</li>
                <li>{event.isFree || !event.priceStarting ? '🎟️ Free' : `🎟️ From ₹${Number(event.priceStarting).toLocaleString('en-IN')}`}</li>
              </ul>
              <div className="card-actions">
                <button type="button" className="secondary-btn" onClick={() => onViewDetails?.(event)}>View details</button>
                <button type="button" className="primary-btn" onClick={() => onBook?.(event)}>{event.isFree || !event.priceStarting ? 'RSVP Free' : 'Book Tickets'}</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
