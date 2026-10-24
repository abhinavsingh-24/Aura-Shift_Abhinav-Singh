import { useEffect, useMemo, useState } from 'react';
import { createEvent, getEvents, getRecommendations, getInsights, registerForEvent, registerAccount, loginAccount, getCurrentUser, logoutAccount, getHealth, getEventById } from './services/api';
import './App.css';

const interestOptions = ['Music', 'Technology', 'Sports', 'Art and culture', 'Education', 'Gaming', 'Community activities', 'Workshops'];
const categoryOptions = ['Music', 'Technology', 'Sports', 'Art and culture', 'Education', 'Gaming', 'Community activities', 'Workshops'];
const defaultForm = {
  title: '',
  description: '',
  category: 'Music',
  interests: 'Music, Community activities',
  date: '',
  startTime: '',
  city: 'Bengaluru',
  locality: 'Koramangala',
  venue: '',
  organizerName: '',
  capacity: '',
  registrationUrl: '',
  imageUrl: '',
  latitude: '',
  longitude: '',
};

function formatDate(dateString) {
  if (!dateString) return 'Date TBD';
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatEventDateTime(event) {
  if (!event.date) return 'Date TBD';
  const date = new Date(`${event.date}T${event.startTime || '09:00'}:00`);
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getParticipantId() {
  const key = 'sidequest-participant-id';
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `participant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return `participant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function categorySymbol(category) {
  const symbols = {
    Music: '♫',
    Technology: '⌘',
    Sports: '↗',
    'Art and culture': '✳',
    Education: '✎',
    Gaming: '◇',
    'Community activities': '◎',
    Workshops: '✂',
  };
  return symbols[category] || '✦';
}

function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(new URLSearchParams(window.location.search).get('role') === 'organizer' ? 'organizer' : 'explorer');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isRegister) await registerAccount({ name, email, password, role });
      else await loginAccount({ email, password });
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.assign(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
    } catch (submitError) {
      setError(submitError.message || 'Unable to complete this request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <a className="auth-back" href="/">← Back to SIDEQUEST</a>
      <div className="auth-layout">
        <aside className="auth-story">
          <div className="brand-wrap"><div className="brand-mark" aria-hidden="true">✳</div><div><p className="brand-name">SIDEQUEST</p><span className="tagline">Your City. Your Next Quest.</span></div></div>
          <span className="eyebrow"><span className="eyebrow-dot" /> A city of hidden stories</span>
          <h1>{isRegister ? 'Your next chapter starts here.' : 'Welcome back, explorer.'}</h1>
          <p>Find your people, uncover local experiences, and turn an ordinary day into a story worth telling.</p>
          <div className="auth-map" aria-hidden="true"><span>✳</span><i /><b>UNKNOWN ROUTE</b><em>THE NEXT QUEST</em></div>
        </aside>
        <main className="auth-card">
          <span className="eyebrow">{isRegister ? 'Create your account' : 'Continue your journey'}</span>
          <h2>{isRegister ? 'Join SIDEQUEST' : 'Sign in'}</h2>
          <p className="small-copy">{isRegister ? 'A few details, then your city is waiting.' : 'Your next quest is only a sign-in away.'}</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && <label>Full name<input required minLength="2" maxLength="80" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></label>}
            <label>Email address<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
            <label>Password<div className="password-wrap"><input required minLength={isRegister ? 8 : undefined} maxLength="128" type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isRegister ? 'At least 8 characters' : 'Your password'} /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
            {isRegister && <label>Account type<select value={role} onChange={(e) => setRole(e.target.value)}><option value="explorer">Explorer — discover and join quests</option><option value="organizer">Organizer — publish quests</option></select><small className="helper-text">Organizer accounts are not independently verified in this prototype.</small></label>}
            {error && <div className="message error-message" role="alert">{error}</div>}
            <button className="primary-btn auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</button>
          </form>
          <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to SIDEQUEST?'} <a href={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</a></p>
          <p className="helper-text">Prototype note: use a unique password. Never reuse your important personal password in a demo environment.</p>
        </main>
      </div>
    </div>
  );
}

function MainApp() {
  const pathname = window.location.pathname.replace(/\/$/, '') || '/';
  const detailRouteId = pathname.match(/^\/quests\/([^/]+)$/)?.[1] || '';
  const page = detailRouteId ? 'quest-detail' : (({ '/quests': 'quests', '/nearby': 'nearby', '/recommended': 'recommended', '/saved': 'saved', '/publish': 'publish', '/insights': 'insights' })[pathname] || 'home');
  const [currentUser, setCurrentUser] = useState(null);
  const [backendHealth, setBackendHealth] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userCoordinates, setUserCoordinates] = useState(null);
  const [locationStatus, setLocationStatus] = useState('');
  const [locating, setLocating] = useState(false);
  const [events, setEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [insights, setInsights] = useState({ totalRegistrations: 0, popularCategories: [], topEvents: [] });
  const [savedQuestIds, setSavedQuestIds] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('sidequest-saved') || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch (storageError) {
      console.warn('Saved quests storage unavailable.', storageError);
      return [];
    }
  });
  const [selectedInterests, setSelectedInterests] = useState(['Music', 'Technology']);
  const [selectedCity, setSelectedCity] = useState('Bengaluru');
  const [selectedLocality, setSelectedLocality] = useState('Koramangala');
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    date: 'all',
    city: 'all',
    locality: 'all',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(defaultForm);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [detailEvent, setDetailEvent] = useState(null);
  const [detailRouteError, setDetailRouteError] = useState('');
  const [registrationName, setRegistrationName] = useState('');
  const [registering, setRegistering] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!detailRouteId) return undefined;
    let active = true;
    getEventById(decodeURIComponent(detailRouteId)).then((response) => { if (active) { setDetailEvent(response.event); setDetailRouteError(''); } }).catch((loadError) => { if (active) setDetailRouteError(loadError.message || 'This quest could not be found.'); });
    return () => { active = false; };
  }, [detailRouteId]);

  useEffect(() => {
    let active = true;
    getHealth().then((health) => { if (active) setBackendHealth(health); }).catch(() => { if (active) setBackendHealth({ status: 'unavailable', database: 'unknown' }); });
    getCurrentUser().then((response) => { if (active) setCurrentUser(response.user || null); }).catch(() => { if (active) setCurrentUser(null); }).finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'organizer') setFormData((current) => ({ ...current, organizerName: currentUser.name || current.organizerName }));
  }, [currentUser]);

  useEffect(() => {
    try {
      window.localStorage.setItem('sidequest-saved', JSON.stringify(savedQuestIds));
    } catch (storageError) {
      console.warn('Saved quests could not be stored on this device.', storageError);
    }
  }, [savedQuestIds]);

  useEffect(() => {
    if (!detailEvent) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') { setDetailEvent(null); if (page === 'quest-detail') window.location.assign('/quests'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailEvent, page]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const cityOptions = useMemo(
    () => [...new Set(allEvents.map((event) => event.city).filter(Boolean))].sort(),
    [allEvents],
  );

  const filterLocalityOptions = useMemo(
    () => [...new Set(allEvents
      .filter((event) => filters.city === 'all' || event.city === filters.city)
      .map((event) => event.locality).filter(Boolean))].sort(),
    [allEvents, filters.city],
  );

  const localityOptions = useMemo(
    () => [...new Set(allEvents.filter((event) => event.city === selectedCity).map((event) => event.locality).filter(Boolean))].sort(),
    [allEvents, selectedCity],
  );

  useEffect(() => {
    let active = true;
    getEvents().then((response) => {
      if (active) setAllEvents(response.events || []);
    }).catch((loadError) => {
      console.error('Unable to load complete quest list:', loadError);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    async function loadEvents() {
      try {
        setLoading(true);
        const query = {
          search: filters.search,
          category: filters.category === 'all' ? '' : filters.category,
          date: filters.date === 'all' ? '' : filters.date,
          city: filters.city === 'all' ? '' : filters.city,
          locality: filters.locality === 'all' ? '' : filters.locality,
        };
        const response = await getEvents(query);
        setEvents(response.events || []);
        setError('');
      } catch (loadError) {
        setError(loadError.message || 'Unable to load events.');
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, [filters]);

  useEffect(() => {
    async function loadRecommendations() {
      try {
        const response = await getRecommendations({
          interests: selectedInterests,
          category: filters.category === 'all' ? '' : filters.category,
          city: selectedCity,
          locality: selectedLocality,
        });
        setRecommendations(response.recommendations || []);
      } catch (loadError) {
        console.error(loadError);
      }
    }

    loadRecommendations();
  }, [selectedInterests, selectedCity, selectedLocality, filters.category]);

  useEffect(() => {
    async function loadInsights() {
      try {
        const response = await getInsights();
        setInsights(response || { totalRegistrations: 0, popularCategories: [], topEvents: [] });
      } catch (insightError) {
        console.error(insightError);
      }
    }

    loadInsights();
  }, [events]);

  const nearbyEvents = useMemo(() => {
    const withDistance = allEvents.map((event) => {
      if (!userCoordinates || !Number.isFinite(Number(event.latitude)) || !Number.isFinite(Number(event.longitude))) return { ...event, distanceKm: null };
      const radians = (degrees) => degrees * Math.PI / 180;
      const dLat = radians(Number(event.latitude) - userCoordinates.latitude);
      const dLon = radians(Number(event.longitude) - userCoordinates.longitude);
      const lat1 = radians(userCoordinates.latitude);
      const lat2 = radians(Number(event.latitude));
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      return { ...event, distanceKm: 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) };
    });
    if (userCoordinates) return withDistance.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)).slice(0, 8);
    return withDistance.filter((event) => event.city === selectedCity && (!selectedLocality || event.locality === selectedLocality));
  }, [allEvents, selectedCity, selectedLocality, userCoordinates]);

  const requestUserLocation = () => {
    if (!navigator.geolocation) { setLocationStatus('Location is not supported by this browser. Choose a city and locality instead.'); return; }
    setLocating(true); setLocationStatus('');
    navigator.geolocation.getCurrentPosition((position) => {
      setUserCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setLocationStatus('Location found. Nearby quests with coordinates are sorted by distance; other events remain available below.');
      setLocating(false);
    }, (error) => {
      const message = error.code === 1 ? 'Location permission was denied. You can still browse by city and locality.' : 'Could not determine your location. Try again or browse by city and locality.';
      setLocationStatus(message); setLocating(false);
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  };

  const useLocationForVenue = () => {
    if (!navigator.geolocation) { setFormError('This browser does not support location. You can enter coordinates manually.'); return; }
    navigator.geolocation.getCurrentPosition((position) => {
      setFormData((current) => ({ ...current, latitude: String(position.coords.latitude), longitude: String(position.coords.longitude) }));
      setToast('Venue coordinates filled. Use this only if you are at the event venue.');
    }, () => setFormError('Could not access your location. Check browser permission or enter coordinates manually.'), { enableHighAccuracy: true, timeout: 10000 });
  };

  const savedQuests = useMemo(
    () => allEvents.filter((event) => savedQuestIds.includes(event.id)),
    [allEvents, savedQuestIds],
  );

  const toggleInterest = (interest) => {
    setSelectedInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    );
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => {
      if (name === 'city') return { ...current, city: value, locality: 'all' };
      return { ...current, [name]: value };
    });
  };

  const handleCityChange = (city) => {
    setSelectedCity(city);
    const nextLocalities = [...new Set(allEvents.filter((event) => event.city === city).map((event) => event.locality).filter(Boolean))];
    setSelectedLocality(nextLocalities.includes(selectedLocality) ? selectedLocality : nextLocalities[0] || '');
  };

  const toggleSavedQuest = (event) => {
    const isSaved = savedQuestIds.includes(event.id);
    setSavedQuestIds((current) => {
      if (isSaved) {
        return current.filter((id) => id !== event.id);
      }
      return [...current, event.id];
    });
    setToast(isSaved ? 'Quest removed from saved list.' : 'Quest saved for later.');
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      category: 'all',
      date: 'all',
      city: 'all',
      locality: 'all',
    });
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    if (!currentUser || currentUser.role !== 'organizer') { window.location.assign('/register?role=organizer&next=/publish'); return; }
    setFormError('');
    setFormSuccess('');

    const requiredFields = ['title', 'description', 'category', 'date', 'startTime', 'city', 'locality', 'venue', 'organizerName'];
    const hasMissingField = requiredFields.some((field) => !String(formData[field] || '').trim());

    if (hasMissingField) {
      setFormError('Please complete all required quest details before publishing.');
      return;
    }

    try {
      await createEvent({
        ...formData,
        capacity: formData.capacity ? Number(formData.capacity) : undefined,
      });
      setFormData({ ...defaultForm, organizerName: currentUser?.name || '' });
      try {
        const [refreshedEvents, refreshedAllEvents] = await Promise.all([getEvents({
          search: filters.search,
          category: filters.category === 'all' ? '' : filters.category,
          date: filters.date === 'all' ? '' : filters.date,
          city: filters.city === 'all' ? '' : filters.city,
          locality: filters.locality === 'all' ? '' : filters.locality,
        }), getEvents()]);
        setEvents(refreshedEvents.events || []);
        setAllEvents(refreshedAllEvents.events || []);
        setError('');
        setFormSuccess('Quest published successfully. Adjust or clear your filters if it is not visible on the current board.');
      } catch (refreshError) {
        setFormSuccess('Quest published successfully, but the board could not refresh automatically. Reload the page to see it.');
      }
    } catch (submitError) {
      setFormError(submitError.message || 'Unable to publish quest.');
    }
  };

  const handleRegister = async (eventId) => {
    const name = registrationName.trim();
    if (!name) {
      setToast('Enter your name before registering.');
      return;
    }
    if (name.length > 80) {
      setToast('Your name must be 80 characters or fewer.');
      return;
    }

    try {
      setRegistering(true);
      const response = await registerForEvent(eventId, name, getParticipantId());
      setToast(response.message || 'Registration confirmed.');
      setRegistrationName('');
      if (detailEvent && detailEvent.id === eventId) {
        setDetailEvent({ ...detailEvent, registrationMessage: response.message });
      }
      const refreshedInsights = await getInsights();
      setInsights(refreshedInsights || { totalRegistrations: 0, popularCategories: [], topEvents: [] });
    } catch (registerError) {
      setToast(registerError.message || 'Registration failed.');
    } finally {
      setRegistering(false);
    }
  };

  const emptyStateMessage =
    filters.search || filters.category !== 'all' || filters.date !== 'all' || filters.city !== 'all' || filters.locality !== 'all'
      ? 'No events match the current filters. Try resetting to view the full board.'
      : 'No upcoming quests are available right now. Check back soon for new local events.';

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark" aria-hidden="true">✳</div>
          <div>
            <p className="brand-name">SIDEQUEST</p>
            <span className="tagline">Your City. Your Next Quest.</span>
          </div>
        </div>
        <nav className="nav" aria-label="Main navigation">
          <a href="/quests" aria-current={page === 'quests' ? 'page' : undefined}>Quest Board</a>
          <a href="/nearby" aria-current={page === 'nearby' ? 'page' : undefined}>Nearby</a>
          <a href="/recommended" aria-current={page === 'recommended' ? 'page' : undefined}>For You</a>
          <a href="/saved" aria-current={page === 'saved' ? 'page' : undefined}>Saved</a>
          <a href="/publish" aria-current={page === 'publish' ? 'page' : undefined}>Publish</a>
          <span className={`system-status ${backendHealth?.database === 'mongodb' ? 'is-connected' : backendHealth?.database === 'memory' ? 'is-demo' : ''}`} title={backendHealth?.database === 'mongodb' ? 'MongoDB connection is active' : backendHealth?.database === 'memory' ? 'Data is stored in memory and resets when the backend restarts' : 'Backend status unknown'}>{backendHealth?.database === 'mongodb' ? '● MongoDB' : backendHealth?.database === 'memory' ? '● Demo data' : '● Checking API'}</span>
          {currentUser ? <span className="nav-user">Hi, {currentUser.name.split(' ')[0]}</span> : null}
          {currentUser ? <button type="button" className="nav-auth-btn" onClick={async () => { await logoutAccount().catch(() => {}); window.location.assign('/'); }}>Sign out</button> : <><a href="/login">Sign in</a><a className="nav-register" href="/register">Join</a></>}
        </nav>
      </header>

      <main className="page-shell">
        {page !== 'home' ? <div className="route-heading"><span className="eyebrow">SIDEQUEST / {page.replace('-', ' ')}</span><h1>{({ quests: 'Find your next quest', nearby: 'Explore nearby', recommended: 'Picked for your interests', saved: 'Your saved quests', publish: 'Create a new quest', insights: 'Community field notes', 'quest-detail': 'Quest details' })[page] || 'Explore SIDEQUEST'}</h1><p className="description">Every city has a story you have not discovered yet.</p></div> : null}
        {page === 'quest-detail' && detailRouteError ? <div className="message error-message">{detailRouteError} <a href="/quests">Return to the Quest Board</a></div> : null}
        {page === 'home' && <section className="hero-section">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" /> The city is full of stories</span>
            <h1>Your City.<br />Your Next <em>Quest.</em></h1>
            <p>
              Find the workshops, open mics, hackathons, sports, and hidden local experiences that make an ordinary day extraordinary.
            </p>
            <div className="hero-actions">
              <a href="/quests" className="primary-btn">Explore quests</a>
              <a href="/publish" className="secondary-btn">Publish a quest</a>
            </div>
            <div className="hero-note"><span className="note-pin">↗</span><span>There is more to your city than your usual route.</span></div>
          </div>
          <div className="hero-art" aria-label="Illustrated mystery map of a city">
            <div className="map-orbit orbit-one" />
            <div className="map-orbit orbit-two" />
            <div className="map-route route-one" />
            <div className="map-route route-two" />
            <span className="map-pin pin-one">✦</span><span className="map-pin pin-two">✦</span><span className="map-pin pin-three">✦</span>
            <span className="map-label label-one">THE NEXT QUEST</span><span className="map-label label-two">UNKNOWN ROUTE</span>
            <div className="map-compass">N<br /><span>✳</span></div>
            <div className="hero-panel">
              <div className="stat-block">
                <strong>{allEvents.length || 0}</strong>
                <span>Upcoming quests</span>
              </div>
              <div className="stat-block">
                <strong>{recommendations.length || 0}</strong>
                <span>Top matches</span>
              </div>
              <div className="stat-block">
                <strong>{savedQuestIds.length || 0}</strong>
                <span>Saved quests</span>
              </div>
            </div>
          </div>
        </section>}

        {(page === 'home' || page === 'quests') && <section id="quest-board" className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Quest Board</span>
              <h2>Upcoming events</h2>
            </div>
            <button type="button" className="ghost-btn" onClick={clearFilters}>Clear filters</button>
          </div>

          <div className="filter-grid">
            <label>
              <span>Search</span>
              <input
                type="text"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Try music, art, workshops, or a place…"
              />
            </label>
            <label>
              <span>Category</span>
              <select name="category" value={filters.category} onChange={handleFilterChange}>
                <option value="all">All categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Date</span>
              <select name="date" value={filters.date} onChange={handleFilterChange}>
                <option value="all">Any time</option>
                <option value="today">Today</option>
                <option value="weekend">Weekend</option>
                <option value="next7days">Next 7 days</option>
              </select>
            </label>
            <label>
              <span>City</span>
              <select name="city" value={filters.city} onChange={handleFilterChange}>
                <option value="all">All cities</option>
                {cityOptions.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Locality</span>
              <select name="locality" value={filters.locality} onChange={handleFilterChange}>
                <option value="all">All localities</option>
                {filterLocalityOptions.map((locality) => (
                  <option key={locality} value={locality}>{locality}</option>
                ))}
              </select>
            </label>
          </div>

          {error ? <div className="message error-message">{error}</div> : null}

          {loading ? (
            <div className="loading-box">Loading nearby quests...</div>
          ) : events.length === 0 ? (
            <div className="empty-state">{emptyStateMessage}</div>
          ) : (
            <div className="card-grid">
              {events.map((event) => (
                <article key={event.id} className="event-card">
                  <div className={`card-visual visual-${categoryOptions.indexOf(event.category) < 0 ? 0 : categoryOptions.indexOf(event.category) % 6}`}>
                    {event.imageUrl ? <img className="event-cover-image" src={event.imageUrl} alt={`${event.title} event`} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : null}
                    <span className="visual-symbol" aria-hidden="true">{categorySymbol(event.category)}</span>
                    <span className="visual-caption">A SIDEQUEST FIELD NOTE</span>
                    <span className="visual-stamp">{event.category}</span>
                  </div>
                  <div className="card-topline">
                    <span className="pill accent">{event.category}</span>
                    {event.isSampleData ? <span className="pill muted">Development data</span> : null}
                  </div>
                  <h3>{event.title}</h3>
                  <p className="description">{event.description}</p>
                  <ul className="meta-list">
                    <li>{formatEventDateTime(event)}</li>
                    <li>{event.city}, {event.locality}</li>
                    <li>{event.venue}</li>
                    <li>Organised by {event.organizerName}</li>
                  </ul>
                  <div className="card-actions">
                    <button type="button" className="secondary-btn" onClick={() => setDetailEvent(event)}>
                      View details
                    </button>
                    <button
                      type="button"
                      className={savedQuestIds.includes(event.id) ? 'save-btn active' : 'save-btn'}
                      onClick={() => toggleSavedQuest(event)}
                    >
                      {savedQuestIds.includes(event.id) ? 'Saved' : 'Save quest'}
                    </button>
                    <a className="secondary-btn map-card-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.latitude != null && event.longitude != null ? `${event.latitude},${event.longitude}` : `${event.venue}, ${event.locality}, ${event.city}`)}`} target="_blank" rel="noreferrer">Map ↗</a>
                    <button type="button" className="primary-btn" onClick={() => window.location.assign(`/quests/${encodeURIComponent(event.id)}`)}>
                      View quest
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>}

        {(page === 'home' || page === 'recommended') && <section id="recommended" className="panel recommendation-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Recommendations</span>
              <h2>What matches your interests?</h2>
            </div>
          </div>

          <div className="interest-picker">
            {interestOptions.map((interest) => (
              <button
                key={interest}
                type="button"
                className={selectedInterests.includes(interest) ? 'interest-chip active' : 'interest-chip'}
                onClick={() => toggleInterest(interest)}
              >
                {interest}
              </button>
            ))}
          </div>

          <div className="recommendation-controls">
            <label>
              <span>City</span>
              <select value={selectedCity} onChange={(e) => handleCityChange(e.target.value)}>
                {cityOptions.length ? cityOptions.map((city) => <option key={city} value={city}>{city}</option>) : <option value="">No cities</option>}
              </select>
            </label>
            <label>
              <span>Locality</span>
              <select value={localityOptions.length ? selectedLocality : ''} onChange={(e) => setSelectedLocality(e.target.value)}>
                {localityOptions.length ? localityOptions.map((locality) => <option key={locality} value={locality}>{locality}</option>) : <option value="">No localities</option>}
              </select>
            </label>
          </div>

          <div className="recommendation-list">
            {recommendations.length === 0 ? (
              <div className="empty-state compact">No recommendations available yet.</div>
            ) : (
              recommendations.map((event) => (
                <div key={event.id} className="recommendation-item">
                  <div>
                    <button type="button" className="recommendation-link" onClick={() => setDetailEvent(event)}>{event.title}</button>
                    <p className="small-copy">{event.city} • {event.locality}</p>
                  </div>
                  <div className="score-wrap">
                    <span className="score-badge">{event.score}</span>
                    <ul>
                      {(event.reasons || []).map((reason, index) => (
                        <li key={`${event.id}-${index}`}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>}

        {(page === 'home' || page === 'nearby') && <section id="nearby" className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Nearby Quests</span>
              <h2>{userCoordinates ? 'Around your location' : `${selectedCity} • ${selectedLocality}`}</h2>
              <p className="small-copy">Use your device location for distance sorting, or browse by city and locality. Exact distances require event venue coordinates.</p>
            </div>
            <button type="button" className="secondary-btn" onClick={requestUserLocation} disabled={locating}>{locating ? 'Finding location…' : userCoordinates ? 'Refresh location' : 'Use my location'}</button>
          </div>
          {locationStatus ? <div className="message compact">{locationStatus}</div> : null}
          {nearbyEvents.length === 0 ? (
            <div className="empty-state compact">No nearby quests match this locality yet.</div>
          ) : (
            <div className="mini-grid">
              {nearbyEvents.map((event) => (
                <button type="button" key={event.id} className="mini-card" onClick={() => setDetailEvent(event)}>
                  <span>{event.title}</span>
                  <small>{formatDate(event.date)} • {event.locality}{event.distanceKm !== null && event.distanceKm !== undefined ? ` • ${event.distanceKm.toFixed(1)} km away` : ''}</small>
                </button>
              ))}
            </div>
          )}
        </section>}

        {(page === 'home' || page === 'saved') && <section id="saved" className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Saved Quests</span>
              <h2>Your bookmarked finds</h2>
            </div>
          </div>
          {savedQuests.length === 0 ? (
            <div className="empty-state compact">Save a few quests you like to revisit later.</div>
          ) : (
            <div className="saved-grid">
              {savedQuests.map((event) => (
                <div key={event.id} className="saved-card">
                  <div>
                    <p className="recommendation-title">{event.title}</p>
                    <p className="small-copy">{event.city} • {event.locality}</p>
                  </div>
                  <button type="button" className="secondary-btn" onClick={() => setDetailEvent(event)}>
                    View details
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>}

        {(page === 'home' || page === 'insights') && <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Community Insights</span>
              <h2>Participation snapshot</h2>
            </div>
          </div>
          <div className="insight-grid">
            <div className="stat-box">
              <strong>{insights.totalRegistrations || 0}</strong>
              <span>Total registrations</span>
            </div>
            <div className="stat-box">
              <strong>{insights.popularCategories?.[0]?.name || 'N/A'}</strong>
              <span>Most registered category</span>
            </div>
          </div>
          <div className="insight-list">
            {insights.topEvents && insights.topEvents.length > 0 ? (
              insights.topEvents.map((entry) => (
                <div key={entry.title} className="insight-item">
                  <span>{entry.title}</span>
                  <strong>{entry.count} registrations</strong>
                </div>
              ))
            ) : (
              <div className="empty-state compact">No recorded registrations yet.</div>
            )}
          </div>
        </section>}

        {(page === 'home' || page === 'publish') && (authLoading ? <section id="publish" className="panel"><div className="loading-box">Checking your account…</div></section> : currentUser?.role === 'organizer' ? <section id="publish" className="panel form-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Publish a Quest</span>
              <h2>Create a local event</h2>
            </div>
          </div>

          <form onSubmit={handleFormSubmit} className="quest-form">
            <div className="form-grid">
              <label>
                <span>Quest title</span>
                <input required maxLength="120" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Sunset yoga social" />
              </label>
              <label>
                <span>Category</span>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="full-width">
                <span>Description</span>
                <textarea required maxLength="2000" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Tell people what to expect and why they should join." rows="4" />
              </label>
              <label>
                <span>Interests</span>
                <input value={formData.interests} onChange={(e) => setFormData({ ...formData, interests: e.target.value })} placeholder="Music, Community activities" />
              </label>
              <label>
                <span>Date</span>
                <input required min={new Date().toLocaleDateString('en-CA')} type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
              </label>
              <label>
                <span>Start time</span>
                <input required type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} />
              </label>
              <label>
                <span>City</span>
                <input required value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="Bengaluru" />
              </label>
              <label>
                <span>Locality</span>
                <input required value={formData.locality} onChange={(e) => setFormData({ ...formData, locality: e.target.value })} placeholder="Koramangala" />
              </label>
              <label>
                <span>Venue</span>
                <input required value={formData.venue} onChange={(e) => setFormData({ ...formData, venue: e.target.value })} placeholder="Riverside Lawn" />
              </label>
              <label>
                <span>Latitude (optional)</span>
                <input type="number" step="any" min="-90" max="90" value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} placeholder="e.g. 19.3919" />
              </label>
              <label>
                <span>Longitude (optional)</span>
                <input type="number" step="any" min="-180" max="180" value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} placeholder="e.g. 72.8397" />
              </label>
              <div className="full-width location-form-note"><p className="helper-text">Add venue coordinates to enable distance sorting. Use this button only when you are physically at the event venue.</p><button type="button" className="secondary-btn" onClick={useLocationForVenue}>Use my current location for venue pin</button></div>
              <label>
                <span>Organiser</span>
                <input required value={currentUser?.name || formData.organizerName} readOnly aria-readonly="true" />
              </label>
              <label>
                <span>Capacity</span>
                <input type="number" min="1" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} placeholder="Optional capacity" />
              </label>
              <label>
                <span>Registration URL</span>
                <input type="url" value={formData.registrationUrl} onChange={(e) => setFormData({ ...formData, registrationUrl: e.target.value })} placeholder="https://example.com/register" />
              </label>
              <label className="full-width">
                <span>Event image URL (optional)</span>
                <input type="url" value={formData.imageUrl} onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} placeholder="https://example.com/event-photo.jpg" />
                <small className="helper-text">Use an image you have permission to share. If left blank, SIDEQUEST uses its original illustrated fallback.</small>
              </label>
            </div>

            {formError ? <div className="message error-message">{formError}</div> : null}
            {formSuccess ? <div className="message success-message">{formSuccess}</div> : null}

            <div className="submit-row">
              <button type="submit" className="primary-btn">Publish quest</button>
              <small className="helper-text">Signed in as {currentUser?.name}. Organizer identity is not independently verified in this prototype.</small>
            </div>
          </form>
        </section> : <section id="publish" className="panel auth-gate"><span className="eyebrow">Organizer access</span><h2>Every great quest needs a guide.</h2><p className="description">{currentUser ? 'Your current account is an explorer account. Create an organizer account to publish events.' : 'Create an organizer account to publish events. Organizer identity is not independently verified in this prototype.'}</p><div className="hero-actions"><a className="primary-btn" href="/register?role=organizer&next=/publish">Create organizer account</a><a className="secondary-btn" href="/login?next=/publish">Sign in</a></div></section>)}
      </main>

      <footer className="site-footer"><div className="footer-brand"><span className="brand-mark" aria-hidden="true">✳</span><div><strong>SIDEQUEST</strong><span>Your City. Your Next Quest.</span></div></div><p>Life is the main quest. Experiences are the sidequests.</p><div className="footer-links"><a href="/quests">Explore</a><a href="/nearby">Nearby</a><a href="/publish">Publish</a></div><small>Demo project • Event details may include clearly labelled sample data.</small></footer>

      {detailEvent ? (
        <div className="modal-backdrop" onClick={() => { setDetailEvent(null); if (page === 'quest-detail') window.location.assign('/quests'); }}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="quest-dialog-title" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="close-button" aria-label="Close quest details" onClick={() => { setDetailEvent(null); if (page === 'quest-detail') window.location.assign('/quests'); }}>×</button>
            <div className="modal-header">
              <span className="pill accent">{detailEvent.category}</span>
              {detailEvent.isSampleData ? <span className="pill muted">Development data</span> : null}
            </div>
            <h3 id="quest-dialog-title">{detailEvent.title}</h3>
            <p className="description">{detailEvent.description}</p>
            <ul className="meta-list detail-list">
              <li><strong>Date:</strong> {formatEventDateTime(detailEvent)}</li>
              <li><strong>Venue:</strong> {detailEvent.venue}</li>
              <li><strong>Directions:</strong> <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detailEvent.latitude != null && detailEvent.longitude != null ? `${detailEvent.latitude},${detailEvent.longitude}` : `${detailEvent.venue}, ${detailEvent.locality}, ${detailEvent.city}`)}`} target="_blank" rel="noreferrer">Open map and directions ↗</a></li>
              <li><strong>City:</strong> {detailEvent.city}</li>
              <li><strong>Locality:</strong> {detailEvent.locality}</li>
              <li><strong>Organiser:</strong> {detailEvent.organizerName}</li>
              <li><strong>Capacity:</strong> {detailEvent.capacity || 'Open to all'}</li>
              {detailEvent.registrationUrl ? <li><strong>Register:</strong> <a href={detailEvent.registrationUrl} target="_blank" rel="noreferrer">External link</a></li> : null}
            </ul>
            {detailEvent.latitude != null && detailEvent.longitude != null ? <div className="event-map-wrap"><iframe className="event-map" title={`Map for ${detailEvent.title}`} loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(detailEvent.longitude) - 0.01}%2C${Number(detailEvent.latitude) - 0.01}%2C${Number(detailEvent.longitude) + 0.01}%2C${Number(detailEvent.latitude) + 0.01}&layer=mapnik&marker=${detailEvent.latitude}%2C${detailEvent.longitude}`} /><small className="helper-text">Map data © OpenStreetMap contributors</small></div> : <p className="helper-text">No exact map pin has been added for this venue yet. Use the address-based directions link above.</p>}
            <div className="card-actions modal-actions">
              <button
                type="button"
                className={savedQuestIds.includes(detailEvent.id) ? 'save-btn active' : 'save-btn'}
                onClick={() => toggleSavedQuest(detailEvent)}
              >
                {savedQuestIds.includes(detailEvent.id) ? 'Saved' : 'Save quest'}
              </button>
              <label className="registration-name-field">
                <span>Your name to register</span>
                <input value={registrationName} maxLength="80" onChange={(e) => setRegistrationName(e.target.value)} placeholder="Enter your name" autoComplete="name" />
              </label>
              <button type="button" className="primary-btn" disabled={registering} onClick={() => handleRegister(detailEvent.id)}>
                {registering ? 'Registering…' : 'Join this quest'}
              </button>
              <button type="button" className="secondary-btn" onClick={() => { setDetailEvent(null); if (page === 'quest-detail') window.location.assign('/quests'); }}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="toast" role="status" aria-live="polite" onClick={() => setToast('')}>
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/login') return <AuthPage mode="login" />;
  if (path === '/register') return <AuthPage mode="register" />;
  return <MainApp />;
}

export default App;
