import { useEffect, useMemo, useState } from 'react';
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
import AuthGate from './components/AuthGate';
import ExplorerOnboardingModal from './components/ExplorerOnboardingModal';
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavLink = (e, path) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    e.preventDefault();
    navigateTo(path);
  };

  const handleSectionScroll = (sectionId) => {
    if (currentPath !== '/') {
      navigateTo('/');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } else {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileNavOpen(false);
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
        '/privacy': 'privacy',
        '/terms': 'terms',
        '/help': 'help',
        '/onboarding': 'onboarding',
        '/about': 'about',
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
  const [checkoutEvent, setCheckoutEvent] = useState(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

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
  const [reminderNow] = useState(() => Date.now());
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
  const [questChains, setQuestChains] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('sidequest-quest-chains') || '[]');
      return Array.isArray(stored) ? stored.filter((chain) => chain && typeof chain.id === 'string' && typeof chain.title === 'string' && Array.isArray(chain.stops)) : [];
    } catch { return []; }
  });
  const [activeChainId, setActiveChainId] = useState(() => {
    try { return window.localStorage.getItem('sidequest-active-chain') || ''; } catch { return ''; }
  });

  const achievementStats = useMemo(() => ({ savedCount: savedQuestIds.length, chainCount: questChains.length, chainStops: questChains.reduce((total, chain) => total + chain.stops.length, 0), mysteryRevealCount }), [savedQuestIds, questChains, mysteryRevealCount]);
  const achievements = useMemo(() => getAchievements(achievementStats), [achievementStats]);
  const [newChainTitle, setNewChainTitle] = useState('');
  const [toast, setToast] = useState('');
  const smartRecommendations = useMemo(() => rankSmartRecommendations(recommendations.length ? recommendations : allEvents, { interests: selectedInterests, savedIds: savedQuestIds, city: selectedCity, locality: selectedLocality, userCoordinates, now: currentTime }), [recommendations, allEvents, selectedInterests, savedQuestIds, selectedCity, selectedLocality, userCoordinates, currentTime]);
  const explorerLevel = useMemo(() => getExplorerLevel({ saved: savedQuestIds.length, reviews: Object.values(reviewsByQuest).reduce((n, list) => n + (list || []).length, 0), chainStops: questChains.reduce((n, chain) => n + chain.stops.length, 0), reveals: mysteryRevealCount, chatMessages: chatMessages.length }), [savedQuestIds, reviewsByQuest, questChains, mysteryRevealCount, chatMessages]);
  const [viewMode, setViewMode] = useState(page === 'quests' ? 'list' : 'map');
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

  const reminderItems = useMemo(() => {
    const leadMs = reminderLeadMinutes * 60 * 1000;
    const now = reminderNow;
    const upcoming = allEvents
      .filter((event) => savedQuestIds.some((id) => String(id) === String(event.id)))
      .map((event) => {
        let start = 0;
        if (event.date) {
          const dateStr = String(event.date).trim();
          const timeStr = event.startTime ? String(event.startTime).trim() : '23:59';
          const parsed = new Date(`${dateStr}T${timeStr}:00`);
          start = Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
        }
        return { event, start };
      })
      .filter((item) => item.start >= now)
      .sort((a, b) => a.start - b.start);
    return upcoming.map((item) => ({
      ...item,
      reminderAt: item.start - leadMs,
      status: now >= item.start - leadMs ? 'due' : 'scheduled',
      minutesUntil: Math.max(0, Math.round((item.start - now) / 60000)),
    }));
  }, [allEvents, savedQuestIds, reminderLeadMinutes, reminderNow]);

  const enableQuestReminders = async () => {
    if (!('Notification' in window)) {
      setReminderStatus('This browser does not support notifications. Upcoming reminders remain visible here.');
      return;
    }
    if (!savedQuestIds.length) {
      setReminderStatus('Save at least one quest first, then enable reminders for it.');
      return;
    }
    if (Notification.permission === 'denied') {
      setReminderStatus('Notifications are blocked by this browser. Change site permissions in your browser settings to enable them.');
      return;
    }
    try {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') {
        setReminderStatus('Notification permission was not granted. You can still view upcoming saved quests here.');
        return;
      }
      setRemindersEnabled(true);
      setReminderStatus('Quest reminders are on for your saved upcoming quests on this browser.');
    } catch {
      setReminderStatus('Could not enable notifications. You can still view upcoming saved quests here.');
    }
  };

  const disableQuestReminders = () => {
    setRemindersEnabled(false);
    setReminderStatus('Browser reminders are turned off. Your saved quests are unchanged.');
  };

  const filterLocalityOptions = useMemo(
    () => [...new Set(allEvents.filter((event) => filters.city === 'all' || event.city === filters.city).map((event) => event.locality).filter(Boolean))].sort(),
    [allEvents, filters.city],
  );

  // Curated lists for Homepage
  const trendingEvents = useMemo(
    () => allEvents.slice(0, 6),
    [allEvents],
  );

  const heroShowcaseEvents = useMemo(() => {
    if (allEvents.length >= 3) {
      const tech = allEvents.find((e) => e.category === 'Technology' || e.category === 'Startup & entrepreneurship') || allEvents[0];
      const music = allEvents.find((e) => (e.category === 'Music' || e.category === 'Music concerts') && e.id !== tech.id) || allEvents[1];
      const fest = allEvents.find((e) => (e.category === 'College festivals' || e.category === 'Art and culture') && e.id !== tech.id && e.id !== music.id) || allEvents[2];
      return [tech, music, fest].filter(Boolean);
    }
    return allEvents.slice(0, 3);
  }, [allEvents]);

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
      .then((response) => {
        if (active) {
          const u = response.user || null;
          setCurrentUser(u);
          if (u) {
            if (Array.isArray(u.interests) && u.interests.length > 0) {
              setSelectedInterests(u.interests);
            }
            if (u.preferredCity) {
              setSelectedCity(u.preferredCity);
            }
            if (u.preferredLocality) {
              setSelectedLocality(u.preferredLocality);
            }
            if (u.role === 'explorer' && !u.onboardingCompleted && (window.location.pathname === '/onboarding' || window.location.search.includes('onboarding=true'))) {
              setShowOnboardingModal(true);
            }
          }
        }
      })
      .catch(() => { if (active) setCurrentUser(null); })
      .finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, []);

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
      if (!userCoordinates || !Number.isFinite(Number(event.latitude)) || !Number.isFinite(Number(event.longitude))) {
        return { ...event, distanceKm: null };
      }
      const radians = (degrees) => (degrees * Math.PI) / 180;
      const dLat = radians(Number(event.latitude) - userCoordinates.latitude);
      const dLon = radians(Number(event.longitude) - userCoordinates.longitude);
      const lat1 = radians(userCoordinates.latitude);
      const lat2 = radians(Number(event.latitude));
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      return { ...event, distanceKm: 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))) };
    });

    if (userCoordinates) {
      return withDistance
        .filter((event) => event.distanceKm !== null)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return withDistance.filter((event) => {
      const cityMatches = !selectedCity || selectedCity === 'all' || (event.city && event.city.toLowerCase() === selectedCity.toLowerCase());
      const localityMatches = !selectedLocality || selectedLocality === 'all' || (event.locality && event.locality.toLowerCase().includes(selectedLocality.toLowerCase()));
      return cityMatches && localityMatches;
    });
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
          {!currentUser ? (
            <>
              <div className="nav-group nav-group-discover">
                <a href="/quests" aria-current={page === 'quests' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/quests')}>Explore Events</a>
                <a href="/radar" aria-current={page === 'radar' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/radar')}>Quest Radar</a>
                <a href="#how-it-works" onClick={(e) => { e.preventDefault(); handleSectionScroll('how-it-works'); }}>How It Works</a>
                <a href="#explorers" onClick={(e) => { e.preventDefault(); handleSectionScroll('explorers'); }}>For Explorers</a>
                <a href="#organizers" onClick={(e) => { e.preventDefault(); handleSectionScroll('organizers'); }}>For Organizers</a>
                <a href="#about" onClick={(e) => { e.preventDefault(); handleSectionScroll('about'); }}>About</a>
              </div>

              <div className="nav-group nav-group-auth">
                <span
                  className={`system-status ${backendHealth?.database === 'mongodb' ? 'is-connected' : 'is-demo'}`}
                  title={backendHealth?.database === 'mongodb' ? 'Verified connection to MongoDB Atlas database' : 'Demo memory database'}
                >
                  {backendHealth?.database === 'mongodb' ? '● MongoDB' : '● Demo State'}
                </span>
                <a href="/login" className="nav-signin">Sign in</a>
                <a className="nav-register primary-btn" href="/register">Join SIDEQUEST</a>
              </div>
            </>
          ) : (
            <>
              <div className="nav-group nav-group-discover">
                <a href="/quests" aria-current={page === 'quests' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/quests')}>Explore Events</a>
                <a href="/radar" aria-current={page === 'radar' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/radar')}>Quest Radar</a>
                <a href="/recommended" aria-current={page === 'recommended' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/recommended')}>For You</a>
              </div>

              <div className="nav-group nav-group-activity">
                <a href="/saved" aria-current={page === 'saved' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/saved')}>
                  Saved {savedQuestIds.length > 0 && <span className="nav-counter-badge">{savedQuestIds.length}</span>}
                </a>
                <a href="/chains" aria-current={page === 'chains' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/chains')}>Quest Chains</a>
                <a href="/bookings" aria-current={page === 'bookings' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/bookings')}>My Bookings</a>
              </div>

              <div className="nav-group nav-group-tools">
                <a href="/publish" aria-current={page === 'publish' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/publish')}>Publish</a>
                <a href="/organizer" aria-current={page === 'organizer' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/organizer')}>Organizer Hub</a>
                {currentUser?.role === 'admin' && (
                  <a href="/admin" aria-current={page === 'admin' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/admin')}>Admin</a>
                )}
                <a href="/safety" aria-current={page === 'safety' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/safety')}>Safety</a>
                <a href="/assistant" aria-current={page === 'assistant' ? 'page' : undefined} onClick={(e) => handleNavLink(e, '/assistant')}>Adventure AI</a>
              </div>

              <div className="nav-group nav-group-auth">
                <span
                  className={`system-status ${backendHealth?.database === 'mongodb' ? 'is-connected' : 'is-demo'}`}
                  title={backendHealth?.database === 'mongodb' ? 'Verified connection to MongoDB Atlas database' : 'Demo memory database'}
                >
                  {backendHealth?.database === 'mongodb' ? '● MongoDB' : '● Demo State'}
                </span>

                <span className="nav-user">Hi, {currentUser.name.split(' ')[0]}</span>
                <button
                  type="button"
                  className="nav-auth-btn"
                  onClick={async () => {
                    await logoutAccount().catch(() => {});
                    window.location.assign('/');
                  }}
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </nav>
      </header>

      <main className="page-shell">
        {/* RETURNING EXPLORER PERSONALIZED GREETING STRIP */}
        {currentUser?.role === 'explorer' && (
          <section className="explorer-welcome-strip" aria-label="Explorer preferences">
            <div className="explorer-welcome-inner">
              <div className="explorer-welcome-content">
                <span className="explorer-welcome-badge">🧭 EXPLORER</span>
                <div className="explorer-welcome-text">
                  <strong>
                    {currentUser.onboardingCompleted
                      ? `Welcome back, ${currentUser.name.split(' ')[0]}!`
                      : `Welcome to SIDEQUEST, ${currentUser.name.split(' ')[0]}!`}
                  </strong>
                  <span>
                    {currentUser.onboardingCompleted
                      ? `Exploring ${currentUser.preferredCity || selectedCity || 'India'} • Preferred: ${
                          currentUser.interests?.length ? currentUser.interests.join(', ') : 'All categories'
                        }`
                      : 'Set your home city and favorite categories for personalized quest radar alerts.'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="secondary-btn btn-sm explorer-pref-btn"
                onClick={() => setShowOnboardingModal(true)}
              >
                {currentUser.onboardingCompleted ? '⚙ Edit Preferences' : '✨ Complete Setup'}
              </button>
            </div>
          </section>
        )}

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
                privacy: 'Privacy & Data Protection',
                terms: 'Terms of Service',
                help: 'Help, FAQ & Support',
                onboarding: 'Explorer setup & preferences',
                about: 'About SIDEQUEST',
              })[page] || 'Explore SIDEQUEST'}
            </h1>
            <p className="description">Discover and experience real events happening across India.</p>
          </div>
        ) : null}

        {page === 'quest-detail' && detailRouteError ? (
          <div className="message error-message">{detailRouteError} <a href="/quests">Return to the Quest Board</a></div>
        ) : null}

        {/* ==================== HOMEPAGE SECTIONS 2, 3, 4 ==================== */}
        {page === 'home' && (
          <>
            {/* SECTION 2: 2-COLUMN HERO */}
            <section className="hero-section sq-hero" aria-labelledby="hero-title">
              <div className="hero-copy">
                <span className="eyebrow"><span className="eyebrow-dot" /> DISCOVER YOUR NEXT EXPERIENCE</span>
                <h1 id="hero-title">Your city has more stories to explore. <em>Your next adventure is waiting.</em></h1>
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
                  <a href="#quest-board" className="primary-btn" onClick={(e) => { e.preventDefault(); handleSectionScroll('quest-board'); }}>Explore Events</a>
                  <a href="/organizer" className="secondary-btn" onClick={(e) => handleNavLink(e, '/organizer')}>Host an Event</a>
                  <a href="/radar" className="secondary-btn" onClick={(e) => handleNavLink(e, '/radar')}>Quest Radar ⌁</a>
                  <a href="/mystery" className="secondary-btn" onClick={(e) => handleNavLink(e, '/mystery')}>Surprise me ↻</a>
                </div>

                <div className="hero-trust-indicators" aria-label="Trust indicators">
                  <div className="trust-indicator-item">
                    <span className="trust-icon">✓</span>
                    <span><strong>23+ Live</strong> Quests</span>
                  </div>
                  <div className="trust-indicator-item">
                    <span className="trust-icon">📍</span>
                    <span><strong>Verified</strong> Venues & Dates</span>
                  </div>
                  <div className="trust-indicator-item">
                    <span className="trust-icon">🎟️</span>
                    <span><strong>Instant QR</strong> Ticket Passes</span>
                  </div>
                  <div className="trust-indicator-item">
                    <span className="trust-icon">🛡️</span>
                    <span><strong>Zero Fake</strong> Listings</span>
                  </div>
                </div>
              </div>

              {/* Hero Right Column: Visual Showcase Stack of Top Real Events */}
              <div className="hero-showcase-column" aria-label="Featured live India events">
                <div className="hero-showcase-badge">🔥 LIVE QUESTS SHOWCASE</div>
                <div className="hero-card-stack">
                  {heroShowcaseEvents.map((evt, idx) => (
                    <div
                      key={`hero-card-${evt.id || idx}`}
                      className={`hero-showcase-card stack-card-${idx}`}
                      onClick={() => setDetailEvent(evt)}
                    >
                      <div className="hero-card-top">
                        <span className="pill accent">{evt.category}</span>
                        <span className="verified-source-tag">✓ Verified</span>
                        <span className={`card-price-pill ${evt.isFree || evt.priceStarting === 0 ? 'is-free' : ''}`}>
                          {evt.isFree || evt.priceStarting === 0 ? 'FREE' : `FROM ₹${evt.priceStarting}`}
                        </span>
                      </div>
                      <h4 className="hero-card-title">{evt.title}</h4>
                      <div className="hero-card-meta">
                        <span>📅 {formatEventDateTime(evt)}</span>
                        <span>📍 {evt.venue ? `${evt.venue}, ` : ''}{evt.city}</span>
                      </div>
                      <div className="hero-card-action">
                        <button
                          type="button"
                          className="secondary-btn btn-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailEvent(evt);
                          }}
                        >
                          Quick View →
                        </button>
                        <button
                          type="button"
                          className="primary-btn btn-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!currentUser) {
                              window.location.assign(`/login?next=/quests/${encodeURIComponent(evt.id)}`);
                            } else {
                              setCheckoutEvent(evt);
                            }
                          }}
                        >
                          {evt.isFree || evt.priceStarting === 0 ? 'RSVP' : 'Book Passes'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* SECTION 3: UPCOMING & FEATURED EVENTS */}
            <section className="curated-section featured-events-section" id="featured-events" aria-labelledby="featured-heading">
              <div className="curated-header">
                <div>
                  <span className="eyebrow"><span className="eyebrow-dot" /> Curated Highlights</span>
                  <h2 id="featured-heading">🔥 Featured & Trending Events Across India</h2>
                  <p className="description">Handpicked developer conferences, indie concerts, and premier cultural festivals.</p>
                </div>
                <a href="#quest-board" className="secondary-btn btn-sm" onClick={(e) => { e.preventDefault(); handleSectionScroll('quest-board'); }}>See Full Board</a>
              </div>

              {/* Quick City Filter Pills */}
              <div className="hero-city-pills" aria-label="Quick city selector">
                <button
                  type="button"
                  className={`city-pill-btn ${filters.city === 'all' ? 'active' : ''}`}
                  onClick={() => handleCitySelect('all')}
                >
                  🇮🇳 All India ({allEvents.length})
                </button>
                {INDIA_CITIES.slice(0, 8).map((city) => (
                  <button
                    key={city.name}
                    type="button"
                    className={`city-pill-btn ${filters.city === city.name ? 'active' : ''}`}
                    onClick={() => handleCitySelect(city.name)}
                  >
                    <span>{city.icon}</span> {city.name}
                  </button>
                ))}
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
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => {
                          if (!currentUser) {
                            window.location.assign(`/login?next=/quests/${encodeURIComponent(evt.id)}`);
                          } else {
                            setCheckoutEvent(evt);
                          }
                        }}
                      >
                        {evt.isFree || evt.priceStarting === 0 ? 'RSVP Free' : 'Book Tickets'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* SECTION 4: BROWSE BY CATEGORY */}
            <section className="browse-category-section" id="categories" aria-labelledby="cat-browse-title">
              <div className="section-heading">
                <div>
                  <span className="eyebrow"><span className="eyebrow-dot" /> Explore Collections</span>
                  <h2 id="cat-browse-title">Browse Quests by Category</h2>
                  <p className="description">Explore tailored collections matching your unique vibe.</p>
                </div>
              </div>
              <div className="category-browse-grid">
                {[
                  { name: 'Technology', icon: '⌘', desc: 'Summits, Hackathons & AI Meetups' },
                  { name: 'Music', icon: '♫', desc: 'Live Concerts, Indie Gigs & Acoustic' },
                  { name: 'College festivals', icon: '🎓', desc: 'Inter-Collegiate Fests & Competitions' },
                  { name: 'Art and culture', icon: '✳', desc: 'Exhibitions, Craft & Heritage Trails' },
                  { name: 'Workshops', icon: '✂', desc: 'Maker Labs, Pottery & Creative Skills' },
                  { name: 'Gaming', icon: '◇', desc: 'Esports Tournaments & LAN Battles' },
                  { name: 'Sports', icon: '↗', desc: 'Marathons, Badminton & Open Runs' },
                  { name: 'Startup & entrepreneurship', icon: '🚀', desc: 'Pitch Nights, Demo Days & Founder Mixers' },
                ].map((cat) => {
                  const count = allEvents.filter((e) => e.category === cat.name).length;
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      className={`category-browse-card ${filters.category === cat.name ? 'is-active' : ''}`}
                      onClick={() => handleCategorySelect(cat.name)}
                    >
                      <span className="cat-icon">{cat.icon}</span>
                      <strong className="cat-title">{cat.name}</strong>
                      <span className="cat-desc">{cat.desc}</span>
                      <span className="cat-count">{count > 0 ? `${count} Quests` : 'Explore'}</span>
                    </button>
                  );
                })}
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

        {/* ==================== HOMEPAGE SECTIONS 6, 7, 8, 9, 10 ==================== */}
        {page === 'home' && (
          <>
            {/* SECTION 6: HOW SIDEQUEST WORKS */}
            <section className="how-it-works-section" id="how-it-works" aria-labelledby="how-it-works-title">
              <div className="section-heading text-center">
                <span className="eyebrow"><span className="eyebrow-dot" /> Simple, Hyperlocal, Verified</span>
                <h2 id="how-it-works-title">How SIDEQUEST Works</h2>
                <p className="description">Three steps to transform your weekend in any Indian city.</p>
              </div>
              <div className="steps-grid">
                <div className="step-card">
                  <div className="step-number">01</div>
                  <div className="step-badge">🧭 DISCOVER</div>
                  <h3>Discover Curated Quests</h3>
                  <p>Search verified events by city, neighborhood, or category. Use the fantasy world map or Quest Radar to find experiences matching your exact schedule.</p>
                </div>
                <div className="step-card">
                  <div className="step-number">02</div>
                  <div className="step-badge">🎟️ BOOK</div>
                  <h3>Book Verified Passes</h3>
                  <p>Claim free RSVP spots or purchase multi-tier tickets instantly with UPI, Cards, and NetBanking through our India payment sandbox checkout.</p>
                </div>
                <div className="step-card">
                  <div className="step-number">03</div>
                  <div className="step-badge">🏆 LEVEL UP</div>
                  <h3>Attend & Unlock Badges</h3>
                  <p>Show your digital QR pass at the venue door for instant check-in, build day-long Quest Chains, and unlock Explorer milestones.</p>
                </div>
              </div>
            </section>

            {/* SECTION 7: EXPLORER BENEFITS */}
            <section className="benefits-section explorer-benefits-section" id="explorers" aria-labelledby="explorer-benefits-title">
              <div className="section-heading">
                <div>
                  <span className="eyebrow"><span className="eyebrow-dot" /> For Explorers</span>
                  <h2 id="explorer-benefits-title">Why Explorers Love SIDEQUEST</h2>
                  <p className="description">Designed from the ground up for curious people who want to experience their city.</p>
                </div>
              </div>
              <div className="benefits-grid">
                <div className="benefit-card">
                  <div className="benefit-icon">📍</div>
                  <h3>Hyperlocal Discovery</h3>
                  <p>Uncover indie gigs in Indiranagar, design workshops in Bandra, or maker hackathons in Cyber City that never make mainstream aggregators.</p>
                </div>
                <div className="benefit-card">
                  <div className="benefit-icon">🛡️</div>
                  <h3>100% Verified Real Venues</h3>
                  <p>Zero ghost events, zero spam. Every quest features confirmed dates, verified venue addresses, official sources, and clear cancellation policies.</p>
                </div>
                <div className="benefit-card">
                  <div className="benefit-icon">⛓️</div>
                  <h3>Quest Chains & Day Trips</h3>
                  <p>Chain together a morning coding summit, afternoon coffee tasting, and evening comedy gig into a seamless itinerary with travel estimates.</p>
                </div>
                <div className="benefit-card">
                  <div className="benefit-icon">⭐</div>
                  <h3>Explorer Gamification</h3>
                  <p>Earn XP, unlock achievements from Scout to Grandmaster, save your favorite quests to your offline journal, and leave helpful field notes.</p>
                </div>
              </div>
            </section>

            {/* SECTION 8: ORGANIZER BENEFITS */}
            <section className="benefits-section organizer-benefits-section" id="organizers" aria-labelledby="organizer-benefits-title">
              <div className="section-heading">
                <div>
                  <span className="eyebrow"><span className="eyebrow-dot" /> For Event Creators</span>
                  <h2 id="organizer-benefits-title">Built for Serious Event Organizers</h2>
                  <p className="description">Everything you need to publish, sell tickets, and manage admission for your next big event.</p>
                </div>
                <a href="/organizer" className="primary-btn" onClick={(e) => handleNavLink(e, '/organizer')}>Open Organizer Hub →</a>
              </div>
              <div className="benefits-grid">
                <div className="benefit-card">
                  <div className="benefit-icon">⚡</div>
                  <h3>60-Second Publishing</h3>
                  <p>Create and publish verified events with multi-tier ticketing (Early Bird, Standard, VIP) and customized cancellation terms in under a minute.</p>
                </div>
                <div className="benefit-card">
                  <div className="benefit-icon">📊</div>
                  <h3>Real-Time Sales Analytics</h3>
                  <p>Monitor live registration numbers, total revenue, attendance metrics, and inventory limits from a clean, unified dashboard.</p>
                </div>
                <div className="benefit-card">
                  <div className="benefit-icon">📱</div>
                  <h3>Instant QR Check-In Scanner</h3>
                  <p>Scan attendee digital passes in real-time right at the entrance. Instant validation prevents duplicate entries and keeps queues moving fast.</p>
                </div>
                <div className="benefit-card">
                  <div className="benefit-icon">🎯</div>
                  <h3>Hyperlocal Targeted Reach</h3>
                  <p>Directly reach active young professionals, college students, and tech communities looking for events right in your city.</p>
                </div>
              </div>
            </section>

            {/* SECTION 9: FEATURE HIGHLIGHTS */}
            <section className="feature-highlights-section" id="feature-highlights" aria-labelledby="highlights-title">
              <div className="section-heading text-center">
                <span className="eyebrow"><span className="eyebrow-dot" /> Platform Highlights</span>
                <h2 id="highlights-title">Everything You Need to Explore Your City</h2>
                <p className="description">Specialized tools crafted to turn ordinary weekends into memorable adventures.</p>
              </div>
              <div className="feature-tools-grid">
                <div className="tool-card">
                  <div className="tool-icon">⌁</div>
                  <h3>Quest Radar</h3>
                  <p>Set your available time window and travel radius. Radar scans your city and ranks events tailored to your personal vibe.</p>
                  <a href="/radar" className="secondary-btn btn-sm" onClick={(e) => handleNavLink(e, '/radar')}>Launch Radar →</a>
                </div>
                <div className="tool-card">
                  <div className="tool-icon">🤖</div>
                  <h3>AI Adventure Assistant</h3>
                  <p>Ask our local concierge anything: free weekend meetups, hackathons near Koramangala, or family-friendly cultural festivals.</p>
                  <a href="/assistant" className="secondary-btn btn-sm" onClick={(e) => handleNavLink(e, '/assistant')}>Ask Adventure AI →</a>
                </div>
                <div className="tool-card">
                  <div className="tool-icon">⛓️</div>
                  <h3>Quest Chains</h3>
                  <p>Assemble multiple stops into custom mini-adventures. Reorder stops, review travel estimates, and party up with friends.</p>
                  <a href="/chains" className="secondary-btn btn-sm" onClick={(e) => handleNavLink(e, '/chains')}>Build Itinerary →</a>
                </div>
                <div className="tool-card">
                  <div className="tool-icon">🎲</div>
                  <h3>Mystery Quest</h3>
                  <p>Suffering from decision fatigue? Let serendipity take the wheel. Spin the wheel to unlock a handpicked surprise quest.</p>
                  <a href="/mystery" className="secondary-btn btn-sm" onClick={(e) => handleNavLink(e, '/mystery')}>Surprise Me ↻</a>
                </div>
              </div>
            </section>

            {/* SECTION 10: FINAL CALL TO ACTION */}
            <section className="final-cta-section" id="final-cta" aria-labelledby="cta-heading">
              <div className="cta-banner-panel">
                <span className="eyebrow"><span className="eyebrow-dot" /> Begin Your Journey</span>
                <h2 id="cta-heading">Your city is full of sidequests.<br /><em>Ready to explore?</em></h2>
                <p className="description">
                  Join thousands of explorers discovering tech summits, college festivals, indie concerts, and creative workshops across India.
                </p>
                <div className="cta-banner-actions hero-actions">
                  <a href="/register" className="primary-btn btn-lg">Join SIDEQUEST for Free</a>
                  <a href="#quest-board" className="secondary-btn btn-lg" onClick={(e) => { e.preventDefault(); handleSectionScroll('quest-board'); }}>Explore Quest Board</a>
                </div>
              </div>
            </section>
          </>
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
        {page === 'recommended' && (
          !currentUser && !authLoading ? (
            <AuthGate
              title="Personalized Recommendations"
              description="Sign in or create an account to customize your category interests, favorite cities, and get AI-ranked quest recommendations."
              next="/recommended"
              requiredRole="explorer"
            />
          ) : (
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
          )
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
          !currentUser && !authLoading ? (
            <AuthGate
              title="Save your favorite quests"
              description="Sign in or create an account to bookmark events to your personal journal and access them across all your devices."
              next="/saved"
              requiredRole="explorer"
            />
          ) : (
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
          )
        )}

        {/* ==================== QUEST CHAINS ==================== */}
        {page === 'chains' && (
          !currentUser && !authLoading ? (
            <AuthGate
              title="Build your adventure chains"
              description="Sign in to create, organize, and share multi-stop quest chains for weekend trips and city tours."
              next="/chains"
              requiredRole="explorer"
            />
          ) : (
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
                  <div key={chain.id} className={`chain-card ${chain.id === activeChainId ? 'active' : ''}`} onClick={() => setActiveChainId(chain.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3>{chain.title}</h3>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuestChains((curr) => curr.filter((c) => c.id !== chain.id));
                          if (activeChainId === chain.id) setActiveChainId('');
                        }}
                        style={{ fontSize: '0.8rem', color: '#dc2626' }}
                      >
                        Delete Chain
                      </button>
                    </div>
                    {chain.stops.length === 0 ? (
                      <p className="helper-text" style={{ margin: '0.5rem 0' }}>No stops added yet. Explore quests and click "+ Add to chain".</p>
                    ) : (
                      <ol className="chain-stops">
                        {chain.stops.map((stop, index) => (
                          <li key={`${chain.id}-${stop.eventId}`} className="chain-stop" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0' }}>
                            <span>{index + 1}. {stop.title} ({stop.city})</span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                type="button"
                                className="chain-move-btn secondary-btn btn-sm"
                                disabled={index === 0}
                                aria-label={`Move ${stop.title} up`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setQuestChains((curr) => curr.map((c) => c.id === chain.id ? { ...c, stops: moveChainStop(c.stops, index, -1) } : c));
                                }}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="chain-move-btn secondary-btn btn-sm"
                                disabled={index === chain.stops.length - 1}
                                aria-label={`Move ${stop.title} down`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setQuestChains((curr) => curr.map((c) => c.id === chain.id ? { ...c, stops: moveChainStop(c.stops, index, 1) } : c));
                                }}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="chain-remove-btn ghost-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setQuestChains((curr) => curr.map((c) => c.id === chain.id ? { ...c, stops: removeChainStop(c.stops, stop.eventId) } : c));
                                }}
                                style={{ color: '#dc2626', fontSize: '0.8rem' }}
                              >
                                Remove
                              </button>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                    {(() => {
                      const summary = estimateChainSummary(chain);
                      return (
                        <div className="chain-summary-badge" style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                          {summary.stopCount} {summary.stopCount === 1 ? 'stop' : 'stops'}
                          {summary.cities?.length ? ` · ${summary.cities.join(' → ')}` : ''}
                          {summary.multiCity ? ' (Multi-city)' : ''}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </section>
          )
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
            <AuthGate
              title="Every great quest needs a guide."
              description="Sign in with an organizer account to publish verified events across Indian cities."
              next="/publish"
              requiredRole="organizer"
            />
          )
        )}

        {/* ==================== NEARBY QUESTS ==================== */}
        {page === 'nearby' && (
          <section id="nearby" className="panel nearby-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Hyperlocal Discovery</span>
                <h2>{userCoordinates ? 'Quests Around Your GPS Coordinates' : `Quests in ${selectedCity} • ${selectedLocality || 'All Localities'}`}</h2>
                <p className="small-copy">
                  Use your device location for live distance-sorted quests, or explore by city and locality across India. Exact distances require event coordinates.
                </p>
              </div>
              <button
                type="button"
                className="secondary-btn"
                onClick={requestUserLocation}
                disabled={locating}
              >
                {locating ? 'Finding location…' : userCoordinates ? '📍 Refresh GPS Location' : '📍 Use My Location'}
              </button>
            </div>

            <div className="filter-bar" style={{ marginBottom: '1.2rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                <span>City:</span>
                <select
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value);
                    setUserCoordinates(null);
                  }}
                  className="filter-select"
                >
                  {cityOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                <span>Locality:</span>
                <input
                  type="text"
                  value={selectedLocality}
                  onChange={(e) => setSelectedLocality(e.target.value)}
                  placeholder="e.g. Koramangala, Bandra, Indiranagar"
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--line)' }}
                />
              </label>

              {selectedLocality && (
                <button
                  type="button"
                  className="secondary-btn btn-sm"
                  onClick={() => setSelectedLocality('')}
                >
                  Clear locality
                </button>
              )}
            </div>

            {locationStatus ? <p className="message compact" role="status">{locationStatus}</p> : null}

            {nearbyEvents.length === 0 ? (
              <div className="empty-state compact">
                <strong>No nearby quests found for this area.</strong>
                <p>Try clearing the locality filter or switching to another city.</p>
                <button type="button" className="secondary-btn" onClick={() => setSelectedLocality('')}>Show all in {selectedCity}</button>
              </div>
            ) : (
              <div className="quest-grid">
                {nearbyEvents.map((event) => (
                  <article key={event.id} className="quest-card">
                    <div className="quest-card-badge-row">
                      <span className="pill accent">{event.category}</span>
                      {event.distanceKm !== null && event.distanceKm !== undefined ? (
                        <span className="pill" style={{ background: '#e8f5e9', color: '#1b5e20', fontWeight: 600 }}>
                          📍 {event.distanceKm.toFixed(1)} km away
                        </span>
                      ) : (
                        <span className="pill" style={{ background: '#f5f5f5', color: '#666' }}>
                          {event.locality || event.city}
                        </span>
                      )}
                    </div>
                    <h3 className="quest-card-title">{event.title}</h3>
                    <p className="quest-card-desc">{event.description?.slice(0, 110)}…</p>
                    <div className="quest-card-meta">
                      <span>📅 {formatDate(event.date)} · {event.startTime}</span>
                      <span>🏛️ {event.venue}, {event.locality || event.city}</span>
                    </div>
                    <div className="quest-card-footer">
                      <span className="quest-card-price">
                        {event.isFree || event.priceStarting === 0 ? 'Free Entry' : `₹${event.priceStarting}+`}
                      </span>
                      <div className="quest-card-actions">
                        <button
                          type="button"
                          className="secondary-btn btn-sm"
                          onClick={() => toggleSavedQuest(event)}
                        >
                          {savedQuestIds.includes(event.id) ? '✓ Saved' : '＋ Save'}
                        </button>
                        <button
                          type="button"
                          className="primary-btn btn-sm"
                          onClick={() => setDetailEvent(event)}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ==================== ADVENTURE AI ASSISTANT ==================== */}
        {page === 'assistant' && (
          <section className="panel feature-panel assistant-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Feature 19 / Adventure Assistant</span>
                <h2>Plan a little adventure.</h2>
                <p className="small-copy">Ask for ideas, compare upcoming quests, or get a starting point for a day out. Uses a transparent local matching engine over SIDEQUEST verified events.</p>
              </div>
              <span className="feature-emblem">✧</span>
            </div>
            <div className="assistant-disclaimer">
              <strong>Explorer note:</strong> Recommendations depend on the event details currently available. Check dates, venue, and tickets before heading out.
            </div>
            <div className="assistant-prompts" aria-label="Suggested questions">
              {['Find live music this weekend', 'Suggest a technology event', 'Help me plan something affordable', 'Show me something in Bengaluru'].map((prompt) => (
                <button type="button" className="interest-chip" key={prompt} onClick={() => setAssistantDraft(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
            <div className="assistant-thread" aria-live="polite">
              {assistantMessages.length ? (
                assistantMessages.map((message) => (
                  <article className={`assistant-message ${message.role === 'user' ? 'from-user' : 'from-guide'}`} key={message.id}>
                    <span>{message.role === 'user' ? 'YOU' : 'SIDEQUEST GUIDE'}</span>
                    <p>{message.text}</p>
                    {message.events?.length ? (
                      <div className="assistant-event-links">
                        {message.events.map((event) => (
                          <button type="button" className="secondary-btn btn-sm" key={event.id} onClick={() => setDetailEvent(event)}>
                            View {event.title}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <strong>Your guide is ready.</strong>
                  <br />
                  Ask about concerts, hackathons, college fests, or upcoming weekend outings across India.
                </div>
              )}
            </div>
            <form
              className="assistant-compose"
              onSubmit={(event) => {
                event.preventDefault();
                const prompt = assistantDraft.trim();
                if (!prompt) return;
                const answer = answerAdventureQuestion(prompt, allEvents, {
                  interests: selectedInterests,
                  city: selectedCity,
                  savedIds: savedQuestIds,
                  now: new Date(),
                });
                setAssistantMessages((current) => [
                  ...current,
                  { id: `u-${Date.now()}`, role: 'user', text: prompt },
                  { id: `a-${Date.now() + 1}`, role: 'assistant', text: answer.text, events: answer.events },
                ].slice(-30));
                setAssistantDraft('');
              }}
            >
              <label htmlFor="adventure-assistant-input">What are you in the mood for?</label>
              <textarea
                id="adventure-assistant-input"
                rows="3"
                maxLength="500"
                value={assistantDraft}
                onChange={(event) => setAssistantDraft(event.target.value)}
                placeholder="e.g. Find a tech meetup or music gig in Bengaluru this weekend…"
              />
              <div className="chat-compose-footer">
                <small>{assistantDraft.length}/500 · Saved on this device</small>
                <button className="primary-btn" type="submit" disabled={!assistantDraft.trim()}>
                  Ask the guide
                </button>
              </div>
            </form>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                setAssistantMessages([]);
                setToast('Your local assistant conversation was cleared.');
              }}
            >
              Clear conversation
            </button>
          </section>
        )}

        {/* ==================== MYSTERY QUEST ==================== */}
        {page === 'mystery' && (
          <section id="mystery-quest" className="panel mystery-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Feature 08 / Mystery Quest</span>
                <h2>Leave the next move to fate.</h2>
                <p className="small-copy">
                  Set a few boundaries, then reveal an upcoming quest picked from real verified events on your board. Your interests gently influence the pick—surprise is part of the fun.
                </p>
              </div>
              <span className="mystery-emblem" aria-hidden="true">?</span>
            </div>
            <div className="mystery-rules">
              <label>
                <span>City</span>
                <select
                  value={mysteryFilters.city}
                  onChange={(event) => {
                    setMysteryFilters((current) => ({ ...current, city: event.target.value }));
                    setMysteryPick(null);
                  }}
                >
                  <option value="all">Any city</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Quest type</span>
                <select
                  value={mysteryFilters.category}
                  onChange={(event) => {
                    setMysteryFilters((current) => ({ ...current, category: event.target.value }));
                    setMysteryPick(null);
                  }}
                >
                  <option value="all">Anything goes</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Time window</span>
                <select
                  value={mysteryFilters.time}
                  onChange={(event) => {
                    setMysteryFilters((current) => ({ ...current, time: event.target.value }));
                    setMysteryPick(null);
                  }}
                >
                  <option value="any">Any upcoming date</option>
                  <option value="today">Today</option>
                  <option value="weekend">This weekend</option>
                  <option value="next7days">Next 7 days</option>
                </select>
              </label>
            </div>
            <div className="mystery-interest-note">
              <strong>Your interests:</strong> {selectedInterests.length ? selectedInterests.join(' · ') : 'All categories'}
            </div>
            <div className="mystery-reveal-stage">
              {!mysteryPick ? (
                <>
                  <span className="mystery-sigil" aria-hidden="true">✦</span>
                  <p className="eyebrow">The next quest is hidden</p>
                  <h3>Ready for an unexpected adventure?</h3>
                  <p className="small-copy">We’ll choose from future events that match your filters and show you why the pick made the list.</p>
                  <button
                    type="button"
                    className="primary-btn mystery-draw-btn"
                    onClick={() => {
                      const result = getMysteryQuest(allEvents, {
                        interests: selectedInterests,
                        city: mysteryFilters.city,
                        category: mysteryFilters.category,
                        timeframe: mysteryFilters.time,
                        now: new Date(),
                      });
                      setMysteryPick(result);
                      setMysteryRevealCount((count) => count + 1);
                    }}
                  >
                    {mysteryRevealCount ? 'Draw another quest' : 'Reveal my quest'}
                  </button>
                </>
              ) : (
                <>
                  <span className="eyebrow">Your mystery quest is revealed</span>
                  <article className="mystery-result">
                    <div className="radar-result-symbol">{categorySymbol(mysteryPick.event.category)}</div>
                    <div className="mystery-result-copy">
                      <span className="pill accent">{mysteryPick.event.category}</span>
                      <h3>{mysteryPick.event.title}</h3>
                      <p className="small-copy">
                        {formatEventDateTime(mysteryPick.event)} · {[mysteryPick.event.venue, mysteryPick.event.locality, mysteryPick.event.city].filter(Boolean).join(', ')}
                      </p>
                      <div className="mystery-reasons">
                        <strong>Why this quest?</strong>
                        {mysteryPick.reasons?.map((reason) => (
                          <span key={reason}>✦ {reason}</span>
                        ))}
                        <span>Chosen from {mysteryPick.candidatesCount} eligible upcoming quests.</span>
                      </div>
                      <div className="mystery-actions">
                        <button type="button" className="primary-btn" onClick={() => setDetailEvent(mysteryPick.event)}>
                          View quest
                        </button>
                        <button
                          type="button"
                          className={savedQuestIds.includes(mysteryPick.event.id) ? 'save-btn active' : 'save-btn'}
                          onClick={() => toggleSavedQuest(mysteryPick.event)}
                        >
                          {savedQuestIds.includes(mysteryPick.event.id) ? '✓ Saved' : '＋ Save quest'}
                        </button>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => {
                            const result = getMysteryQuest(allEvents, {
                              interests: selectedInterests,
                              city: mysteryFilters.city,
                              category: mysteryFilters.category,
                              timeframe: mysteryFilters.time,
                              now: new Date(),
                            });
                            setMysteryPick(result);
                            setMysteryRevealCount((count) => count + 1);
                          }}
                        >
                          Try another
                        </button>
                      </div>
                    </div>
                  </article>
                </>
              )}
            </div>
          </section>
        )}

        {/* ==================== ACHIEVEMENTS ==================== */}
        {page === 'achievements' && (
          <section id="achievements" className="panel achievements-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Feature 09 / Explorer Achievements</span>
                <h2>Every little adventure counts.</h2>
                <p className="small-copy">Milestones calculated from your saved quests, Quest Chains, and Mystery Quest reveals on this browser.</p>
              </div>
              <span className="achievement-emblem" aria-hidden="true">✺</span>
            </div>
            <div className="achievement-summary">
              <div><strong>{achievements.filter((badge) => badge.earned).length}/{achievements.length}</strong><span>Badges earned</span></div>
              <div><strong>{savedQuestIds.length}</strong><span>Saved quests</span></div>
              <div><strong>{questChains.reduce((total, chain) => total + chain.stops.length, 0)}</strong><span>Planned stops</span></div>
              <div><strong>{mysteryRevealCount}</strong><span>Mystery reveals</span></div>
            </div>
            <div className="achievement-grid">
              {achievements.map((badge) => (
                <article key={badge.id} className={badge.earned ? 'achievement-card earned' : 'achievement-card'}>
                  <div className="achievement-icon" aria-hidden="true">{badge.earned ? badge.icon : '◇'}</div>
                  <div className="achievement-copy">
                    <div className="achievement-status">{badge.earned ? '✦ UNLOCKED' : 'STILL IN PROGRESS'}</div>
                    <h3>{badge.title}</h3>
                    <p>{badge.description}</p>
                    <div className="achievement-progress" role="progressbar" aria-label={`${badge.title} progress`} aria-valuemin="0" aria-valuemax={badge.target} aria-valuenow={badge.progress}>
                      <span style={{ width: `${badge.percent}%` }} />
                    </div>
                    <small>{badge.progress}/{badge.target} progress</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ==================== EXPLORER XP & LEVELS ==================== */}
        {page === 'levels' && (
          <section className="panel feature-panel levels-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Feature 15 / XP & Levels</span>
                <h2>Every small step moves you forward.</h2>
                <p className="small-copy">Earn experience through your activity on SIDEQUEST. Progress is a local gamification score.</p>
              </div>
              <span className="feature-emblem">✦</span>
            </div>
            <div className="level-hero">
              <div className="level-medallion">{explorerLevel.level}</div>
              <div className="level-copy">
                <span className="eyebrow">CURRENT RANK</span>
                <h3>{explorerLevel.title}</h3>
                <p>{explorerLevel.xp} XP earned · {explorerLevel.currentLevelXp}/100 XP toward next level</p>
                <div className="achievement-progress" role="progressbar" aria-label="Progress to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow={explorerLevel.progress}>
                  <span style={{ width: `${explorerLevel.progress}%` }} />
                </div>
              </div>
            </div>
            <div className="xp-rules-grid">
              <article><strong>+10 XP</strong><span>Save a quest</span></article>
              <article><strong>+25 XP</strong><span>Share a field note</span></article>
              <article><strong>+15 XP</strong><span>Add a chain stop</span></article>
              <article><strong>+5 XP</strong><span>Reveal a Mystery Quest</span></article>
              <article><strong>+2 XP</strong><span>Post a party message</span></article>
            </div>
            <div className="level-ladder">
              <h3>Explorer ranks</h3>
              {['Rookie Explorer', 'Wayfinder', 'Pathfinder', 'Trailblazer', 'Legendary Explorer'].map((rank, index) => (
                <div className={explorerLevel.title === rank ? 'level-rank current' : 'level-rank'} key={rank}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{rank}</strong>
                  <small>{index * 3 + 1}+ level</small>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ==================== QUEST REMINDERS ==================== */}
        {page === 'reminders' && (
          <section id="quest-reminders" className="panel reminders-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Feature 07 / Quest Reminders</span>
                <h2>Keep your next adventure on the radar.</h2>
                <p className="small-copy">Set browser reminders for quests you’ve saved. This is an optional, device-local notification feature.</p>
              </div>
              <span className="reminder-emblem" aria-hidden="true">◷<i>✦</i></span>
            </div>
            <div className="reminder-controls">
              <label>
                <span>Remind me before the event:</span>
                <select value={reminderLeadMinutes} onChange={(event) => setReminderLeadMinutes(Number(event.target.value))}>
                  <option value="15">15 minutes before</option>
                  <option value="30">30 minutes before</option>
                  <option value="60">1 hour before</option>
                  <option value="1440">1 day before</option>
                </select>
              </label>
              <div className="reminder-toggle-card">
                <div>
                  <strong>{remindersEnabled ? 'Browser reminders are active' : 'Browser reminders are off'}</strong>
                  <p className="small-copy">
                    {typeof Notification === 'undefined'
                      ? 'Notifications are not available in this browser.'
                      : Notification.permission === 'denied'
                      ? 'Notifications are blocked in browser settings.'
                      : 'Keep this browser open around the reminder time for scheduled notifications.'}
                  </p>
                </div>
                {remindersEnabled ? (
                  <button type="button" className="secondary-btn" onClick={disableQuestReminders}>Turn off</button>
                ) : (
                  <button type="button" className="primary-btn" onClick={enableQuestReminders}>Enable reminders</button>
                )}
              </div>
            </div>
            {reminderStatus ? <p className="message compact" role="status">{reminderStatus}</p> : null}
            <div className="reminder-summary">
              <div><strong>{savedQuestIds.length}</strong><span>Saved quests</span></div>
              <div><strong>{reminderItems.length}</strong><span>Upcoming saved quests</span></div>
              <div><strong>{reminderItems.filter((item) => item.status === 'due').length}</strong><span>Due soon</span></div>
            </div>
            <div className="reminders-list-heading">
              <div><span className="eyebrow">Your schedule</span><h3>Upcoming saved events</h3></div>
              <a className="secondary-btn" href="/saved">Manage saved quests</a>
            </div>
            {!savedQuestIds.length ? (
              <div className="empty-state reminder-empty">
                <strong>Your reminder list is empty.</strong><br />Save an event from the Quest Board or Quest Radar to set reminders.
              </div>
            ) : reminderItems.length === 0 ? (
              <div className="empty-state reminder-empty">
                <strong>No upcoming saved events yet.</strong><br />Past events and saved quests without valid future dates won’t be scheduled.
              </div>
            ) : (
              <div className="reminders-list">
                {reminderItems.map((item) => (
                  <article className="reminder-card" key={item.event.id}>
                    <div className="reminder-date-stamp">
                      <span>{new Date(item.start).toLocaleDateString('en-IN', { month: 'short' })}</span>
                      <strong>{new Date(item.start).toLocaleDateString('en-IN', { day: '2-digit' })}</strong>
                    </div>
                    <div className="reminder-detail">
                      <div className="radar-result-top">
                        <span className="pill accent">{item.event.category}</span>
                        <span className={item.status === 'due' ? 'reminder-state due' : 'reminder-state'}>
                          {item.status === 'due' ? 'Window reached' : `In ${item.minutesUntil < 60 ? `${item.minutesUntil}m` : `${Math.floor(item.minutesUntil / 60)}h ${item.minutesUntil % 60}m`}`}
                        </span>
                      </div>
                      <h3>{item.event.title}</h3>
                      <p className="small-copy">{formatEventDateTime(item.event)} · {[item.event.venue, item.event.locality, item.event.city].filter(Boolean).join(', ')}</p>
                    </div>
                    <button type="button" className="secondary-btn reminder-open" onClick={() => setDetailEvent(item.event)}>
                      View quest
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ==================== QUEST CALENDAR ==================== */}
        {page === 'calendar' && (
          <section className="panel feature-panel calendar-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Feature 14 / Quest Calendar</span>
                <h2>Put your adventures on the map of time.</h2>
                <p className="small-copy">Upcoming saved quests grouped by date. Export calendar entries to a standard .ics file for Google Calendar or Apple Calendar.</p>
              </div>
              <span className="feature-emblem">▦</span>
            </div>
            {(() => {
              const planned = allEvents
                .filter((event) => savedQuestIds.some((id) => String(id) === String(event.id)) && event.date && new Date(`${event.date}T${event.startTime || '23:59'}:00`) >= new Date())
                .sort((a, b) => `${a.date} ${a.startTime || ''}`.localeCompare(`${b.date} ${b.startTime || ''}`));
              const exportCalendar = () => {
                const esc = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
                const stamp = (event) => `${String(event.date).replaceAll('-', '')}T${String(event.startTime || '09:00').replace(':', '')}00`;
                const lines = [
                  'BEGIN:VCALENDAR',
                  'VERSION:2.0',
                  'PRODID:-//SIDEQUEST//Quest Calendar//EN',
                  ...planned.flatMap((event) => [
                    'BEGIN:VEVENT',
                    `UID:${esc(event.id)}@sidequest`,
                    `DTSTART:${stamp(event)}`,
                    `SUMMARY:${esc(event.title)}`,
                    `LOCATION:${esc([event.venue, event.locality, event.city].filter(Boolean).join(', '))}`,
                    `DESCRIPTION:${esc(event.description)}`,
                    'END:VEVENT',
                  ]),
                  'END:VCALENDAR',
                ];
                const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = 'sidequest-quests.ics';
                anchor.click();
                URL.revokeObjectURL(url);
              };
              return (
                <>
                  <div className="calendar-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                    <div><strong>{planned.length}</strong><span> upcoming saved quests</span></div>
                    <button className="primary-btn" type="button" onClick={exportCalendar} disabled={!planned.length}>
                      📅 Export .ics Calendar
                    </button>
                  </div>
                  {planned.length ? (
                    <div className="calendar-list">
                      {planned.map((event) => (
                        <article className="calendar-event" key={event.id}>
                          <div className="calendar-date">
                            <span>{new Date(`${event.date}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</span>
                            <strong>{new Date(`${event.date}T00:00:00`).getDate()}</strong>
                            <small>{new Date(`${event.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</small>
                          </div>
                          <div className="calendar-event-copy">
                            <span className="pill accent">{event.category}</span>
                            <h3>{event.title}</h3>
                            <p className="small-copy">{formatEventDateTime(event)} · {[event.venue, event.locality, event.city].filter(Boolean).join(', ')}</p>
                          </div>
                          <button type="button" className="secondary-btn" onClick={() => setDetailEvent(event)}>
                            View
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <strong>No saved upcoming quests yet.</strong><br />Save an event from the Quest Board to see it in your calendar.
                    </div>
                  )}
                </>
              );
            })()}
          </section>
        )}

        {/* ==================== PARTY CHAT ==================== */}
        {page === 'chat' && (
          <section className="panel feature-panel chat-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Feature 12 / Party Chat</span>
                <h2>Make the plan together.</h2>
                <p className="small-copy">A device-local coordination board for sharing meetup points, timing, and quick updates.</p>
              </div>
              <span className="feature-emblem">♧</span>
            </div>
            <div className="chat-thread" aria-live="polite">
              {chatMessages.length ? (
                chatMessages.slice(-40).map((message) => (
                  <article className="chat-message" key={message.id}>
                    <div>
                      <strong>{message.author}</strong>
                      <time>{new Date(message.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</time>
                    </div>
                    <p>{message.text}</p>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <strong>Your party board is quiet.</strong><br />Post a message to coordinate your meetup plan.
                </div>
              )}
            </div>
            <form
              className="chat-compose"
              onSubmit={(event) => {
                event.preventDefault();
                const text = chatDraft.trim();
                if (!text) return;
                setChatMessages((current) => [
                  ...current,
                  {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    author: currentUser?.name || 'Guest Explorer',
                    text: text.slice(0, 500),
                    createdAt: new Date().toISOString(),
                  },
                ]);
                setChatDraft('');
              }}
            >
              <label htmlFor="party-chat-message">Message your party</label>
              <textarea
                id="party-chat-message"
                rows="3"
                maxLength="500"
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                placeholder="e.g. Let's meet at the main gates at 5:30 PM sharp…"
              />
              <div className="chat-compose-footer">
                <small>{chatDraft.length}/500 · Stored locally</small>
                <button className="primary-btn" type="submit" disabled={!chatDraft.trim()}>
                  Post message
                </button>
              </div>
            </form>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                setChatMessages([]);
                setToast('This browser’s party chat was cleared.');
              }}
            >
              Clear local chat
            </button>
          </section>
        )}

        {/* ==================== COMMUNITY INSIGHTS ==================== */}
        {page === 'insights' && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Community Insights</span>
                <h2>Participation snapshot</h2>
                <p className="small-copy">Real-time pulse of events, registrations, and trending categories across India.</p>
              </div>
            </div>
            <div className="insight-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', margin: '1rem 0' }}>
              <div className="stat-box" style={{ background: '#f5eedc', padding: '1.2rem', borderRadius: '12px' }}>
                <strong style={{ fontSize: '1.8rem', display: 'block', color: 'var(--deep-green)' }}>{insights.totalRegistrations || 0}</strong>
                <span>Total passes issued</span>
              </div>
              <div className="stat-box" style={{ background: '#f5eedc', padding: '1.2rem', borderRadius: '12px' }}>
                <strong style={{ fontSize: '1.8rem', display: 'block', color: 'var(--deep-green)' }}>{insights.popularCategories?.[0]?.name || 'Technology'}</strong>
                <span>Most popular category</span>
              </div>
            </div>
            <div className="insight-list">
              <h3>Top Registered Quests</h3>
              {insights.topEvents && insights.topEvents.length > 0 ? (
                insights.topEvents.map((entry) => (
                  <div key={entry.title} className="insight-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                    <span>{entry.title}</span>
                    <strong>{entry.count} explorers registered</strong>
                  </div>
                ))
              ) : (
                <div className="empty-state compact">No recorded registrations yet.</div>
              )}
            </div>
          </section>
        )}

        {/* ==================== EXPLORER PROFILE ==================== */}
        {page === 'profile' && (
          <section className="panel profile-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Feature 11 / Explorer Profile</span>
                <h2>Your story, your way.</h2>
                <p className="small-copy">Personal explorer card and activity history.</p>
              </div>
              <div className="profile-avatar" aria-hidden="true">
                {(currentUser?.name || 'E').trim().charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="profile-overview">
              <div>
                <span className="eyebrow">EXPLORER</span>
                <h3>{currentUser?.name || 'Guest Explorer'}</h3>
                <p>{currentUser?.email || 'Sign in to sync your profile and tickets across devices.'}</p>
                <span className="pill accent">{currentUser?.role || 'guest'} account</span>
              </div>
              <div className="profile-stats">
                <div><strong>{savedQuestIds.length}</strong><span>Saved quests</span></div>
                <div><strong>{questChains.length}</strong><span>Quest chains</span></div>
                <div><strong>{Object.values(reviewsByQuest).reduce((n, list) => n + list.length, 0)}</strong><span>Field notes</span></div>
                <div><strong>{achievements.filter((item) => item.earned).length}</strong><span>Badges</span></div>
              </div>
            </div>
            <form
              className="profile-form"
              onSubmit={(event) => {
                event.preventDefault();
                setToast('Explorer profile saved on this device.');
              }}
            >
              <label>
                Home city
                <input
                  maxLength="100"
                  value={profileDraft.city || ''}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, city: event.target.value }))}
                  placeholder="e.g. Bengaluru, Mumbai, Pune"
                />
              </label>
              <label>
                About your adventures
                <textarea
                  rows="4"
                  maxLength="280"
                  value={profileDraft.bio || ''}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, bio: event.target.value }))}
                  placeholder="What kinds of quests do you seek? (280 characters max)"
                />
              </label>
              <button className="primary-btn" type="submit">Save explorer profile</button>
            </form>
          </section>
        )}

        {/* ==================== PRIVACY POLICY ==================== */}
        {page === 'privacy' && (
          <section className="panel legal-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Privacy & Security</span>
                <h2>Your privacy is fundamental.</h2>
                <p className="small-copy">How SIDEQUEST protects your personal data and digital identity.</p>
              </div>
            </div>
            <div className="legal-content" style={{ display: 'grid', gap: '1.2rem', lineHeight: 1.6 }}>
              <article>
                <h3>1. Account & Security</h3>
                <p>We store passwords exclusively as salted scrypt cryptographic hashes. Plaintext passwords are never recorded in logs or persistent memory. Authentication sessions use secure, HttpOnly, SameSite cookies.</p>
              </article>
              <article>
                <h3>2. Location & Hyperlocal Queries</h3>
                <p>Device GPS coordinates are processed on your device to calculate distance offsets and are never sold or shared with third-party advertising brokers.</p>
              </article>
              <article>
                <h3>3. Ticketing & Payments</h3>
                <p>Payment verification utilizes tamper-proof HMAC-SHA256 digital signatures. All bookings are linked directly to your authenticated profile.</p>
              </article>
            </div>
          </section>
        )}

        {/* ==================== TERMS OF SERVICE ==================== */}
        {page === 'terms' && (
          <section className="panel legal-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Terms of Service</span>
                <h2>Platform Agreement & Community Standards</h2>
                <p className="small-copy">Guidelines for Explorers and Organizers using SIDEQUEST India.</p>
              </div>
            </div>
            <div className="legal-content" style={{ display: 'grid', gap: '1.2rem', lineHeight: 1.6 }}>
              <article>
                <h3>1. Verified Event Announcements</h3>
                <p>Event organizers represent that they possess the proper authorizations, licenses, and venue permissions for all published quests.</p>
              </article>
              <article>
                <h3>2. Admissions & Check-in</h3>
                <p>Digital tickets issued by SIDEQUEST are valid for admission subject to the venue’s entry rules. QR check-in codes are single-use per pass.</p>
              </article>
              <article>
                <h3>3. Trust & Safety Enforcement</h3>
                <p>Events reported for safety concerns, harassment, or misleading information are subject to immediate administrative review and moderation.</p>
              </article>
            </div>
          </section>
        )}

        {/* ==================== HELP & SUPPORT ==================== */}
        {page === 'help' && (
          <section className="panel legal-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Help & Support</span>
                <h2>Frequently Asked Questions</h2>
                <p className="small-copy">Quick guidance for booking tickets, finding quests, and managing events.</p>
              </div>
            </div>
            <div className="legal-content" style={{ display: 'grid', gap: '1.2rem', lineHeight: 1.6 }}>
              <article>
                <h3>How do digital tickets and QR codes work?</h3>
                <p>When you reserve or book a quest pass, a tamper-resistant ticket with an offline-compatible QR code is generated. View your tickets anytime under <a href="/bookings">My Bookings</a>.</p>
              </article>
              <article>
                <h3>How do I publish an event as an organizer?</h3>
                <p>Register an Organizer account, navigate to <a href="/publish">Publish Quest</a> or the <a href="/organizer">Organizer Hub</a>, fill in your venue and ticket tiers, and publish in under 60 seconds.</p>
              </article>
              <article>
                <h3>How do I report a safety concern?</h3>
                <p>Every event page has an inline "Report this event" form. You can also visit the <a href="/safety">Trust & Safety Portal</a> to submit reports directly to our moderation team.</p>
              </article>
            </div>
          </section>
        )}

        {page === 'onboarding' && (
          <section className="panel onboarding-page-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Explorer Setup</span>
                <h2>Customize Your Quest Radar</h2>
              </div>
            </div>
            {!currentUser ? (
              <AuthGate message="Sign in as an Explorer to customize your quest radar and hyperlocal preferences." next="/onboarding" />
            ) : (
              <div className="card text-center" style={{ padding: '2.5rem', maxWidth: '600px', margin: '2rem auto' }}>
                <h3>✨ Personalize Your Journey</h3>
                <p style={{ margin: '1rem 0 1.5rem', color: '#555' }}>
                  {currentUser.onboardingCompleted
                    ? `Currently exploring ${currentUser.preferredCity || 'India'} with preferences: ${currentUser.interests?.join(', ') || 'All categories'}.`
                    : 'Set up your home city and favorite categories to unlock instant recommendations and radar filters.'}
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button type="button" className="primary-btn" onClick={() => setShowOnboardingModal(true)}>
                    {currentUser.onboardingCompleted ? '⚙ Edit Preferences' : '✨ Start Setup'}
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => navigateTo('/quests')}>
                    Browse All Quests →
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {page === 'about' && (
          <section className="panel about-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Our Mission & Story</span>
                <h2>Your City. Your Next Quest.</h2>
                <p className="description">
                  India’s premier hyperlocal event discovery and verified ticketing platform.
                </p>
              </div>
            </div>

            <div className="about-pillars-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', margin: '1.5rem 0 2rem' }}>
              <div className="card" style={{ padding: '1.5rem', background: 'var(--sq-paper, #FFFCF4)', border: '1px solid var(--sq-border, #D9D0BD)', borderRadius: '14px' }}>
                <span style={{ fontSize: '1.75rem', display: 'block', marginBottom: '0.75rem' }}>🧭</span>
                <h3 style={{ margin: '0 0 0.5rem', color: 'var(--sq-deep, #183B2D)', fontFamily: 'var(--sq-display, Georgia, serif)' }}>Hyperlocal Discovery</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--sq-muted, #6F7065)' }}>
                  From developer hackathons in Koramangala to indie acoustic showcases in Bandra, uncover verified experiences happening right across Indian metro hubs.
                </p>
              </div>

              <div className="card" style={{ padding: '1.5rem', background: 'var(--sq-paper, #FFFCF4)', border: '1px solid var(--sq-border, #D9D0BD)', borderRadius: '14px' }}>
                <span style={{ fontSize: '1.75rem', display: 'block', marginBottom: '0.75rem' }}>🎟️</span>
                <h3 style={{ margin: '0 0 0.5rem', color: 'var(--sq-deep, #183B2D)', fontFamily: 'var(--sq-display, Georgia, serif)' }}>Verified Passes & QR Codes</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--sq-muted, #6F7065)' }}>
                  Instant digital pass issuance with tamper-resistant HMAC QR verification, dynamic pricing tiers, and real-time gate validation for organizers.
                </p>
              </div>

              <div className="card" style={{ padding: '1.5rem', background: 'var(--sq-paper, #FFFCF4)', border: '1px solid var(--sq-border, #D9D0BD)', borderRadius: '14px' }}>
                <span style={{ fontSize: '1.75rem', display: 'block', marginBottom: '0.75rem' }}>🛡️</span>
                <h3 style={{ margin: '0 0 0.5rem', color: 'var(--sq-deep, #183B2D)', fontFamily: 'var(--sq-display, Georgia, serif)' }}>Community & Safety</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--sq-muted, #6F7065)' }}>
                  Zero fake listings, genuine community field notes, built-in safety reporting, and transparent AI recommendations that respect user privacy.
                </p>
              </div>
            </div>
          </section>
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

            {/* Field Notes / Community Reviews */}
            <section className="safety-report-inline" aria-labelledby="field-notes-heading" style={{ marginTop: '1.2rem' }}>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Explorer Field Notes</span>
                  <h4 id="field-notes-heading">Tips & Stories from Attendees</h4>
                </div>
              </div>

              {(reviewsByQuest[detailEvent.id] || []).length > 0 ? (
                <div className="review-list" style={{ marginBottom: '1rem' }}>
                  {(reviewsByQuest[detailEvent.id] || []).map((review) => (
                    <article key={review.id} className="review-card" style={{ padding: '8px 12px', background: '#f5eedc', borderRadius: '8px', margin: '6px 0' }}>
                      <div className="review-meta" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <strong>{review.author}</strong>
                        <span>{'★'.repeat(Number(review.rating) || 5)}{'☆'.repeat(5 - (Number(review.rating) || 5))}</span>
                      </div>
                      <p style={{ margin: '4px 0', fontSize: '0.88rem' }}>{review.story}</p>
                      {review.tips ? <small style={{ color: 'var(--muted)', display: 'block' }}>💡 Tip: {review.tips}</small> : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="helper-text" style={{ margin: '6px 0' }}>No field notes yet. Be the first explorer to share tips!</p>
              )}

              <form className="review-form" onSubmit={submitQuestReview}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    Rating:
                    <select
                      value={reviewDraft.rating}
                      onChange={(e) => setReviewDraft({ ...reviewDraft, rating: e.target.value })}
                      style={{ marginLeft: '4px' }}
                    >
                      <option value="5">5 ★★★★★</option>
                      <option value="4">4 ★★★★☆</option>
                      <option value="3">3 ★★★☆☆</option>
                      <option value="2">2 ★★☆☆☆</option>
                      <option value="1">1 ★☆☆☆☆</option>
                    </select>
                  </label>
                </div>
                <label>
                  <span>Your experience / field note</span>
                  <textarea
                    rows="2"
                    maxLength={500}
                    value={reviewDraft.story}
                    onChange={(e) => setReviewDraft({ ...reviewDraft, story: e.target.value })}
                    placeholder="Share what the venue was like, vibe, tips for other explorers…"
                  />
                </label>
                <label>
                  <span>Quick tip (optional)</span>
                  <input
                    maxLength={140}
                    value={reviewDraft.tips}
                    onChange={(e) => setReviewDraft({ ...reviewDraft, tips: e.target.value })}
                    placeholder="e.g. Arrive early for parking, bring water bottle"
                  />
                </label>
                <button type="submit" className="secondary-btn btn-sm">Post field note</button>
                {reviewMessage && <p className="helper-text" role="status">{reviewMessage}</p>}
                {partyMessage && <p className="helper-text" role="status">{partyMessage}</p>}
              </form>
            </section>

            <div className="card-actions modal-actions" style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => handlePartyUp(detailEvent)}
              >
                📣 Share Quest
              </button>
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
                  setActiveChainId(active.id);
                  const alreadyIn = (active.stops || []).some((stop) => String(stop.eventId) === String(detailEvent.id));
                  setToast(alreadyIn ? 'This quest is already in the active chain.' : `Added "${detailEvent.title}" to "${active.title}".`);
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

      {/* EXPLORER ONBOARDING MODAL */}
      {showOnboardingModal && (
        <ExplorerOnboardingModal
          currentUser={currentUser}
          onDismiss={() => setShowOnboardingModal(false)}
          onComplete={(updatedUser) => {
            setCurrentUser(updatedUser);
            setShowOnboardingModal(false);
            setToast('Explorer preferences saved! Quests updated.');
            if (updatedUser.preferredCity) {
              setSelectedCity(updatedUser.preferredCity);
            }
            if (updatedUser.interests?.length) {
              setSelectedInterests(updatedUser.interests);
            }
          }}
        />
      )}

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
