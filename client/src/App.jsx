import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createEvent,
  getEvents,
  getRecommendations,
  getInsights,
  registerForEvent,
  registerAccount,
  loginAccount,
  getCurrentUser,
  logoutAccount,
  getHealth,
  getEventById,
  getMyRegistrations,
  submitReport,
  getMyReports,
} from './services/api';
import BrandLogo from './components/BrandLogo';
import WorldMap from './components/map/WorldMap';
import CheckoutModal from './components/CheckoutModal';
import MyTickets from './components/MyTickets';
import OrganizerPortal from './components/OrganizerPortal';
import AdminPortal from './components/AdminPortal';
import Footer from './components/Footer';
import MobileBottomNav from './components/MobileBottomNav';
import { addEventToChain, createQuestChain, estimateChainSummary, moveChainStop, removeChainStop } from './lib/questChains';
import { rankRadarQuests } from './lib/questRadar';
import { getMysteryQuest } from './lib/mysteryQuest';
import { getAchievements } from './lib/achievements';
import { createLocalReview, validateReviewDraft } from './lib/community';
import { rankSmartRecommendations } from './lib/smartRecommendations';
import { getExplorerLevel } from './lib/gamification';
import { answerAdventureQuestion } from './lib/adventureAssistant';
import './App.css';

const interestOptions = [
  'Music',
  'Technology',
  'Sports',
  'Art and culture',
  'Education',
  'Gaming',
  'Community activities',
  'Workshops',
];

const categoryOptions = [
  'Music',
  'Technology',
  'Sports',
  'Art and culture',
  'Education',
  'Gaming',
  'Community activities',
  'Workshops',
  'College festivals',
  'Music concerts',
  'Startup & entrepreneurship',
  'Cultural festivals',
];

const INDIA_CITIES = [
  { name: 'Bengaluru', icon: '🏛️', tag: 'Tech Capital' },
  { name: 'Mumbai', icon: '🌊', tag: 'Maximum City' },
  { name: 'Delhi NCR', icon: '🏛️', tag: 'National Hub' },
  { name: 'Pune', icon: '🎓', tag: 'Oxford of East' },
  { name: 'Hyderabad', icon: '💎', tag: 'Cyberabad' },
  { name: 'Chennai', icon: '🎭', tag: 'Cultural Coast' },
  { name: 'Goa', icon: '🌴', tag: 'Sun & Music' },
  { name: 'Kolkata', icon: '📚', tag: 'City of Joy' },
  { name: 'Ahmedabad', icon: '🧵', tag: 'Heritage & Craft' },
  { name: 'Jaipur', icon: '🏰', tag: 'Pink City' },
  { name: 'Kochi', icon: '⛵', tag: 'Queen of Arabia' },
  { name: 'Chandigarh', icon: '🌲', tag: 'City Beautiful' },
];

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
  if (!event) return 'Date TBD';
  if (event.date instanceof Date && !Number.isNaN(event.date.getTime())) {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(event.date);
  }
  if (!event.date) return 'Date TBD';
  try {
    const dateStr = String(event.date);
    const timeStr = event.startTime || '09:00';
    const parsed = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T${timeStr}:00`);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(parsed);
  } catch {
    return 'Date TBD';
  }
}

function categorySymbol(category) {
  const symbols = {
    Music: '♫',
    'Music concerts': '♫',
    Technology: '⌘',
    Sports: '↗',
    'Sports, marathons and outdoor activities': '↗',
    'Art and culture': '✳',
    'Art, photography and creative workshops': '✳',
    'Cultural festivals': '✳',
    Education: '✎',
    'College festivals': '🎓',
    Gaming: '◇',
    'Community activities': '◎',
    'Community events and volunteering': '◎',
    'Startup & entrepreneurship': '🚀',
    Workshops: '✂',
  };
  return symbols[category] || '✦';
}

function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const authQuery = new URLSearchParams(window.location.search);
  const nextPath = authQuery.get('next');
  const switchHref = `${isRegister ? '/login' : '/register'}${
    nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//')
      ? `?next=${encodeURIComponent(nextPath)}`
      : ''
  }`;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(
    new URLSearchParams(window.location.search).get('role') === 'organizer' ? 'organizer' : 'explorer',
  );
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
          <BrandLogo variant="full" />
          <span className="eyebrow"><span className="eyebrow-dot" /> A country of hidden discoveries</span>
          <h1>{isRegister ? 'Your next chapter starts here.' : 'Welcome back, explorer.'}</h1>
          <p>Find genuine tech conferences, college fests, indie concerts, and verified experiences across India.</p>
          <div className="auth-map" aria-hidden="true"><span>✳</span><i /><b>INDIA DISCOVERY</b><em>THE NEXT QUEST</em></div>
        </aside>
        <main className="auth-card">
          <span className="eyebrow">{isRegister ? 'Create your account' : 'Continue your journey'}</span>
          <h2>{isRegister ? 'Join SIDEQUEST' : 'Sign in'}</h2>
          <p className="small-copy">{isRegister ? 'A few details, then all of India is waiting.' : 'Your next quest is only a sign-in away.'}</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && <label>Full name<input required minLength="2" maxLength="80" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></label>}
            <label>Email address<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
            <label>Password<div className="password-wrap"><input required minLength={isRegister ? 8 : undefined} maxLength="128" type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isRegister ? 'At least 8 characters' : 'Your password'} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
            {isRegister && (
              <label>
                Account type
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="explorer">Explorer — discover and book tickets</option>
                  <option value="organizer">Organizer — publish and manage events</option>
                </select>
                <small className="helper-text">Select Organizer to publish quests and scan admissions.</small>
              </label>
            )}
            {error && <div className="message error-message" role="alert">{error}</div>}
            <button className="primary-btn auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</button>
          </form>
          <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to SIDEQUEST?'} <a href={switchHref}>{isRegister ? 'Sign in' : 'Create an account'}</a></p>
        </main>
      </div>
    </div>
  );
}

function MainApp() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname.replace(/\/$/, '') || '/');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  useEffect(() => {
    if (!moreOpen) return undefined;
    const close = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !moreRef.current?.contains(e.target)) setMoreOpen(false); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [moreOpen]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname.replace(/\/$/, '') || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path) => {
    const target = path.replace(/\/$/, '') || '/';
    if (window.location.pathname.replace(/\/$/, '') !== target) {
      window.history.pushState({}, '', target);
    }
    setCurrentPath(target);
    setMobileNavOpen(false);
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavLink = (e, path) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    e.preventDefault();
    navigateTo(path);
  };

  const pathname = currentPath;
  const detailRouteId = pathname.match(/^\/quests\/([^/]+)$/)?.[1] || '';
  const page = detailRouteId
    ? 'quest-detail'
    : ({
        '/quests': 'quests',
        '/nearby': 'nearby',
        '/recommended': 'recommended',
        '/saved': 'saved',
        '/radar': 'radar',
        '/chains': 'chains',
        '/reminders': 'reminders',
        '/mystery': 'mystery',
        '/achievements': 'achievements',
        '/profile': 'profile',
        '/chat': 'chat',
        '/calendar': 'calendar',
        '/levels': 'levels',
        '/publish': 'publish',
        '/insights': 'insights',
        '/organizer': 'organizer',
        '/bookings': 'bookings',
        '/admin': 'admin',
        '/safety': 'safety',
        '/assistant': 'assistant',
      }[pathname] || 'home');

  const [currentUser, setCurrentUser] = useState(null);
  const [reviewDraft, setReviewDraft] = useState({ rating: '5', story: '', tips: '' });
  const [reviewsByQuest, setReviewsByQuest] = useState(() => {
    try {
      const value = JSON.parse(window.localStorage.getItem('sidequest-reviews') || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  });
  const [profileDraft, setProfileDraft] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('sidequest-profile') || '{"bio":"","city":"","visibility":"public"}'); }
    catch { return { bio: '', city: '', visibility: 'public' }; }
  });
  const [reviewMessage, setReviewMessage] = useState('');
  const [reportDraft, setReportDraft] = useState({ reason: 'unsafe', details: '' });
  const [reportMessage, setReportMessage] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [myReports, setMyReports] = useState([]);
  const [myReportsError, setMyReportsError] = useState('');
  const [backendHealth, setBackendHealth] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userCoordinates, setUserCoordinates] = useState(null);
  const [locationStatus, setLocationStatus] = useState('');
  const [locating, setLocating] = useState(false);
  const [events, setEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [insights, setInsights] = useState({ totalRegistrations: 0, popularCategories: [], topEvents: [] });
  const [myBookings, setMyBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState('');
  const [checkoutEvent, setCheckoutEvent] = useState(null);

  const [savedQuestIds, setSavedQuestIds] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('sidequest-saved') || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch (storageError) {
      console.warn('Saved quests storage unavailable.', storageError);
      return [];
    }
  });

  const [selectedInterests, setSelectedInterests] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('sidequest-interests') || 'null');
      return Array.isArray(stored) ? stored.filter((item) => interestOptions.includes(item)) : ['Music', 'Technology'];
    } catch {
      return ['Music', 'Technology'];
    }
  });

  const [selectedCity, setSelectedCity] = useState('Bengaluru');
  const [selectedLocality, setSelectedLocality] = useState('Koramangala');
  const [radarFilters, setRadarFilters] = useState({ timeframe: 'next7days', category: 'all', city: 'all', locality: 'all', radiusKm: '25', sort: 'match' });
  const [mysteryPick, setMysteryPick] = useState(null);
  const [mysteryFilters, setMysteryFilters] = useState({ city: 'all', category: 'all', time: 'any' });
  const [mysteryRevealCount, setMysteryRevealCount] = useState(() => {
    try { return Math.max(0, Number(window.localStorage.getItem('sidequest-mystery-reveals')) || 0); } catch { return 0; }
  });

  const [reminderLeadMinutes, setReminderLeadMinutes] = useState(() => {
    try {
      const stored = Number(window.localStorage.getItem('sidequest-reminder-lead-minutes'));
      return [15, 30, 60, 1440].includes(stored) ? stored : 60;
    } catch { return 60; }
  });
  const [remindersEnabled, setRemindersEnabled] = useState(() => {
    try { return window.localStorage.getItem('sidequest-reminders-enabled') === 'true'; } catch { return false; }
  });
  const [reminderStatus, setReminderStatus] = useState('');
  const [reminderNow, setReminderNow] = useState(() => Date.now());
  const currentTime = useMemo(() => new Date(reminderNow), [reminderNow]);
  const [todayDateString] = useState(() => new Date().toLocaleDateString('en-CA'));

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
  const [registering, setRegistering] = useState(false);
  const [partyMessage, setPartyMessage] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [assistantDraft, setAssistantDraft] = useState('');
  const [assistantMessages, setAssistantMessages] = useState(() => {
    try { const value = JSON.parse(window.localStorage.getItem('sidequest-assistant-messages') || '[]'); return Array.isArray(value) ? value.slice(-30) : []; }
    catch { return []; }
  });
  const [chatMessages, setChatMessages] = useState(() => {
    try { const v = JSON.parse(window.localStorage.getItem('sidequest-party-chat') || '[]'); return Array.isArray(v) ? v : []; }
    catch { return []; }
  });
  const [chainShareFallback, setChainShareFallback] = useState('');
  const [questChains, setQuestChains] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('sidequest-quest-chains') || '[]');
      return Array.isArray(stored) ? stored.filter((chain) => chain && typeof chain.id === 'string' && typeof chain.title === 'string' && Array.isArray(chain.stops)) : [];
    } catch { return []; }
  });
  const [activeChainId, setActiveChainId] = useState(() => {
    try { return window.localStorage.getItem('sidequest-active-chain') || ''; } catch { return ''; }
  });

  const activeQuestChain = useMemo(() => questChains.find((chain) => chain.id === activeChainId) || questChains[0] || null, [questChains, activeChainId]);
  const achievementStats = useMemo(() => ({ savedCount: savedQuestIds.length, chainCount: questChains.length, chainStops: questChains.reduce((total, chain) => total + chain.stops.length, 0), mysteryRevealCount }), [savedQuestIds, questChains, mysteryRevealCount]);
  const achievements = useMemo(() => getAchievements(achievementStats), [achievementStats]);
  const [newChainTitle, setNewChainTitle] = useState('');
  const [chainError, setChainError] = useState('');
  const [toast, setToast] = useState('');
  const smartRecommendations = useMemo(() => rankSmartRecommendations(recommendations.length ? recommendations : allEvents, { interests: selectedInterests, savedIds: savedQuestIds, city: selectedCity, now: currentTime }), [recommendations, allEvents, selectedInterests, savedQuestIds, selectedCity, currentTime]);
  const explorerLevel = useMemo(() => getExplorerLevel({ saved: savedQuestIds.length, reviews: Object.values(reviewsByQuest).reduce((n, list) => n + (list || []).length, 0), chainStops: questChains.reduce((n, chain) => n + chain.stops.length, 0), reveals: mysteryRevealCount, chatMessages: chatMessages.length }), [savedQuestIds, reviewsByQuest, questChains, mysteryRevealCount, chatMessages]);
  const [viewMode, setViewMode] = useState('map');
  const [mapSelectedId, setMapSelectedId] = useState(null);
  const [dailyPickIndex, setDailyPickIndex] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('sidequest-daily-pick') || 'null');
      const today = new Date().toLocaleDateString('en-CA');
      return stored?.date === today && Number.isInteger(stored.index) && stored.index >= 0 ? stored.index : 0;
    } catch { return 0; }
  });

  const cityOptions = useMemo(
    () => [...new Set(allEvents.map((event) => event.city).filter(Boolean))].sort(),
    [allEvents],
  );

  const localityOptions = useMemo(
    () => [...new Set(allEvents.filter((event) => event.city === selectedCity).map((event) => event.locality).filter(Boolean))].sort(),
    [allEvents, selectedCity],
  );

  const filterLocalityOptions = useMemo(
    () => [...new Set(allEvents.filter((event) => filters.city === 'all' || event.city === filters.city).map((event) => event.locality).filter(Boolean))].sort(),
    [allEvents, filters.city],
  );

  // Curated lists for Homepage
  const trendingEvents = useMemo(
    () => allEvents.slice(0, 6),
    [allEvents],
  );

  const techEvents = useMemo(
    () => allEvents.filter((e) => e.category === 'Technology').slice(0, 4),
    [allEvents],
  );

  const freeEvents = useMemo(
    () => allEvents.filter((e) => e.isFree || e.priceStarting === 0).slice(0, 4),
    [allEvents],
  );

  useEffect(() => {
    if (!detailRouteId) return undefined;
    let active = true;
    getEventById(decodeURIComponent(detailRouteId))
      .then((response) => {
        if (active) {
          setDetailEvent(response.event);
          setDetailRouteError('');
        }
      })
      .catch((loadError) => {
        if (active) setDetailRouteError(loadError.message || 'This quest could not be found.');
      });
    return () => { active = false; };
  }, [detailRouteId]);

  useEffect(() => {
    let active = true;
    getHealth()
      .then((health) => { if (active) setBackendHealth(health); })
      .catch(() => { if (active) setBackendHealth({ status: 'unavailable', database: 'unknown' }); });
    getCurrentUser()
      .then((response) => { if (active) setCurrentUser(response.user || null); })
      .catch(() => { if (active) setCurrentUser(null); })
      .finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (page !== 'bookings' || !currentUser) return;
    let active = true;
    setBookingsLoading(true);
    setBookingsError('');
    getMyRegistrations()
      .then((response) => { if (active) setMyBookings(response.bookings || []); })
      .catch((err) => { if (active) setBookingsError(err.message || 'Could not load your bookings.'); })
      .finally(() => { if (active) setBookingsLoading(false); });
    return () => { active = false; };
  }, [page, currentUser]);

  useEffect(() => {
    if (page !== 'safety' || !currentUser) return;
    let active = true;
    getMyReports()
      .then((response) => { if (active) setMyReports(response.reports || []); })
      .catch((err) => { if (active) setMyReportsError(err.message || 'Could not load reports.'); });
    return () => { active = false; };
  }, [page, currentUser]);

  useEffect(() => {
    async function loadAllEvents() {
      try {
        const response = await getEvents();
        setAllEvents(response.events || []);
      } catch (err) {
        console.error('Failed to load all events:', err);
      }
    }
    loadAllEvents();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('sidequest-saved', JSON.stringify(savedQuestIds));
    } catch (e) {
      console.warn('Could not save saved quests to localStorage', e);
    }
  }, [savedQuestIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem('sidequest-quest-chains', JSON.stringify(questChains));
    } catch (e) {
      console.warn('Could not save quest chains to localStorage', e);
    }
  }, [questChains]);

  useEffect(() => {
    try {
      if (activeChainId) {
        window.localStorage.setItem('sidequest-active-chain', activeChainId);
      } else {
        window.localStorage.removeItem('sidequest-active-chain');
      }
    } catch (e) {
      console.warn('Could not save active chain to localStorage', e);
    }
  }, [activeChainId]);

  useEffect(() => {
    async function loadEvents() {
      try {
        setLoading(true);
        const response = await getEvents({
          search: filters.search,
          category: filters.category === 'all' ? '' : filters.category,
          date: filters.date === 'all' ? '' : filters.date,
          city: filters.city === 'all' ? '' : filters.city,
          locality: filters.locality === 'all' ? '' : filters.locality,
        });
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
      const radians = (degrees) => (degrees * Math.PI) / 180;
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
    if (!navigator.geolocation) {
      setLocationStatus('Location is not supported by this browser. Choose a city and locality instead.');
      return;
    }
    setLocating(true);
    setLocationStatus('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationStatus('Location found. Nearby quests with coordinates are sorted by distance.');
        setLocating(false);
      },
      (geoError) => {
        const message = geoError.code === 1 ? 'Location permission was denied. You can still browse by city.' : 'Could not determine location.';
        setLocationStatus(message);
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const savedQuests = useMemo(
    () => allEvents.filter((event) => savedQuestIds.includes(event.id)),
    [allEvents, savedQuestIds],
  );

  const radarQuests = useMemo(
    () =>
      rankRadarQuests(allEvents, {
        ...radarFilters,
        interests: selectedInterests,
        userCoordinates,
        now: currentTime,
      }),
    [allEvents, radarFilters, selectedInterests, userCoordinates, currentTime],
  );

  const toggleInterest = (interest) => {
    setSelectedInterests((current) =>
      current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest],
    );
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => {
      if (name === 'city') return { ...current, city: value, locality: 'all' };
      return { ...current, [name]: value };
    });
  };

  const handleCitySelect = (city) => {
    setFilters((current) => ({ ...current, city, locality: 'all' }));
    setSelectedCity(city);
    const element = document.getElementById('quest-board');
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCategorySelect = (category) => {
    setFilters((current) => ({ ...current, category }));
    const element = document.getElementById('quest-board');
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleSavedQuest = (eventOrId) => {
    const targetId = typeof eventOrId === 'object' && eventOrId !== null ? eventOrId.id : eventOrId;
    if (!targetId) return;
    const isSaved = savedQuestIds.includes(targetId);
    setSavedQuestIds((current) => {
      if (isSaved) return current.filter((id) => id !== targetId);
      return [...current, targetId];
    });
    setToast(isSaved ? 'Quest removed from saved list.' : 'Quest saved to your journal! ★');
  };

  const submitSafetyReport = async (event) => {
    event.preventDefault();
    if (!currentUser) { window.location.assign('/login?next=%2Fsafety'); return; }
    if (!detailEvent) return;
    setReportBusy(true);
    setReportMessage('');
    try {
      const response = await submitReport({
        targetType: 'event',
        targetId: String(detailEvent.id),
        reason: reportDraft.reason,
        details: reportDraft.details,
      });
      setReportMessage(response.message || 'Report received.');
      setReportDraft({ reason: 'unsafe', details: '' });
    } catch (err) {
      setReportMessage(err.message || 'Could not submit report.');
    } finally {
      setReportBusy(false);
    }
  };

  const submitQuestReview = (event) => {
    event.preventDefault();
    if (!detailEvent) return;
    const validation = validateReviewDraft(reviewDraft.story);
    if (!validation.valid) { setReviewMessage(validation.message); return; }
    const entry = createLocalReview({ ...reviewDraft, author: currentUser?.name || 'Local Explorer' });
    setReviewsByQuest((current) => ({ ...current, [String(detailEvent.id)]: [entry, ...(current[String(detailEvent.id)] || [])] }));
    setReviewDraft({ rating: '5', story: '', tips: '' });
    setReviewMessage('Your field note has been added on this device.');
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
    if (!currentUser || currentUser.role !== 'organizer') {
      window.location.assign('/register?role=organizer&next=/publish');
      return;
    }
    setFormError('');
    setFormSuccess('');

    const effectiveOrganizerName = (formData.organizerName || currentUser?.name || '').trim();
    const payload = {
      ...formData,
      organizerName: effectiveOrganizerName,
      capacity: formData.capacity ? Number(formData.capacity) : undefined,
    };

    try {
      await createEvent(payload);
      setFormData({ ...defaultForm, organizerName: currentUser?.name || '' });
      const [refreshedEvents, refreshedAllEvents] = await Promise.all([
        getEvents(filters),
        getEvents(),
      ]);
      setEvents(refreshedEvents.events || []);
      setAllEvents(refreshedAllEvents.events || []);
      setFormSuccess('Quest published successfully. Adjust or clear your filters if it is not visible on the current board.');
    } catch (submitError) {
      setFormError(submitError.message || 'Unable to publish quest.');
    }
  };

  const handlePartyUp = async (event) => {
    const inviteUrl = new URL(`/quests/${encodeURIComponent(event.id)}`, window.location.origin).href;
    const inviteText = `Want to join me for ${event.title}?\n${formatEventDateTime(event)}\n${event.venue ? `${event.venue}, ` : ''}${event.city || ''}\nQuest details: ${inviteUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Party up for ${event.title}`, text: inviteText, url: inviteUrl });
        setToast('Invite ready to share.');
        return;
      }
      await navigator.clipboard.writeText(inviteText);
      setToast('Invite message copied. Send it to your crew!');
    } catch (shareError) {
      if (shareError?.name === 'AbortError') return;
      setPartyMessage(inviteText);
      setToast('Copy is unavailable here. Your invite is ready below to copy manually.');
    }
  };

  const handleRegister = async (eventId) => {
    if (authLoading) {
      setToast('Checking your account. Please try again in a moment.');
      return;
    }
    if (!currentUser) {
      const next = `/quests/${encodeURIComponent(eventId)}`;
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    try {
      setRegistering(true);
      const response = await registerForEvent(eventId);
      setToast(response.message || 'Registration confirmed.');
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
        <div className="topbar-brand-row">
          <BrandLogo variant="compact" tagline />
          <button
            type="button"
            className="mobile-menu-toggle"
            aria-expanded={mobileNavOpen}
            aria-controls="primary-nav"
            aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <span className="menu-icon" aria-hidden="true">{mobileNavOpen ? '✕' : '☰'}</span>
            <span className="menu-text">{mobileNavOpen ? 'Close' : 'Menu'}</span>
          </button>
        </div>

        <nav id="primary-nav" className={`nav ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          <div className="nav-links">
            <a href="/quests" aria-current={page === 'quests' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/quests')}><span className="nav-ico" aria-hidden="true">🧭</span>Quest Board</a>
            <a href="/nearby" aria-current={page === 'nearby' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/nearby')}><span className="nav-ico" aria-hidden="true">📍</span>Nearby</a>
            <a href="/radar" aria-current={page === 'radar' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/radar')}><span className="nav-ico" aria-hidden="true">📡</span>Radar</a>
            <a href="/recommended" aria-current={page === 'recommended' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/recommended')}><span className="nav-ico" aria-hidden="true">✨</span>For You</a>
            <a href="/saved" aria-current={page === 'saved' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/saved')}><span className="nav-ico" aria-hidden="true">🔖</span>Saved{savedQuestIds.length > 0 && <span className="nav-counter-badge">{savedQuestIds.length}</span>}</a>
            <a href="/bookings" aria-current={page === 'bookings' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/bookings')}><span className="nav-ico" aria-hidden="true">🎟️</span>Bookings</a>
            <div className="nav-more" ref={moreRef}>
              <button type="button" className={`nav-more-btn${['chains','publish','organizer','admin','safety','assistant'].includes(page) ? ' has-active' : ''}`} aria-expanded={moreOpen} aria-haspopup="true" onClick={() => setMoreOpen((o) => !o)}>More <span aria-hidden="true">▾</span></button>
              {moreOpen && (
                <div className="nav-more-menu" role="menu">
                  <a role="menuitem" href="/chains" aria-current={page === 'chains' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/chains')}>⛓️ Quest Chains</a>
                  <a role="menuitem" href="/publish" aria-current={page === 'publish' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/publish')}>📝 Publish a quest</a>
                  <a role="menuitem" href="/organizer" aria-current={page === 'organizer' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/organizer')}>🛠️ Organizer Hub</a>
                  {currentUser?.role === 'admin' && <a role="menuitem" href="/admin" aria-current={page === 'admin' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/admin')}>🛡️ Admin</a>}
                  <a role="menuitem" href="/assistant" aria-current={page === 'assistant' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/assistant')}>🤖 Adventure AI</a>
                  <a role="menuitem" href="/safety" aria-current={page === 'safety' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/safety')}>🧯 Safety</a>
                </div>
              )}
            </div>
          </div>

          <div className="nav-auth">
            <span
              className={`system-status ${backendHealth?.database === 'mongodb' ? 'is-connected' : 'is-demo'}`}
              title={backendHealth?.database === 'mongodb' ? 'Verified connection to MongoDB Atlas database' : 'Demo memory database'}
            >
              {backendHealth?.database === 'mongodb' ? '● MongoDB' : '● Demo'}
            </span>
            {currentUser ? <span className="nav-user">Hi, {currentUser.name.split(' ')[0]}</span> : null}
            {currentUser ? (
              <button type="button" className="nav-auth-btn" onClick={async () => { await logoutAccount().catch(() => {}); window.location.assign('/'); }}>Sign out</button>
            ) : (
              <>
                <a className="nav-signin" href="/login">Sign in</a>
                <a className="nav-register" href="/register">Join</a>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="page-shell">
        {page !== 'home' ? (
          <div className="route-heading">
            <span className="eyebrow">SIDEQUEST / {page.replace('-', ' ')}</span>
            <h1>
              {({
                quests: 'Find your next quest',
                nearby: 'Explore nearby',
                recommended: 'Picked for your interests',
                saved: 'Your saved quests',
                radar: 'Find a quest that fits your plans',
                chains: 'Build a mini-adventure',
                reminders: 'Never miss a saved quest',
                mystery: 'Let fate choose your next quest',
                achievements: 'Your adventure milestones',
                profile: 'Your explorer profile',
                chat: 'Coordinate with your party',
                calendar: 'Your quest calendar',
                levels: 'Your explorer journey',
                publish: 'Create a new quest',
                insights: 'Community field notes',
                organizer: 'Organizer dashboard',
                bookings: 'Your bookings & tickets',
                admin: 'Platform administration',
                safety: 'Trust, safety & reports',
                assistant: 'Your AI adventure guide',
                'quest-detail': 'Quest details',
              })[page] || 'Explore SIDEQUEST'}
            </h1>
            <p className="description">Discover and experience real events happening across India.</p>
          </div>
        ) : null}

        {page === 'quest-detail' && detailRouteError ? (
          <div className="message error-message">{detailRouteError} <a href="/quests">Return to the Quest Board</a></div>
        ) : null}

        {/* ==================== HOMEPAGE HERO & DISCOVERY ==================== */}
        {page === 'home' && (
          <>
            <section className="hero-section sq-hero" aria-labelledby="hero-title">
              <div className="hero-copy">
                <span className="eyebrow"><span className="eyebrow-dot" /> Verified India Event Discovery</span>
                <h1 id="hero-title">Your next adventure is <em>closer than you think.</em></h1>
                <p>
                  Discover verified technology summits, college fests, live concerts, standup shows, and skill workshops across Indian cities. Life is the main quest; these are the sidequests.
                </p>

                {/* Hero Search & Filter Row */}
                <form
                  className="hero-search-wrapper"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const el = document.getElementById('quest-board');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <div className="hero-search-input-group">
                    <span className="search-symbol" aria-hidden="true">🔍</span>
                    <input
                      type="text"
                      name="heroSearch"
                      value={filters.search}
                      onChange={(e) => setFilters((curr) => ({ ...curr, search: e.target.value }))}
                      placeholder="Search tech, concerts, college fests, or meetups…"
                      aria-label="Search quests across India"
                    />
                    {filters.search ? (
                      <button
                        type="button"
                        className="search-clear-btn"
                        aria-label="Clear search query"
                        onClick={() => setFilters((curr) => ({ ...curr, search: '' }))}
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>

                  <div className="hero-filter-select-group">
                    <select name="city" value={filters.city} onChange={handleFilterChange}>
                      <option value="all">🇮🇳 All Cities</option>
                      {cityOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>

                    <select name="category" value={filters.category} onChange={handleFilterChange}>
                      <option value="all">All Categories</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>

                    <button type="submit" className="primary-btn btn-sm">
                      Explore Quests
                    </button>
                  </div>
                </form>

                <div className="hero-actions" style={{ marginTop: '1.25rem' }}>
                  <a href="#quest-board" className="primary-btn">Explore Event Board</a>
                  <a href="/organizer" className="secondary-btn">Host an Event</a>
                  <a href="/nearby" className="secondary-btn">Nearby Quests</a>
                  <a href="/mystery" className="secondary-btn">Surprise me ↻</a>
                </div>
              </div>

              <div className="hero-panel sq-hero-stats" aria-label="Quest summary">
                <div className="stat-block"><strong>{allEvents.length || 0}</strong><span>Verified events</span></div>
                <div className="stat-block"><strong>{cityOptions.length || 12}</strong><span>Indian cities</span></div>
                <div className="stat-block"><strong>{savedQuestIds.length || 0}</strong><span>Saved quests</span></div>
              </div>
            </section>

            {/* City Discovery Grid */}
            <section className="city-discovery-section">
              <div className="city-discovery-heading">
                <span className="eyebrow">Explore India</span>
                <h2>Discover Events by City</h2>
              </div>
              <div className="city-grid">
                {INDIA_CITIES.map((city) => (
                  <div
                    key={city.name}
                    className={`city-tile ${filters.city === city.name ? 'is-active' : ''}`}
                    onClick={() => handleCitySelect(city.name)}
                  >
                    <span className="city-icon">{city.icon}</span>
                    <span className="city-name">{city.name}</span>
                    <span className="city-count">{city.tag}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Trending Across India Section */}
            <section className="curated-section">
              <div className="curated-header">
                <div>
                  <span className="eyebrow">Hot & Happening</span>
                  <h3>🔥 Trending Across India</h3>
                </div>
                <a href="#quest-board" className="secondary-btn btn-sm">See All Events</a>
              </div>
              <div className="card-grid">
                {trendingEvents.map((evt) => (
                  <article key={`trend-${evt.id}`} className="curated-event-card">
                    <div className="card-visual">
                      {evt.imageUrl && (
                        <img className="event-cover-image" src={evt.imageUrl} alt={evt.title} loading="lazy" />
                      )}
                      <span className={`card-price-pill ${evt.isFree || evt.priceStarting === 0 ? 'is-free' : ''}`}>
                        {evt.isFree || evt.priceStarting === 0 ? 'FREE' : `FROM ₹${evt.priceStarting}`}
                      </span>
                    </div>
                    <div className="card-topline">
                      <span className="pill accent">{evt.category}</span>
                      <span className="verified-source-tag">✓ Verified</span>
                    </div>
                    <h3>{evt.title}</h3>
                    <p className="description">{evt.description}</p>
                    <ul className="meta-list">
                      <li>📅 {formatEventDateTime(evt)}</li>
                      <li>📍 {evt.venue}, {evt.city}</li>
                    </ul>
                    <div className="card-actions">
                      <button type="button" className="secondary-btn" onClick={() => setDetailEvent(evt)}>Details</button>
                      <button type="button" className="primary-btn" onClick={() => setCheckoutEvent(evt)}>
                        {evt.isFree || evt.priceStarting === 0 ? 'RSVP Free' : 'Book Tickets'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* Tech Summits & Hackathons */}
            <section className="curated-section">
              <div className="curated-header">
                <div>
                  <span className="eyebrow">Builders & Developers</span>
                  <h3>💻 Tech Summits & Hackathons</h3>
                </div>
                <button type="button" className="secondary-btn btn-sm" onClick={() => handleCategorySelect('Technology')}>Browse Tech</button>
              </div>
              <div className="card-grid">
                {techEvents.map((evt) => (
                  <article key={`tech-${evt.id}`} className="curated-event-card">
                    <div className="card-visual">
                      {evt.imageUrl && <img className="event-cover-image" src={evt.imageUrl} alt={evt.title} loading="lazy" />}
                      <span className="card-price-pill">{evt.isFree || evt.priceStarting === 0 ? 'FREE' : `FROM ₹${evt.priceStarting}`}</span>
                    </div>
                    <div className="card-topline"><span className="pill accent">{evt.category}</span></div>
                    <h3>{evt.title}</h3>
                    <p className="description">{evt.description}</p>
                    <ul className="meta-list">
                      <li>📅 {formatEventDateTime(evt)}</li>
                      <li>📍 {evt.venue}, {evt.city}</li>
                    </ul>
                    <div className="card-actions">
                      <button type="button" className="secondary-btn" onClick={() => setDetailEvent(evt)}>Details</button>
                      <button type="button" className="primary-btn" onClick={() => setCheckoutEvent(evt)}>Get Tickets</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* Free Events & Open Meetups */}
            <section className="curated-section">
              <div className="curated-header">
                <div>
                  <span className="eyebrow">Zero Entry Fee</span>
                  <h3>🎟️ Free Events & Open Meetups</h3>
                </div>
              </div>
              <div className="card-grid">
                {freeEvents.map((evt) => (
                  <article key={`free-${evt.id}`} className="curated-event-card">
                    <div className="card-visual">
                      {evt.imageUrl && <img className="event-cover-image" src={evt.imageUrl} alt={evt.title} loading="lazy" />}
                      <span className="card-price-pill is-free">FREE</span>
                    </div>
                    <div className="card-topline"><span className="pill accent">{evt.category}</span></div>
                    <h3>{evt.title}</h3>
                    <p className="description">{evt.description}</p>
                    <ul className="meta-list">
                      <li>📅 {formatEventDateTime(evt)}</li>
                      <li>📍 {evt.venue}, {evt.city}</li>
                    </ul>
                    <div className="card-actions">
                      <button type="button" className="secondary-btn" onClick={() => setDetailEvent(evt)}>Details</button>
                      <button type="button" className="primary-btn" onClick={() => setCheckoutEvent(evt)}>RSVP Free</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ==================== QUEST BOARD (HOME & QUESTS) ==================== */}
        {(page === 'home' || page === 'quests') && (
          <section id="quest-board" className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Event Discovery</span>
                <h2>Verified Experiences Across India</h2>
                <p className="small-copy">Browse genuine public events, summits, concerts, and workshops.</p>
              </div>
              <button type="button" className="ghost-btn" onClick={clearFilters}>Clear filters</button>
            </div>

            <div className="quest-trail-picker" aria-label="Quick quest category filters">
              <button
                type="button"
                className={filters.category === 'all' ? 'trail-chip active' : 'trail-chip'}
                onClick={() => setFilters((current) => ({ ...current, category: 'all' }))}
              >
                ✦ All quests
              </button>
              {['Technology', 'College festivals', 'Music', 'Sports', 'Art and culture', 'Gaming'].map((category) => (
                <button
                  key={category}
                  type="button"
                  className={filters.category === category ? 'trail-chip active' : 'trail-chip'}
                  onClick={() => setFilters((current) => ({ ...current, category }))}
                >
                  {categorySymbol(category)} {category}
                </button>
              ))}
            </div>

            <div className="filter-grid">
              <label>
                <span>Search</span>
                <div className="board-search-input-wrap">
                  <input
                    type="text"
                    name="search"
                    value={filters.search}
                    onChange={handleFilterChange}
                    placeholder="Try summits, hackathons, concerts, comedy…"
                  />
                  {filters.search ? (
                    <button
                      type="button"
                      className="search-clear-btn"
                      aria-label="Clear search input"
                      onClick={() => setFilters((current) => ({ ...current, search: '' }))}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
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

            <div className="board-toolbar">
              <div className="view-toggle" role="group" aria-label="Choose how to view quests">
                <button type="button" aria-pressed={viewMode === 'map'} onClick={() => setViewMode('map')}>Map</button>
                <button type="button" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}>List</button>
              </div>
              <span className="board-count" aria-live="polite">
                {loading ? 'Loading quests…' : `${events.length} quest${events.length === 1 ? '' : 's'} ${viewMode === 'map' ? 'on the map' : 'in the list'}`}
              </span>
            </div>

            {viewMode === 'map' ? (
              <WorldMap
                events={events}
                allEvents={allEvents}
                loading={loading}
                selectedId={mapSelectedId}
                onSelect={(item) => setMapSelectedId(item ? item.id : null)}
                savedIds={savedQuestIds}
                onToggleSave={toggleSavedQuest}
                onClearFilters={clearFilters}
                hasActiveFilters={filters.search !== '' || filters.category !== 'all' || filters.date !== 'all' || filters.city !== 'all' || filters.locality !== 'all'}
              />
            ) : loading ? (
              <div className="loading-box">Loading quests across India...</div>
            ) : events.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon" aria-hidden="true">🧭</span>
                <h3>No matching quests found</h3>
                <p>{emptyStateMessage}</p>
                <button type="button" className="primary-btn btn-sm" onClick={clearFilters}>
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="card-grid">
                {events.map((event) => (
                  <article key={event.id} className="event-card">
                    <div className={`card-visual visual-${categoryOptions.indexOf(event.category) < 0 ? 0 : categoryOptions.indexOf(event.category) % 6}`}>
                      {savedQuestIds.includes(event.id) && (
                        <span className="card-saved-indicator" title="Saved to your journal">★ Saved</span>
                      )}
                      {event.imageUrl ? (
                        <img
                          className="event-cover-image"
                          src={event.imageUrl}
                          alt={`${event.title} cover`}
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : null}
                      <span className="visual-symbol" aria-hidden="true">{categorySymbol(event.category)}</span>
                      <span className="visual-caption">VERIFIED LISTING</span>
                      <span className="visual-stamp">{event.category}</span>
                      <span className={`card-price-pill ${event.isFree || event.priceStarting === 0 ? 'is-free' : ''}`}>
                        {event.isFree || event.priceStarting === 0 ? 'FREE' : `FROM ₹${(event.priceStarting || 0).toLocaleString('en-IN')}`}
                      </span>
                    </div>

                    <div className="card-topline">
                      <span className="pill accent">{event.category}</span>
                      {event.source?.verifiedDate ? (
                        <span className="verified-source-tag">✓ Verified Source</span>
                      ) : event.isSampleData ? (
                        <span className="pill muted">Development data</span>
                      ) : null}
                    </div>

                    <h3>{event.title}</h3>
                    <p className="description">{event.description}</p>

                    <ul className="meta-list">
                      <li>📅 {formatEventDateTime(event)}</li>
                      <li>📍 {event.venue}, {event.city}</li>
                      <li>🏢 Hosted by {event.organizerName}</li>
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
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => {
                          if (!currentUser) {
                            window.location.assign(`/login?next=/quests/${encodeURIComponent(event.id)}`);
                          } else {
                            setCheckoutEvent(event);
                          }
                        }}
                      >
                        {event.isFree || event.priceStarting === 0 ? 'RSVP Free' : 'Book Tickets'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ==================== MY BOOKINGS & TICKETS ==================== */}
        {page === 'bookings' && (
          <MyTickets
            currentUser={currentUser}
            authLoading={authLoading}
            onExploreClick={() => {
              clearFilters();
              window.location.assign('/quests');
            }}
          />
        )}

        {/* ==================== ORGANIZER HUB ==================== */}
        {page === 'organizer' && (
          <OrganizerPortal
            currentUser={currentUser}
            initialEvents={allEvents}
            onEventCreated={() => {
              getEvents().then((r) => setAllEvents(r.events || []));
            }}
          />
        )}

        {/* ==================== ADMIN PORTAL ==================== */}
        {page === 'admin' && <AdminPortal currentUser={currentUser} />}

        {/* ==================== RECOMMENDATIONS ==================== */}
        {(page === 'home' || page === 'recommended') && (
          <section id="recommended" className="panel recommendation-panel">
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
                <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
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

            {recommendations.length > 0 && (() => {
              const dailyQuest = recommendations[dailyPickIndex % recommendations.length];
              return (
                <article className="daily-quest-card" aria-labelledby="daily-quest-title">
                  <div className="daily-quest-art" aria-hidden="true"><span>✦</span><small>YOUR DAILY<br />SIDEQUEST</small></div>
                  <div className="daily-quest-copy">
                    <div className="daily-quest-topline"><span className="eyebrow">✧ Today's pick</span><span className="daily-pick-note">Picked for your interests and plans</span><span className="pill accent">{dailyQuest.category || 'Community quest'}</span></div>
                    <h3 id="daily-quest-title">{dailyQuest.title}</h3>
                    <p className="small-copy">{dailyQuest.city}{dailyQuest.locality ? ` · ${dailyQuest.locality}` : ''}{dailyQuest.date ? ` · ${formatDate(dailyQuest.date)}` : ''}{dailyQuest.startTime ? ` at ${dailyQuest.startTime}` : ''}</p>
                    <p className="daily-quest-reason">{(dailyQuest.reasons || []).slice(0, 2).join(' ') || 'A new opportunity to get out, explore, and make a story of your own.'}</p>
                    <div className="daily-quest-actions">
                      <button type="button" className="primary-btn" onClick={() => setDetailEvent(dailyQuest)}>Explore this quest</button>
                      <button type="button" className="save-btn" onClick={() => toggleSavedQuest(dailyQuest)}>{savedQuestIds.includes(dailyQuest.id) ? '✓ Saved' : '＋ Save for later'}</button>
                      {recommendations.length > 1 && <button type="button" className="secondary-btn" onClick={() => setDailyPickIndex((index) => (index + 1) % recommendations.length)}>Surprise me ↻</button>}
                    </div>
                  </div>
                </article>
              );
            })()}

            <div className="recommendation-list">
              {smartRecommendations.length === 0 ? (
                <div className="empty-state compact"><strong>Your next quest is still out there.</strong><br />No upcoming quests match these preferences right now. Try another interest or locality.</div>
              ) : (
                smartRecommendations.map((event) => (
                  <div key={event.id} className="recommendation-item">
                    <div>
                      <button type="button" className="recommendation-link" onClick={() => setDetailEvent(event)}>{event.title}</button>
                      <p className="small-copy">{event.city} • {event.locality}</p>
                    </div>
                    <div className="score-wrap">
                      <span className="score-badge">{event.recommendationScore ?? event.score ?? '★'}</span>
                      <ul>
                        {(event.recommendationReasons || event.reasons || []).map((reason, index) => (
                          <li key={`${event.id}-${index}`}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* ==================== RADAR ==================== */}
        {page === 'radar' && (
          <section id="quest-radar" className="panel radar-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Feature 06 / Quest Radar</span>
                <h2>Find a quest that fits your plans.</h2>
                <p className="small-copy">Tune the time, category, and area. SIDEQUEST ranks the events that best fit your selected interests.</p>
              </div>
              <span className="radar-emblem" aria-hidden="true">⌁<i>✦</i></span>
            </div>
            <div className="radar-interest-row">
              <span className="radar-label">Your current interests</span>
              <div className="interest-picker">
                {interestOptions.map((interest) => <button key={interest} type="button" className={selectedInterests.includes(interest) ? 'interest-chip active' : 'interest-chip'} onClick={() => toggleInterest(interest)}>{interest}</button>)}
              </div>
            </div>
            <div className="radar-filters">
              <label><span>When are you free?</span><select value={radarFilters.timeframe} onChange={(event) => setRadarFilters((current) => ({ ...current, timeframe: event.target.value }))}><option value="any">Any upcoming time</option><option value="today">Today</option><option value="weekend">This weekend</option><option value="next7days">Next 7 days</option></select></label>
              <label><span>Quest type</span><select value={radarFilters.category} onChange={(event) => setRadarFilters((current) => ({ ...current, category: event.target.value }))}><option value="all">All categories</option>{categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
              <label><span>City</span><select value={radarFilters.city} onChange={(event) => setRadarFilters((current) => ({ ...current, city: event.target.value, locality: 'all' }))}><option value="all">All cities</option>{cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
              <label><span>Locality</span><select value={radarFilters.locality} onChange={(event) => setRadarFilters((current) => ({ ...current, locality: event.target.value }))}><option value="all">All localities</option>{[...new Set(allEvents.filter((event) => radarFilters.city === 'all' || event.city === radarFilters.city).map((event) => event.locality).filter(Boolean))].sort().map((locality) => <option key={locality} value={locality}>{locality}</option>)}</select></label>
              <label><span>Sort by</span><select value={radarFilters.sort} onChange={(event) => setRadarFilters((current) => ({ ...current, sort: event.target.value }))}><option value="match">Best match for me</option><option value="soonest">Starting soonest</option><option value="nearest" disabled={!userCoordinates}>Nearest to me (enable location)</option></select></label>
              <label><span>Within distance</span><select value={radarFilters.radiusKm} disabled={!userCoordinates} onChange={(event) => setRadarFilters((current) => ({ ...current, radiusKm: event.target.value }))}><option value="any">Any distance</option><option value="5">5 km</option><option value="10">10 km</option><option value="25">25 km</option><option value="50">50 km</option></select></label>
            </div>
            <div className="radar-toolbar">
              <div><strong>{radarQuests.length}</strong> quest{radarQuests.length === 1 ? '' : 's'} found<span className="helper-text"> {userCoordinates ? 'Using your browser location for distance-based matching.' : 'Choose “Use my location” to enable distance filters.'}</span></div>
              <div className="radar-actions">
                <button type="button" className="secondary-btn" onClick={requestUserLocation} disabled={locating}>{locating ? 'Finding location…' : userCoordinates ? 'Refresh location' : 'Use my location'}</button>
                <button type="button" className="ghost-btn" onClick={() => setRadarFilters({ timeframe: 'next7days', category: 'all', city: 'all', locality: 'all', radiusKm: '25', sort: 'match' })}>Reset radar</button>
              </div>
            </div>
            {locationStatus ? <p className="message compact" role="status">{locationStatus}</p> : null}
            <div className="radar-results">
              {radarQuests.length === 0 ? (
                <div className="empty-state radar-empty-state">
                  <span className="empty-icon" aria-hidden="true">📡</span>
                  <h3>No quests found in this radar sweep</h3>
                  <p className="small-copy">
                    No upcoming events match your selected timeframe, category, or area. Try expanding your filters or clearing them to explore all events across India.
                  </p>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => setRadarFilters({ timeframe: 'any', category: 'all', city: 'all', locality: 'all', radiusKm: 'any', sort: 'match' })}
                  >
                    Clear Radar Filters
                  </button>
                </div>
              ) : (
                radarQuests.map((quest) => {
                  const eventObj = quest.event || quest;
                  const eventId = eventObj.id || quest.id;
                  const isSaved = savedQuestIds.includes(eventId);
                  return (
                    <article key={eventId} className="radar-card">
                      <div className="radar-card-main">
                        <div className="radar-card-header">
                          <span className="pill accent">{eventObj.category}</span>
                          {quest.matchLabel && <span className="pill match-pill">✦ {quest.matchLabel}</span>}
                          {quest.distanceKm !== null && quest.distanceKm !== undefined && (
                            <span className="distance-badge">{quest.distanceKm.toFixed(1)} km away</span>
                          )}
                        </div>
                        <h3>{eventObj.title}</h3>
                        <p className="description">{eventObj.description}</p>

                        {quest.reasons?.length ? (
                          <div className="radar-reasons">
                            {quest.reasons.map((reason, idx) => (
                              <span key={idx} className="radar-reason-tag">
                                ✓ {reason}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <ul className="meta-list">
                          <li>📅 {formatEventDateTime(eventObj)}</li>
                          <li>📍 {eventObj.venue}, {eventObj.city}</li>
                          <li>🎟️ {eventObj.isFree ? 'Free Admission' : `From ₹${eventObj.priceStarting || 0}`}</li>
                        </ul>
                      </div>
                      <div className="radar-card-actions">
                        <button
                          type="button"
                          className={`save-btn ${isSaved ? 'is-saved' : ''}`}
                          onClick={() => toggleSavedQuest(eventId)}
                          aria-label={isSaved ? 'Remove from saved' : 'Save quest'}
                        >
                          {isSaved ? '★ Saved' : '☆ Save'}
                        </button>
                        <button type="button" className="secondary-btn" onClick={() => setDetailEvent(eventObj)}>Details</button>
                        <button type="button" className="primary-btn" onClick={() => setCheckoutEvent(eventObj)}>Get Tickets</button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* ==================== SAVED QUESTS ==================== */}
        {page === 'saved' && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Saved Quests</span>
                <h2>Quests You Bookmarked</h2>
              </div>
            </div>

            {savedQuests.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon" aria-hidden="true">★</span>
                <h3>No saved quests yet</h3>
                <p>Bookmark interesting events and experiences across India to plan your journey and keep track of upcoming dates.</p>
                <a href="/quests" className="primary-btn btn-sm" onClick={(e) => handleNavLink(e, '/quests')}>
                  Discover Quests
                </a>
              </div>
            ) : (
              <div className="card-grid">
                {savedQuests.map((event) => (
                  <article key={event.id} className="saved-card event-card">
                    <div className="card-topline">
                      <span className="pill accent">{event.category}</span>
                    </div>
                    <h3>{event.title}</h3>
                    <p className="description">{event.description}</p>
                    <ul className="meta-list">
                      <li>{formatEventDateTime(event)}</li>
                      <li>{event.venue}, {event.city}</li>
                    </ul>
                    <div className="card-actions">
                      <button type="button" className="ghost-btn" onClick={() => toggleSavedQuest(event)}>Remove</button>
                      <button type="button" className="secondary-btn" onClick={() => setDetailEvent(event)}>Details</button>
                      <button type="button" className="primary-btn" onClick={() => setCheckoutEvent(event)}>Get Tickets</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ==================== QUEST CHAINS ==================== */}
        {page === 'chains' && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Feature 08 / Quest Chains</span>
                <h2>Build a mini-adventure itinerary</h2>
                <p className="description">Chain multiple stops together into an outing.</p>
              </div>
            </div>

            <form
              className="chain-create-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newChainTitle.trim()) return;
                const newChain = createQuestChain(newChainTitle.trim());
                setQuestChains([...questChains, newChain]);
                setActiveChainId(newChain.id);
                setNewChainTitle('');
              }}
            >
              <input
                aria-label="Quest Chain name"
                type="text"
                placeholder="Name your Quest Chain (e.g. Saturday in Bengaluru)"
                value={newChainTitle}
                onChange={(e) => setNewChainTitle(e.target.value)}
              />
              <button type="submit" className="primary-btn">Create Quest Chain</button>
            </form>

            <div className="chains-list" style={{ marginTop: '1.5rem' }}>
              {questChains.map((chain) => (
                <div key={chain.id} className={`chain-card ${chain.id === activeChainId ? 'active' : ''}`}>
                  <h3>{chain.title}</h3>
                  <ol className="chain-stops">
                    {chain.stops.map((stop, index) => (
                      <li key={`${chain.id}-${stop.eventId}`} className="chain-stop">
                        <span>{index + 1}. {stop.title} ({stop.city})</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ==================== SAFETY & REPORTS ==================== */}
        {page === 'safety' && (
          <section className="panel safety-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Trust & Safety</span>
                <h2>Community Trust & Platform Safety</h2>
                <p className="description">Report misleading listings, unsafe events, spam, harassment, or inappropriate content.</p>
              </div>
            </div>

            {!currentUser ? (
              <div className="auth-gate">
                <h3>Sign in to report a concern</h3>
                <a className="primary-btn" href="/login?next=/safety">Sign in</a>
              </div>
            ) : (
              <>
                <h3>Your submitted reports</h3>
                {myReportsError && <p className="message error-message">{myReportsError}</p>}
                {myReports.length ? (
                  <div className="report-list">
                    {myReports.map((report) => (
                      <article className="review-card" key={report.id}>
                        <div className="review-meta">
                          <strong>{report.targetLabel}</strong>
                          <span className="pill muted">{report.status}</span>
                        </div>
                        <p>{report.reason}</p>
                        <time>{new Date(report.createdAt).toLocaleDateString('en-IN')}</time>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="helper-text">You have not submitted any reports yet. You can report an event directly from its detail view.</p>
                )}
              </>
            )}
          </section>
        )}

        {/* ==================== PUBLISH QUEST ==================== */}
        {(page === 'publish') && (
          authLoading ? (
            <section id="publish" className="panel"><div className="loading-box">Checking account…</div></section>
          ) : currentUser?.role === 'organizer' || currentUser?.role === 'admin' ? (
            <section id="publish" className="panel form-panel">
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
                    <input
                      required
                      maxLength="120"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Sunset yoga social"
                    />
                  </label>

                  <label>
                    <span>Category</span>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </label>

                  <label className="full-width">
                    <span>Description</span>
                    <textarea
                      required
                      maxLength="2000"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Tell people what to expect and why they should join."
                      rows="4"
                    />
                  </label>

                  <label>
                    <span>Interests</span>
                    <input
                      value={formData.interests}
                      onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
                      placeholder="Music, Community activities"
                    />
                  </label>

                  <label>
                    <span>Date</span>
                    <input
                      required
                      min={todayDateString}
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </label>

                  <label>
                    <span>Start time</span>
                    <input
                      required
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    />
                  </label>

                  <label>
                    <span>City</span>
                    <input
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Bengaluru"
                    />
                  </label>

                  <label>
                    <span>Locality</span>
                    <input
                      required
                      value={formData.locality}
                      onChange={(e) => setFormData({ ...formData, locality: e.target.value })}
                      placeholder="Koramangala"
                    />
                  </label>

                  <label>
                    <span>Venue</span>
                    <input
                      required
                      value={formData.venue}
                      onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                      placeholder="Riverside Lawn"
                    />
                  </label>

                  <label>
                    <span>Organiser</span>
                    <input required value={currentUser?.name || formData.organizerName} readOnly />
                  </label>

                  <label>
                    <span>Capacity</span>
                    <input
                      type="number"
                      min="1"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      placeholder="Optional capacity"
                    />
                  </label>

                  <label>
                    <span>Registration URL</span>
                    <input
                      type="url"
                      value={formData.registrationUrl}
                      onChange={(e) => setFormData({ ...formData, registrationUrl: e.target.value })}
                      placeholder="https://example.com/register"
                    />
                  </label>

                  <label className="full-width">
                    <span>Event image URL (optional)</span>
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="https://images.unsplash.com/..."
                    />
                  </label>
                </div>

                {formError && <div className="message error-message">{formError}</div>}
                {formSuccess && <div className="message success-message">{formSuccess}</div>}

                <div className="submit-row" style={{ marginTop: '1.2rem' }}>
                  <button type="submit" className="primary-btn">Publish quest</button>
                </div>
              </form>
            </section>
          ) : (
            <section id="publish" className="panel auth-gate">
              <span className="eyebrow">Organizer access</span>
              <h2>Every great quest needs a guide.</h2>
              <p className="description">Sign in with an organizer account to publish events.</p>
              <div className="hero-actions">
                <a className="primary-btn" href="/register?role=organizer&next=/publish">Create organizer account</a>
                <a className="secondary-btn" href="/login?next=/publish">Sign in</a>
              </div>
            </section>
          )
        )}
      </main>

      {/* FOOTER */}
      <Footer
        onCityClick={handleCitySelect}
        onCategoryClick={handleCategorySelect}
      />

      {/* MOBILE BOTTOM NAVIGATION */}
      <MobileBottomNav
        currentPage={page}
        currentUser={currentUser}
        savedCount={savedQuestIds.length}
      />

      {/* EVENT DETAILS MODAL */}
      {detailEvent ? (
        <div className="modal-backdrop" onClick={() => { setDetailEvent(null); if (page === 'quest-detail') window.location.assign('/quests'); }}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="quest-dialog-title" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="close-button"
              aria-label="Close quest details"
              onClick={() => { setDetailEvent(null); if (page === 'quest-detail') window.location.assign('/quests'); }}
            >
              ×
            </button>

            <div className="modal-header">
              <span className="pill accent">{detailEvent.category}</span>
              {detailEvent.isFree || detailEvent.priceStarting === 0 ? (
                <span className="badge tag-green">FREE ENTRY</span>
              ) : (
                <span className="badge tag-muted">FROM ₹{detailEvent.priceStarting}</span>
              )}
            </div>

            <h3 id="quest-dialog-title">{detailEvent.title}</h3>
            <p className="description">{detailEvent.description}</p>

            <ul className="meta-list detail-list">
              <li><strong>Date & Time:</strong> {formatEventDateTime(detailEvent)}</li>
              <li><strong>Venue:</strong> {detailEvent.venue}, {detailEvent.city}</li>
              <li>
                <strong>Directions:</strong>{' '}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    detailEvent.latitude != null && detailEvent.longitude != null
                      ? `${detailEvent.latitude},${detailEvent.longitude}`
                      : `${detailEvent.venue}, ${detailEvent.city}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Google Maps ↗
                </a>
              </li>
              <li><strong>Organiser:</strong> {detailEvent.organizerName}</li>
              <li><strong>Policy:</strong> {detailEvent.cancellationPolicy || 'Standard cancellation policy applies.'}</li>
              {detailEvent.source?.url && (
                <li>
                  <strong>Verified Source:</strong>{' '}
                  <a href={detailEvent.source.url} target="_blank" rel="noreferrer">
                    {detailEvent.source.name || 'Official Announcement'} ↗
                  </a>
                </li>
              )}
            </ul>

            {/* Inline Reporting Form */}
            <section className="safety-report-inline" aria-labelledby="report-event-heading">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Trust & Safety</span>
                  <h4 id="report-event-heading">Report this event</h4>
                </div>
              </div>
              <form className="review-form" onSubmit={submitSafetyReport}>
                <label>
                  Reason
                  <select value={reportDraft.reason} onChange={(e) => setReportDraft({ ...reportDraft, reason: e.target.value })}>
                    <option value="unsafe">Safety concern</option>
                    <option value="misleading">Misleading information</option>
                    <option value="spam">Spam or scam</option>
                    <option value="harassment">Harassment</option>
                    <option value="inappropriate">Inappropriate content</option>
                    <option value="other">Other concern</option>
                  </select>
                </label>
                <label>
                  Details (optional)
                  <textarea
                    rows="2"
                    maxLength={1000}
                    value={reportDraft.details}
                    onChange={(e) => setReportDraft({ ...reportDraft, details: e.target.value })}
                    placeholder="Add factual context."
                  />
                </label>
                <button className="secondary-btn" type="submit" disabled={reportBusy}>
                  {reportBusy ? 'Submitting…' : 'Report this event'}
                </button>
                {reportMessage && <p className="helper-text" role="status">{reportMessage}</p>}
              </form>
            </section>

            <div className="card-actions modal-actions" style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                className="secondary-btn chain-add-btn"
                onClick={() => {
                  if (questChains.length === 0) {
                    setToast('Create a Quest Chain first on the Chains page.');
                    return;
                  }
                  const active = questChains.find((c) => c.id === activeChainId) || questChains[0];
                  setQuestChains((current) => current.map((c) => c.id === active.id ? addEventToChain(c, detailEvent) : c));
                  setToast(`Added "${detailEvent.title}" to "${active.title}".`);
                }}
              >
                ↗ Add to chain
              </button>

              <button
                type="button"
                className={savedQuestIds.includes(detailEvent.id) ? 'save-btn active' : 'save-btn'}
                onClick={() => toggleSavedQuest(detailEvent)}
              >
                {savedQuestIds.includes(detailEvent.id) ? 'Saved' : 'Save quest'}
              </button>

              {/* RSVP free button for test suite compatibility */}
              <button
                type="button"
                className="primary-btn"
                disabled={registering || authLoading}
                onClick={() => handleRegister(detailEvent.id)}
              >
                {registering ? 'Joining…' : 'Join this quest'}
              </button>

              {/* Direct Booking / Ticketing Modal trigger */}
              <button
                type="button"
                className="primary-btn"
                style={{ background: '#16a34a' }}
                onClick={() => {
                  if (!currentUser) {
                    window.location.assign(`/login?next=/quests/${encodeURIComponent(detailEvent.id)}`);
                  } else {
                    const evt = detailEvent;
                    setDetailEvent(null);
                    setCheckoutEvent(evt);
                  }
                }}
              >
                🎟️ Book Passes
              </button>

              <button
                type="button"
                className="secondary-btn"
                onClick={() => { setDetailEvent(null); if (page === 'quest-detail') window.location.assign('/quests'); }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* CHECKOUT & TICKETING MODAL */}
      {checkoutEvent && (
        <CheckoutModal
          event={checkoutEvent}
          currentUser={currentUser}
          onClose={() => setCheckoutEvent(null)}
          onBookingSuccess={() => {
            setToast('Booking confirmed! Check My Bookings for your digital QR ticket.');
          }}
        />
      )}

      {/* TOAST NOTIFICATION */}
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
