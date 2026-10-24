import { useEffect, useMemo, useState } from 'react';
import { createEvent, getEvents, getRecommendations, getInsights, registerForEvent, registerAccount, loginAccount, getCurrentUser, logoutAccount, getHealth, getEventById, getMyRegistrations, submitReport, getMyReports } from './services/api';
import BrandLogo from './components/BrandLogo';
import WorldMap from './components/map/WorldMap';
import { addEventToChain, createQuestChain, estimateChainSummary, moveChainStop, removeChainStop } from './lib/questChains';
import { rankRadarQuests } from './lib/questRadar';
import { getMysteryQuest } from './lib/mysteryQuest';
import { getAchievements } from './lib/achievements';
import { createLocalReview, validateReviewDraft } from './lib/community';
import { rankSmartRecommendations } from './lib/smartRecommendations';
import { getExplorerLevel } from './lib/gamification';
import { answerAdventureQuestion } from './lib/adventureAssistant';
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
  const authQuery = new URLSearchParams(window.location.search);
  const nextPath = authQuery.get('next');
  const switchHref = `${isRegister ? '/login' : '/register'}${nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//') ? `?next=${encodeURIComponent(nextPath)}` : ''}`;
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
          <BrandLogo variant="full" />
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
          <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to SIDEQUEST?'} <a href={switchHref}>{isRegister ? 'Sign in' : 'Create an account'}</a></p>
          <p className="helper-text">Prototype note: use a unique password. Never reuse your important personal password in a demo environment.</p>
        </main>
      </div>
    </div>
  );
}

function MainApp() {
  const pathname = window.location.pathname.replace(/\/$/, '') || '/';
  const detailRouteId = pathname.match(/^\/quests\/([^/]+)$/)?.[1] || '';
  const page = detailRouteId ? 'quest-detail' : (({ '/quests': 'quests', '/nearby': 'nearby', '/recommended': 'recommended', '/saved': 'saved', '/radar': 'radar', '/chains': 'chains', '/reminders': 'reminders', '/mystery': 'mystery', '/achievements': 'achievements', '/profile': 'profile', '/chat': 'chat', '/calendar': 'calendar', '/levels': 'levels', '/publish': 'publish', '/insights': 'insights', '/organizer': 'organizer', '/bookings': 'bookings', '/safety': 'safety', '/assistant': 'assistant' })[pathname] || 'home');
  const [currentUser, setCurrentUser] = useState(null);
  const [reviewDraft, setReviewDraft] = useState({ rating: '5', story: '', tips: '' });
  const [reviewsByQuest, setReviewsByQuest] = useState(() => { try { const value = JSON.parse(window.localStorage.getItem('sidequest-reviews') || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; } });
  const [profileDraft, setProfileDraft] = useState(() => { try { return JSON.parse(window.localStorage.getItem('sidequest-profile') || '{"bio":"","city":"","visibility":"public"}'); } catch { return { bio: '', city: '', visibility: 'public' }; } });
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
    } catch (storageError) {
      console.warn('Interest preferences could not be loaded.', storageError);
      return ['Music', 'Technology'];
    }
  });
  const [selectedCity, setSelectedCity] = useState('Bengaluru');
  const [selectedLocality, setSelectedLocality] = useState('Koramangala');
  const [radarFilters, setRadarFilters] = useState({ timeframe: 'next7days', category: 'all', city: 'all', locality: 'all', radiusKm: '25', sort: 'match' });
  const [mysteryPick, setMysteryPick] = useState(null);
  const [mysteryFilters, setMysteryFilters] = useState({ city: 'all', category: 'all', time: 'any' });
  const [mysteryRevealCount, setMysteryRevealCount] = useState(() => { try { return Math.max(0, Number(window.localStorage.getItem('sidequest-mystery-reveals')) || 0); } catch { return 0; } });
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState(() => {
    try {
      const stored = Number(window.localStorage.getItem('sidequest-reminder-lead-minutes'));
      return [15, 30, 60, 1440].includes(stored) ? stored : 60;
    } catch { return 60; }
  });
  const [remindersEnabled, setRemindersEnabled] = useState(() => {
    try { return window.localStorage.getItem('sidequest-reminders-enabled') === 'true'; }
    catch { return false; }
  });
  const [reminderStatus, setReminderStatus] = useState('');
  const [reminderNow, setReminderNow] = useState(() => Date.now());
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
  const [assistantMessages, setAssistantMessages] = useState(() => { try { const value = JSON.parse(window.localStorage.getItem('sidequest-assistant-messages') || '[]'); return Array.isArray(value) ? value.slice(-30) : []; } catch { return []; } });
  const [chatMessages, setChatMessages] = useState(() => { try { const v = JSON.parse(window.localStorage.getItem('sidequest-party-chat') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } });
  const [chainShareFallback, setChainShareFallback] = useState('');
  const [questChains, setQuestChains] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('sidequest-quest-chains') || '[]');
      return Array.isArray(stored) ? stored.filter((chain) => chain && typeof chain.id === 'string' && typeof chain.title === 'string' && Array.isArray(chain.stops)) : [];
    } catch (storageError) {
      console.warn('Quest Chains could not be loaded from this device.', storageError);
      return [];
    }
  });
  const [activeChainId, setActiveChainId] = useState(() => {
    try { return window.localStorage.getItem('sidequest-active-chain') || ''; }
    catch (storageError) { console.warn('Active Quest Chain could not be restored.', storageError); return ''; }
  });
  const activeQuestChain = useMemo(() => questChains.find((chain) => chain.id === activeChainId) || questChains[0] || null, [questChains, activeChainId]);
  const achievementStats = useMemo(() => ({ savedCount: savedQuestIds.length, chainCount: questChains.length, chainStops: questChains.reduce((total, chain) => total + chain.stops.length, 0), mysteryRevealCount }), [savedQuestIds, questChains, mysteryRevealCount]);
  const achievements = useMemo(() => getAchievements(achievementStats), [achievementStats]);
  const [newChainTitle, setNewChainTitle] = useState('');
  const [chainError, setChainError] = useState('');
  const [toast, setToast] = useState('');
  const smartRecommendations = useMemo(() => rankSmartRecommendations(recommendations.length ? recommendations : allEvents, { interests: selectedInterests, savedIds: savedQuestIds, city: selectedCity, now: new Date() }), [recommendations, allEvents, selectedInterests, savedQuestIds, selectedCity]);
  const explorerLevel = useMemo(() => getExplorerLevel({ saved: savedQuestIds.length, reviews: Object.values(reviewsByQuest).reduce((n, list) => n + (list || []).length, 0), chainStops: questChains.reduce((n, chain) => n + chain.stops.length, 0), reveals: mysteryRevealCount, chatMessages: chatMessages.length }), [savedQuestIds, reviewsByQuest, questChains, mysteryRevealCount, chatMessages]);
  const [viewMode, setViewMode] = useState(page === 'quests' ? 'list' : 'map');
  const [mapSelectedId, setMapSelectedId] = useState(null);
  const [dailyPickIndex, setDailyPickIndex] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('sidequest-daily-pick') || 'null');
      const today = new Date().toLocaleDateString('en-CA');
      return stored?.date === today && Number.isInteger(stored.index) && stored.index >= 0 ? stored.index : 0;
    } catch (storageError) {
      console.warn('Daily pick could not be restored.', storageError);
      return 0;
    }
  });

  useEffect(() => {
    if (!detailRouteId) return undefined;
    let active = true;
    getEventById(decodeURIComponent(detailRouteId)).then((response) => { if (active) { setDetailEvent(response.event); setDetailRouteError(''); } }).catch((loadError) => { if (active) setDetailRouteError(loadError.message || 'This quest could not be found.'); });
    return () => { active = false; };
  }, [detailRouteId]);

  useEffect(() => {
    try {
      window.localStorage.setItem('sidequest-interests', JSON.stringify(selectedInterests));
    } catch (storageError) {
      console.warn('Interest preferences could not be saved.', storageError);
    }
  }, [selectedInterests]);

  useEffect(() => {
    try {
      window.localStorage.setItem('sidequest-daily-pick', JSON.stringify({
        date: new Date().toLocaleDateString('en-CA'),
        index: dailyPickIndex,
      }));
    } catch (storageError) {
      console.warn('Daily pick could not be saved.', storageError);
    }
  }, [dailyPickIndex]);

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
    if (page !== 'bookings' || !currentUser) return;
    let active = true;
    setBookingsLoading(true); setBookingsError('');
    getMyRegistrations().then((response) => { if (active) setMyBookings(response.bookings || []); })
      .catch((error) => { if (active) setBookingsError(error.message || 'Could not load your bookings.'); })
      .finally(() => { if (active) setBookingsLoading(false); });
    return () => { active = false; };
  }, [page, currentUser]);

  useEffect(() => {
    if (page !== 'safety' || !currentUser) return;
    let active = true;
    setMyReportsError('');
    getMyReports().then((response) => { if (active) setMyReports(response.reports || []); })
      .catch((error) => { if (active) setMyReportsError(error.message || 'Could not load your reports.'); });
    return () => { active = false; };
  }, [page, currentUser]);

  useEffect(() => {
    try { window.localStorage.setItem('sidequest-mystery-reveals', String(mysteryRevealCount)); } catch (storageError) { console.warn('Mystery Quest progress could not be saved.', storageError); }
  }, [mysteryRevealCount]);

  useEffect(() => {
    try { window.localStorage.setItem('sidequest-reviews', JSON.stringify(reviewsByQuest)); } catch (storageError) { console.warn('Reviews could not be saved on this device.', storageError); }
  }, [reviewsByQuest]);

  useEffect(() => {
    try { window.localStorage.setItem('sidequest-party-chat', JSON.stringify(chatMessages)); } catch (storageError) { console.warn('Party chat could not be saved on this device.', storageError); }
  }, [chatMessages]);

  useEffect(() => {
    try { window.localStorage.setItem('sidequest-assistant-messages', JSON.stringify(assistantMessages.slice(-30))); } catch (storageError) { console.warn('Assistant conversation could not be saved on this device.', storageError); }
  }, [assistantMessages]);

  useEffect(() => {
    try { window.localStorage.setItem('sidequest-profile', JSON.stringify(profileDraft)); } catch (storageError) { console.warn('Profile could not be saved on this device.', storageError); }
  }, [profileDraft]);

  useEffect(() => {
    try {
      window.localStorage.setItem('sidequest-saved', JSON.stringify(savedQuestIds));
    } catch (storageError) {
      console.warn('Saved quests could not be stored on this device.', storageError);
    }
  }, [savedQuestIds]);


  useEffect(() => {
    try {
      window.localStorage.setItem('sidequest-quest-chains', JSON.stringify(questChains));
    } catch (storageError) {
      console.warn('Quest Chains could not be saved on this device.', storageError);
      setToast('Quest Chains could not be saved. Check this browser’s storage settings.');
    }
  }, [questChains]);

  useEffect(() => {
    try { window.localStorage.setItem('sidequest-active-chain', activeChainId); }
    catch (storageError) { console.warn('Active Quest Chain could not be saved.', storageError); }
  }, [activeChainId]);

  useEffect(() => {
    try {
      window.localStorage.setItem('sidequest-reminder-lead-minutes', String(reminderLeadMinutes));
      window.localStorage.setItem('sidequest-reminders-enabled', String(remindersEnabled));
    } catch (storageError) {
      console.warn('Reminder preferences could not be saved on this device.', storageError);
    }
  }, [reminderLeadMinutes, remindersEnabled]);

  useEffect(() => {
    if (!remindersEnabled) return undefined;
    const intervalId = window.setInterval(() => setReminderNow(Date.now()), 30000);
    return () => window.clearInterval(intervalId);
  }, [remindersEnabled]);

  const reminderItems = useMemo(() => {
    const now = reminderNow;
    const leadMs = reminderLeadMinutes * 60 * 1000;
    const upcoming = allEvents.filter((event) => savedQuestIds.some((id) => String(id) === String(event.id)) && event.date)
      .map((event) => ({ event, start: new Date(`${event.date}T${event.startTime || '09:00'}:00`).getTime() }))
      .filter((item) => Number.isFinite(item.start) && item.start > now)
      .sort((a, b) => a.start - b.start);
    return upcoming.map((item) => ({
      ...item,
      reminderAt: item.start - leadMs,
      status: now >= item.start - leadMs ? 'due' : 'scheduled',
      minutesUntil: Math.max(0, Math.round((item.start - now) / 60000)),
    }));
  }, [allEvents, savedQuestIds, reminderLeadMinutes, reminderNow]);

  useEffect(() => {
    if (!remindersEnabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const notifiedKey = 'sidequest-reminder-notified';
    let notified = [];
    try { notified = JSON.parse(window.localStorage.getItem(notifiedKey) || '[]'); } catch { notified = []; }
    if (!Array.isArray(notified)) notified = [];
    const now = reminderNow;
    const leadMs = reminderLeadMinutes * 60 * 1000;
    const fresh = reminderItems.filter((item) => now >= item.start - leadMs && now < item.start && !notified.includes(String(item.event.id)));
    for (const item of fresh) {
      try {
        const note = new Notification(`Quest coming up: ${item.event.title}`, {
          body: `${formatEventDateTime(item.event)} · ${[item.event.locality, item.event.city].filter(Boolean).join(', ') || 'Open SIDEQUEST for details'}`,
          tag: `sidequest-reminder-${item.event.id}`,
        });
        note.onclick = () => { window.focus(); window.location.assign(`/quests/${encodeURIComponent(item.event.id)}`); };
        notified.push(String(item.event.id));
      } catch (notificationError) {
        console.warn('A browser reminder could not be shown.', notificationError);
      }
    }
    if (fresh.length) {
      try { window.localStorage.setItem(notifiedKey, JSON.stringify(notified.slice(-300))); } catch { /* keep the current session working */ }
    }
  }, [remindersEnabled, reminderItems, reminderLeadMinutes, reminderNow]);

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

  useEffect(() => {
    if (!detailEvent) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') { setDetailEvent(null); if (page === 'quest-detail') window.location.assign('/quests'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailEvent, page]);

  useEffect(() => {
    if (mapSelectedId && !loading && !events.some((item) => String(item.id) === String(mapSelectedId))) setMapSelectedId(null);
  }, [events, loading, mapSelectedId]);

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

  const radarQuests = useMemo(() => rankRadarQuests(allEvents, {
    ...radarFilters,
    interests: selectedInterests,
    userCoordinates,
    now: new Date(),
  }), [allEvents, radarFilters, selectedInterests, userCoordinates]);

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

  const submitSafetyReport = async (event) => {
    event.preventDefault();
    if (!currentUser) { window.location.assign('/login?next=%2Fsafety'); return; }
    if (!detailEvent) return;
    setReportBusy(true); setReportMessage('');
    try {
      const response = await submitReport({ targetType: 'event', targetId: String(detailEvent.id), reason: reportDraft.reason, details: reportDraft.details });
      setReportMessage(response.message || 'Report received.');
      setReportDraft({ reason: 'unsafe', details: '' });
    } catch (error) { setReportMessage(error.message || 'Could not submit the report.'); }
    finally { setReportBusy(false); }
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

  const handlePartyUp = async (event) => {
    const inviteUrl = new URL(`/quests/${encodeURIComponent(event.id)}`, window.location.origin).href;
    const inviteText = `Want to join me for ${event.title}?\n${formatEventDateTime(event)}\n${event.venue ? `${event.venue}, ` : ''}${event.locality ? `${event.locality}, ` : ''}${event.city || ''}\nQuest details: ${inviteUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Party up for ${event.title}`, text: inviteText, url: inviteUrl });
        setToast('Invite ready to share.');
        setPartyMessage('');
        return;
      }
      await navigator.clipboard.writeText(inviteText);
      setToast('Invite message copied. Send it to your crew!');
      setPartyMessage('');
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
        <BrandLogo variant="compact" tagline />
        <nav className="nav" aria-label="Main navigation">
          <a href="/quests" aria-current={page === 'quests' ? 'page' : undefined}>Quest Board</a>
          <a href="/nearby" aria-current={page === 'nearby' ? 'page' : undefined}>Nearby</a>
          <a href="/radar" aria-current={page === 'radar' ? 'page' : undefined}>Quest Radar</a>
          <a href="/recommended" aria-current={page === 'recommended' ? 'page' : undefined}>For You</a>
          <a href="/saved" aria-current={page === 'saved' ? 'page' : undefined}>Saved</a>
          <a href="/chains" aria-current={page === 'chains' ? 'page' : undefined}>Quest Chains</a>
          <a href="/reminders" aria-current={page === 'reminders' ? 'page' : undefined}>Reminders</a>
          <a href="/mystery" aria-current={page === 'mystery' ? 'page' : undefined}>Mystery Quest</a>
          <a href="/achievements" aria-current={page === 'achievements' ? 'page' : undefined}>Achievements</a>
          <a href="/profile" aria-current={page === 'profile' ? 'page' : undefined}>Explorer Profile</a>
          <a href="/chat" aria-current={page === 'chat' ? 'page' : undefined}>Party Chat</a>
          <a href="/calendar" aria-current={page === 'calendar' ? 'page' : undefined}>Quest Calendar</a>
          <a href="/levels" aria-current={page === 'levels' ? 'page' : undefined}>Explorer XP</a>
          <a href="/publish" aria-current={page === 'publish' ? 'page' : undefined}>Publish</a>
          <a href="/organizer" aria-current={page === 'organizer' ? 'page' : undefined}>Organizer Hub</a>
          <a href="/bookings" aria-current={page === 'bookings' ? 'page' : undefined}>My Bookings</a><a href="/safety" aria-current={page === 'safety' ? 'page' : undefined}>Safety & Reports</a><a href="/assistant" aria-current={page === 'assistant' ? 'page' : undefined}>Adventure AI</a>
          <span className={`system-status ${backendHealth?.database === 'mongodb' ? 'is-connected' : backendHealth?.database === 'memory' ? 'is-demo' : ''}`} title={backendHealth?.database === 'mongodb' ? 'MongoDB connection is active' : backendHealth?.database === 'memory' ? 'Data is stored in memory and resets when the backend restarts' : 'Backend status unknown'}>{backendHealth?.database === 'mongodb' ? '● MongoDB' : backendHealth?.database === 'memory' ? '● Demo data' : '● Checking API'}</span>
          {currentUser ? <span className="nav-user">Hi, {currentUser.name.split(' ')[0]}</span> : null}
          {currentUser ? <button type="button" className="nav-auth-btn" onClick={async () => { await logoutAccount().catch(() => {}); window.location.assign('/'); }}>Sign out</button> : <><a href="/login">Sign in</a><a className="nav-register" href="/register">Join</a></>}
        </nav>
      </header>

      <main className="page-shell">
        {page !== 'home' ? <div className="route-heading"><span className="eyebrow">SIDEQUEST / {page.replace('-', ' ')}</span><h1>{({ quests: 'Find your next quest', nearby: 'Explore nearby', recommended: 'Picked for your interests', saved: 'Your saved quests', radar: 'Find a quest that fits your plans', chains: 'Build a mini-adventure', reminders: 'Never miss a saved quest', mystery: 'Let fate choose your next quest', achievements: 'Your adventure milestones', profile: 'Your explorer profile', chat: 'Coordinate with your party', calendar: 'Your quest calendar', levels: 'Your explorer journey', publish: 'Create a new quest', insights: 'Community field notes', organizer: 'Organizer dashboard', bookings: 'Your bookings & tickets', safety: 'Trust, safety & reports', assistant: 'Your AI adventure guide', 'quest-detail': 'Quest details' })[page] || 'Explore SIDEQUEST'}</h1><p className="description">Every city has a story you have not discovered yet.</p></div> : null}
        {page === 'quest-detail' && detailRouteError ? <div className="message error-message">{detailRouteError} <a href="/quests">Return to the Quest Board</a></div> : null}
        {page === 'home' && <section className="hero-section sq-hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" /> Your City. Your Next Quest.</span>
            <h1 id="hero-title">Your next adventure is <em>closer than you think.</em></h1>
            <p>Discover workshops, music nights, hackathons and gatherings in your city, pinned to an explorer&rsquo;s map. Life is the main quest; these are the sidequests.</p>
            <div className="hero-actions">
              <a href="#quest-board" className="primary-btn">Explore the Map</a>
              <a href="/nearby" className="secondary-btn">Find Quests Near Me</a>
              <a href="/radar" className="secondary-btn">Open Quest Radar</a>
              <a href="/mystery" className="secondary-btn">Surprise me</a>
            </div>
          </div>
          <div className="hero-panel sq-hero-stats" aria-label="Quest summary">
            <div className="stat-block"><strong>{allEvents.length || 0}</strong><span>Upcoming quests</span></div>
            <div className="stat-block"><strong>{cityOptions.length || 0}</strong><span>{cityOptions.length === 1 ? 'City' : 'Cities'}</span></div>
            <div className="stat-block"><strong>{savedQuestIds.length || 0}</strong><span>Saved quests</span></div>
          </div>
        </section>}

        {(page === 'home' || page === 'quests') && <section id="quest-board" className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Chapter 02 / The Quest Board</span>
              <h2>A little adventure is waiting.</h2>
              <p className="small-copy">Browse the local happenings pinned along your path.</p>
            </div>
            <button type="button" className="ghost-btn" onClick={clearFilters}>Clear filters</button>
          </div>

          <div className="quest-trail-picker" aria-label="Quick quest category filters">
            <button type="button" className={filters.category === 'all' ? 'trail-chip active' : 'trail-chip'} onClick={() => setFilters((current) => ({ ...current, category: 'all' }))}>✦ All quests</button>
            {['Music', 'Technology', 'Sports', 'Art and culture', 'Gaming'].map((category) => (
              <button key={category} type="button" className={filters.category === category ? 'trail-chip active' : 'trail-chip'} onClick={() => setFilters((current) => ({ ...current, category }))}>{categorySymbol(category)} {category}</button>
            ))}
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

          <div className="board-toolbar">
            <div className="view-toggle" role="group" aria-label="Choose how to view quests">
              <button type="button" aria-pressed={viewMode === 'map'} onClick={() => setViewMode('map')}>Map</button>
              <button type="button" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}>List</button>
            </div>
            <span className="board-count" aria-live="polite">{loading ? 'Loading quests…' : `${events.length} quest${events.length === 1 ? '' : 's'} ${viewMode === 'map' ? 'on the map' : 'in the list'}`}</span>
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
              <div className="empty-state compact"><strong>Your next quest is still out there.</strong><br />No upcoming quests match these preferences right now. Try another interest or locality, or check back when new quests are published.</div>
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
        </section>}

        {page === 'radar' && <section id="quest-radar" className="panel radar-panel">
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
          <div className="radar-toolbar"><div><strong>{radarQuests.length}</strong> quest{radarQuests.length === 1 ? '' : 's'} found<span className="helper-text"> {userCoordinates ? 'Using your browser location for distance-based matching.' : 'Choose “Use my location” to enable distance filters; location is used in this session only.'}</span></div><div className="radar-actions"><button type="button" className="secondary-btn" onClick={requestUserLocation} disabled={locating}>{locating ? 'Finding location…' : userCoordinates ? 'Refresh location' : 'Use my location'}</button><button type="button" className="ghost-btn" onClick={() => setRadarFilters({ timeframe: 'next7days', category: 'all', city: 'all', locality: 'all', radiusKm: '25', sort: 'match' })}>Reset radar</button></div></div>
          {locationStatus ? <p className="message compact" role="status">{locationStatus}</p> : null}
          {radarQuests.length === 0 ? <div className="empty-state radar-empty"><strong>No signal yet.</strong><br />Try a wider time window, another category, or a different area.</div> : <div className="radar-results">{radarQuests.map((item) => <article className="radar-result" key={item.event.id}><div className={`radar-result-symbol visual-${categoryOptions.indexOf(item.event.category) < 0 ? 0 : categoryOptions.indexOf(item.event.category) % 6}`}>{categorySymbol(item.event.category)}</div><div className="radar-result-main"><div className="radar-result-top"><span className="pill accent">{item.event.category || 'Community quest'}</span>{item.matchLabel ? <span className="radar-match-label">{item.matchLabel}</span> : null}</div><h3>{item.event.title}</h3><p className="small-copy">{formatEventDateTime(item.event)} · {[item.event.venue, item.event.locality, item.event.city].filter(Boolean).join(', ') || 'Location details unavailable'}</p><p className="radar-reason">{item.reasons.join(' · ')}</p><div className="radar-result-actions"><button type="button" className="primary-btn" onClick={() => setDetailEvent(item.event)}>View quest</button><button type="button" className={savedQuestIds.includes(item.event.id) ? 'save-btn active' : 'save-btn'} onClick={() => toggleSavedQuest(item.event)}>{savedQuestIds.includes(item.event.id) ? '✓ Saved' : '＋ Save quest'}</button>{item.distanceKm !== null ? <span className="radar-distance">{item.distanceKm.toFixed(1)} km away</span> : null}</div></div></article>)}</div>}
        </section>}

        {page === 'profile' && <section className="panel profile-panel">
          <div className="section-heading"><div><span className="eyebrow">Feature 11 / Explorer Profile</span><h2>Your story, your way.</h2><p className="small-copy">Create a lightweight explorer card. Profile details stay on this browser in this prototype.</p></div><div className="profile-avatar" aria-hidden="true">{(currentUser?.name || 'E').trim().charAt(0).toUpperCase()}</div></div>
          <div className="profile-overview"><div><span className="eyebrow">EXPLORER</span><h3>{currentUser?.name || 'Guest Explorer'}</h3><p>{currentUser?.email || 'Sign in to associate activity with your account.'}</p><span className="pill accent">{currentUser?.role || 'guest'} account</span></div><div className="profile-stats"><div><strong>{savedQuestIds.length}</strong><span>Saved quests</span></div><div><strong>{questChains.length}</strong><span>Quest chains</span></div><div><strong>{Object.values(reviewsByQuest).reduce((n, list) => n + list.length, 0)}</strong><span>Field notes</span></div><div><strong>{achievements.filter((item) => item.earned).length}</strong><span>Badges</span></div></div></div>
          <form className="profile-form" onSubmit={(event) => { event.preventDefault(); setToast('Explorer profile saved on this device.'); }}>
            <label>Home city<input maxLength="100" value={profileDraft.city || ''} onChange={(event) => setProfileDraft((current) => ({ ...current, city: event.target.value }))} placeholder="e.g. Mumbai" /></label>
            <label>About your adventures<textarea rows="4" maxLength="280" value={profileDraft.bio || ''} onChange={(event) => setProfileDraft((current) => ({ ...current, bio: event.target.value }))} placeholder="What kind of experiences do you love? (280 characters max)" /></label>
            <label>Profile visibility<select value={profileDraft.visibility || 'public'} onChange={(event) => setProfileDraft((current) => ({ ...current, visibility: event.target.value }))}><option value="public">Public-style preview</option><option value="private">Private — only show on this device</option></select></label>
            <button className="primary-btn" type="submit">Save explorer profile</button>
          </form>
          <div className="section-heading profile-activity-heading"><div><span className="eyebrow">RECENT FIELD NOTES</span><h3>Your community stories</h3></div></div>
          {Object.entries(reviewsByQuest).flatMap(([questId, list]) => (list || []).filter((review) => review.author === (currentUser?.name || 'Local Explorer')).map((review) => ({ ...review, questId }))).slice(0, 6).length ? <div className="review-list">{Object.entries(reviewsByQuest).flatMap(([questId, list]) => (list || []).filter((review) => review.author === (currentUser?.name || 'Local Explorer')).map((review) => ({ ...review, questId }))).slice(0, 6).map((review) => <article className="review-card" key={review.id}><div className="review-meta"><strong>{review.author}</strong><span>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span></div><p>{review.story}</p>{review.tips ? <small>Explorer tip: {review.tips}</small> : null}<a href={`/quests/${encodeURIComponent(review.questId)}`}>Open related quest ↗</a></article>)}</div> : <div className="empty-state"><strong>Your field notes will appear here.</strong><br />Open a quest and share your first experience.</div>}
        </section>}

        {page === 'achievements' && <section id="achievements" className="panel achievements-panel">
          <div className="section-heading"><div><span className="eyebrow">Feature 09 / Explorer Achievements</span><h2>Every little adventure counts.</h2><p className="small-copy">Your milestones are calculated from your saved quests, Quest Chains, and Mystery Quest reveals on this browser.</p></div><span className="achievement-emblem" aria-hidden="true">✺</span></div>
          <div className="achievement-summary"><div><strong>{achievements.filter((badge) => badge.earned).length}/{achievements.length}</strong><span>Badges earned</span></div><div><strong>{savedQuestIds.length}</strong><span>Saved quests</span></div><div><strong>{questChains.reduce((total, chain) => total + chain.stops.length, 0)}</strong><span>Planned stops</span></div><div><strong>{mysteryRevealCount}</strong><span>Mystery reveals</span></div></div>
          <div className="achievement-grid">{achievements.map((badge) => <article key={badge.id} className={badge.earned ? 'achievement-card earned' : 'achievement-card'}><div className="achievement-icon" aria-hidden="true">{badge.earned ? badge.icon : '◇'}</div><div className="achievement-copy"><div className="achievement-status">{badge.earned ? '✦ UNLOCKED' : 'STILL IN THE MAKING'}</div><h3>{badge.title}</h3><p>{badge.description}</p><div className="achievement-progress" role="progressbar" aria-label={`${badge.title} progress`} aria-valuemin="0" aria-valuemax={badge.target} aria-valuenow={badge.progress}><span style={{ width: `${badge.percent}%` }} /></div><small>{badge.progress}/{badge.target} progress</small></div></article>)}</div>
          <p className="helper-text achievement-note">Progress is stored locally in this browser and is not synced to your account or other devices. Registration and attendance badges are not included because the current app does not yet expose a reliable personal attendance history.</p>
        </section>}

        {page === 'mystery' && <section id="mystery-quest" className="panel mystery-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Feature 08 / Mystery Quest</span>
              <h2>Leave the next move to fate.</h2>
              <p className="small-copy">Set a couple of boundaries, then reveal an upcoming quest picked from real events on your board. Your interests gently influence the pick—but surprise is part of the fun.</p>
            </div>
            <span className="mystery-emblem" aria-hidden="true">?</span>
          </div>
          <div className="mystery-rules">
            <label><span>City</span><select value={mysteryFilters.city} onChange={(event) => { setMysteryFilters((current) => ({ ...current, city: event.target.value })); setMysteryPick(null); }}><option value="all">Any city</option>{cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
            <label><span>Quest type</span><select value={mysteryFilters.category} onChange={(event) => { setMysteryFilters((current) => ({ ...current, category: event.target.value })); setMysteryPick(null); }}><option value="all">Anything goes</option>{categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
            <label><span>Time window</span><select value={mysteryFilters.time} onChange={(event) => { setMysteryFilters((current) => ({ ...current, time: event.target.value })); setMysteryPick(null); }}><option value="any">Any upcoming date</option><option value="today">Today</option><option value="weekend">This weekend</option><option value="next7days">Next 7 days</option></select></label>
          </div>
          <div className="mystery-interest-note"><strong>Your interests:</strong> {selectedInterests.length ? selectedInterests.join(' · ') : 'No interests selected—this will be a true wildcard.'} <a href="/radar">Adjust interests in Quest Radar</a></div>
          <div className="mystery-reveal-stage">
            {!mysteryPick ? <><span className="mystery-sigil" aria-hidden="true">✦</span><p className="eyebrow">The next quest is hidden</p><h3>Ready for an unexpected plan?</h3><p className="small-copy">We’ll choose from future events that match your filters and show you why the pick made the list.</p><button type="button" className="primary-btn mystery-draw-btn" onClick={() => { const result = getMysteryQuest(allEvents, { interests: selectedInterests, city: mysteryFilters.city, category: mysteryFilters.category, timeframe: mysteryFilters.time, now: new Date() }); setMysteryPick(result); setMysteryRevealCount((count) => count + 1); }}>{mysteryRevealCount ? 'Draw another quest' : 'Reveal my quest'}</button></> : <>
              <span className="eyebrow">{mysteryPick ? 'Your mystery quest is revealed' : 'The next quest is hidden'}</span>
              {mysteryPick ? <article className="mystery-result">
                <div className={`radar-result-symbol visual-${categoryOptions.indexOf(mysteryPick.event.category) < 0 ? 0 : categoryOptions.indexOf(mysteryPick.event.category) % 6}`}>{categorySymbol(mysteryPick.event.category)}</div>
                <div className="mystery-result-copy"><span className="pill accent">{mysteryPick.event.category || 'Community quest'}</span><h3>{mysteryPick.event.title}</h3><p className="small-copy">{formatEventDateTime(mysteryPick.event)} · {[mysteryPick.event.venue, mysteryPick.event.locality, mysteryPick.event.city].filter(Boolean).join(', ') || 'Location details unavailable'}</p><div className="mystery-reasons"><strong>Why this quest?</strong>{mysteryPick.reasons.map((reason) => <span key={reason}>✦ {reason}</span>)}<span>Chosen from {mysteryPick.candidatesCount} eligible upcoming quest{mysteryPick.candidatesCount === 1 ? '' : 's'}.</span></div><div className="mystery-actions"><button type="button" className="primary-btn" onClick={() => setDetailEvent(mysteryPick.event)}>View quest</button><button type="button" className={savedQuestIds.some((id) => String(id) === String(mysteryPick.event.id)) ? 'save-btn active' : 'save-btn'} onClick={() => toggleSavedQuest(mysteryPick.event)}>{savedQuestIds.some((id) => String(id) === String(mysteryPick.event.id)) ? '✓ Saved' : '＋ Save quest'}</button><button type="button" className="secondary-btn" onClick={() => { const result = getMysteryQuest(allEvents, { interests: selectedInterests, city: mysteryFilters.city, category: mysteryFilters.category, timeframe: mysteryFilters.time, now: new Date() }); setMysteryPick(result); setMysteryRevealCount((count) => count + 1); }}>Try another</button></div></div>
              </article> : null}
            </>}
            {mysteryPick === null && allEvents.length === 0 ? <p className="helper-text">Events are still loading. The reveal will be available once quests have loaded.</p> : null}
            {mysteryPick !== null && !mysteryPick ? <div className="empty-state mystery-empty"><strong>No quest fits those boundaries.</strong><br />Try another city, category, or time window to widen the mystery.</div> : null}
          </div>
          <p className="helper-text mystery-disclaimer">Mystery Quest only picks from events currently available in SIDEQUEST. The reveal is random among eligible quests, with a gentle preference for your chosen interests.</p>
        </section>}

        {page === 'assistant' && <section className="panel feature-panel assistant-panel">
          <div className="section-heading"><div><span className="eyebrow">Feature 19 / Adventure Assistant</span><h2>Plan a little adventure.</h2><p className="small-copy">Ask for ideas, compare upcoming quests, or get a starting point for a day out. This version uses a transparent local matching engine over SIDEQUEST’s event list; it does not call an external AI model.</p></div><span className="feature-emblem">✧</span></div>
          <div className="assistant-disclaimer"><strong>Explorer note</strong><span>Recommendations depend on the event details currently available. Check dates, venue, accessibility, and ticket prices with the organizer before making plans.</span></div>
          <div className="assistant-prompts" aria-label="Suggested questions">{['Find live music this weekend','Suggest a technology event','Help me plan something affordable','Show me something new'].map((prompt) => <button type="button" className="interest-chip" key={prompt} onClick={() => setAssistantDraft(prompt)}>{prompt}</button>)}</div>
          <div className="assistant-thread" aria-live="polite">{assistantMessages.length ? assistantMessages.map((message) => <article className={`assistant-message ${message.role === 'user' ? 'from-user' : 'from-guide'}`} key={message.id}><span>{message.role === 'user' ? 'YOU' : 'SIDEQUEST GUIDE'}</span><p>{message.text}</p>{message.events?.length ? <div className="assistant-event-links">{message.events.map((event) => <button type="button" className="secondary-btn" key={event.id} onClick={() => setDetailEvent(event)}>View {event.title}</button>)}</div> : null}</article>) : <div className="empty-state"><strong>Your guide is ready.</strong><br/>Ask about music, workshops, culture, sports, or an upcoming day out.</div>}</div>
          <form className="assistant-compose" onSubmit={(event) => { event.preventDefault(); const prompt = assistantDraft.trim(); if (!prompt) return; const answer = answerAdventureQuestion(prompt, allEvents, { interests: selectedInterests, city: selectedCity, savedIds: savedQuestIds, now: new Date() }); setAssistantMessages((current) => [...current, { id: `u-${Date.now()}`, role: 'user', text: prompt }, { id: `a-${Date.now() + 1}`, role: 'assistant', text: answer.text, events: answer.events }].slice(-30)); setAssistantDraft(''); }}><label htmlFor="adventure-assistant-input">What are you in the mood for?</label><textarea id="adventure-assistant-input" rows="3" maxLength="500" value={assistantDraft} onChange={(event) => setAssistantDraft(event.target.value)} placeholder="e.g. Find a creative workshop in Mumbai this weekend…"/><div className="chat-compose-footer"><small>{assistantDraft.length}/500 · Conversation saved on this device</small><button className="primary-btn" type="submit" disabled={!assistantDraft.trim()}>Ask the guide</button></div></form>
          <button type="button" className="secondary-btn" onClick={() => { setAssistantMessages([]); setToast('Your local assistant conversation was cleared.'); }}>Clear conversation</button>
        </section>}

        {page === 'chat' && <section className="panel feature-panel chat-panel">
          <div className="section-heading"><div><span className="eyebrow">Feature 12 / Party Chat</span><h2>Make the plan together.</h2><p className="small-copy">A device-local coordination board for sharing meeting points, timing, and quick updates. It is not a live or cross-account chat yet.</p></div><span className="feature-emblem">♧</span></div>
          <div className="chat-safety-note">Never share passwords, payment details, or sensitive personal information here.</div>
          <div className="chat-thread" aria-live="polite">{chatMessages.length ? chatMessages.slice(-40).map((message) => <article className="chat-message" key={message.id}><div><strong>{message.author}</strong><time>{new Date(message.createdAt).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'numeric', minute:'2-digit' })}</time></div><p>{message.text}</p></article>) : <div className="empty-state"><strong>Your party board is quiet.</strong><br/>Start with a meetup point or a plan for the next quest.</div>}</div>
          <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); const text = chatDraft.trim(); if (!text) return; setChatMessages((current) => [...current, { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, author: currentUser?.name || 'Guest Explorer', text: text.slice(0, 500), createdAt: new Date().toISOString() }]); setChatDraft(''); }}><label htmlFor="party-chat-message">Message your party</label><textarea id="party-chat-message" rows="3" maxLength="500" value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="e.g. Let's meet near the main entrance at 5:45…"/><div className="chat-compose-footer"><small>{chatDraft.length}/500 · Stored only in this browser</small><button className="primary-btn" type="submit" disabled={!chatDraft.trim()}>Post message</button></div></form>
          <button type="button" className="secondary-btn" onClick={() => { setChatMessages([]); setToast('This browser’s party chat was cleared.'); }}>Clear local chat</button>
        </section>}

        {page === 'calendar' && <section className="panel feature-panel calendar-panel">
          <div className="section-heading"><div><span className="eyebrow">Feature 14 / Quest Calendar</span><h2>Put your adventures on the map of time.</h2><p className="small-copy">Upcoming saved quests and planned chain stops, grouped by date. Calendar entries can be exported to an .ics file for your calendar app.</p></div><span className="feature-emblem">▦</span></div>
          {(() => { const planned = allEvents.filter((event) => savedQuestIds.some((id) => String(id) === String(event.id)) && event.date && new Date(`${event.date}T${event.startTime || '23:59'}:00`) >= new Date()).sort((a,b) => `${a.date} ${a.startTime||''}`.localeCompare(`${b.date} ${b.startTime||''}`)); const exportCalendar = () => { const esc = (value) => String(value || '').replace(/\\/g,'\\\\').replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\n/g,'\\n'); const stamp = (event) => `${String(event.date).replaceAll('-','')}T${String(event.startTime || '09:00').replace(':','')}00`; const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SIDEQUEST//Quest Calendar//EN',...planned.flatMap((event) => ['BEGIN:VEVENT',`UID:${esc(event.id)}@sidequest`,`DTSTART:${stamp(event)}`,`SUMMARY:${esc(event.title)}`,`LOCATION:${esc([event.venue,event.locality,event.city].filter(Boolean).join(', '))}`,`DESCRIPTION:${esc(event.description)}`,'END:VEVENT']),'END:VCALENDAR']; const blob = new Blob([lines.join('\r\n')], {type:'text/calendar;charset=utf-8'}); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'sidequest-quests.ics'; anchor.click(); URL.revokeObjectURL(url); }; return <><div className="calendar-toolbar"><div><strong>{planned.length}</strong><span> upcoming saved quests</span></div><button className="primary-btn" type="button" onClick={exportCalendar} disabled={!planned.length}>Export .ics calendar</button></div>{planned.length ? <div className="calendar-list">{planned.map((event) => <article className="calendar-event" key={event.id}><div className="calendar-date"><span>{new Date(`${event.date}T00:00:00`).toLocaleDateString('en-IN',{month:'short'})}</span><strong>{new Date(`${event.date}T00:00:00`).getDate()}</strong><small>{new Date(`${event.date}T00:00:00`).toLocaleDateString('en-IN',{weekday:'short'})}</small></div><div className="calendar-event-copy"><span className="pill accent">{event.category || 'Quest'}</span><h3>{event.title}</h3><p className="small-copy">{formatEventDateTime(event)} · {[event.venue,event.locality,event.city].filter(Boolean).join(', ')}</p></div><button type="button" className="secondary-btn" onClick={() => setDetailEvent(event)}>View</button></article>)}</div> : <div className="empty-state"><strong>No saved upcoming quests yet.</strong><br/>Save an event from the Quest Board to see it here.</div>}</>; })()}
          <p className="helper-text">This calendar currently uses saved events available to the browser. It does not yet sync with Google Calendar or automatically detect travel-time conflicts.</p>
        </section>}

        {page === 'levels' && <section className="panel feature-panel levels-panel">
          <div className="section-heading"><div><span className="eyebrow">Feature 15 / XP & Levels</span><h2>Every small step moves you forward.</h2><p className="small-copy">Earn experience through the actions already available in SIDEQUEST. Your XP is a local prototype score, not a transferable reward.</p></div><span className="feature-emblem">✦</span></div>
          <div className="level-hero"><div className="level-medallion">{explorerLevel.level}</div><div className="level-copy"><span className="eyebrow">CURRENT RANK</span><h3>{explorerLevel.title}</h3><p>{explorerLevel.xp} XP earned · {explorerLevel.currentLevelXp}/100 XP toward the next level</p><div className="achievement-progress" role="progressbar" aria-label="Progress to next explorer level" aria-valuemin="0" aria-valuemax="100" aria-valuenow={explorerLevel.progress}><span style={{width:`${explorerLevel.progress}%`}} /></div></div></div>
          <div className="xp-rules-grid"><article><strong>+10 XP</strong><span>Save a quest</span></article><article><strong>+25 XP</strong><span>Share a field note</span></article><article><strong>+15 XP</strong><span>Add a chain stop</span></article><article><strong>+5 XP</strong><span>Reveal a Mystery Quest</span></article><article><strong>+2 XP</strong><span>Post a party message</span></article></div>
          <div className="level-ladder"><h3>Explorer ranks</h3>{['Rookie Explorer','Wayfinder','Pathfinder','Trailblazer','Legendary Explorer'].map((rank, index) => <div className={explorerLevel.title === rank ? 'level-rank current' : 'level-rank'} key={rank}><span>{String(index+1).padStart(2,'0')}</span><strong>{rank}</strong><small>{index*3+1}+ level</small></div>)}</div>
          <p className="helper-text">XP is calculated from current saved quests, field notes, chain stops, Mystery Quest reveals, and local party messages. Removing activity may lower the score. Progress is not server-synced.</p>
        </section>}

        {page === 'reminders' && <section id="quest-reminders" className="panel reminders-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Feature 07 / Quest Reminders</span>
              <h2>Keep your next adventure on the radar.</h2>
              <p className="small-copy">Set browser reminders for quests you’ve saved. This is an optional, device-local feature—no push subscription or account sync is required.</p>
            </div>
            <span className="reminder-emblem" aria-hidden="true">◷<i>✦</i></span>
          </div>
          <div className="reminder-controls">
            <label><span>Remind me before the event</span><select value={reminderLeadMinutes} onChange={(event) => setReminderLeadMinutes(Number(event.target.value))}><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select></label>
            <div className="reminder-toggle-card"><div><strong>{remindersEnabled ? 'Browser reminders are on' : 'Browser reminders are off'}</strong><p className="small-copy">{typeof Notification === 'undefined' ? 'Notifications are not available in this browser.' : Notification.permission === 'denied' ? 'Notifications are blocked in browser settings.' : 'Keep this browser open around the reminder time for checks to run.'}</p></div>{remindersEnabled ? <button type="button" className="secondary-btn" onClick={disableQuestReminders}>Turn off</button> : <button type="button" className="primary-btn" onClick={enableQuestReminders}>Enable reminders</button>}</div>
          </div>
          {reminderStatus ? <p className="message compact" role="status">{reminderStatus}</p> : null}
          <div className="reminder-summary"><div><strong>{savedQuestIds.length}</strong><span>Saved quests</span></div><div><strong>{reminderItems.length}</strong><span>Upcoming saved quests</span></div><div><strong>{reminderItems.filter((item) => item.status === 'due').length}</strong><span>Within reminder window</span></div></div>
          <div className="reminders-list-heading"><div><span className="eyebrow">Your next quests</span><h3>Upcoming saved events</h3></div><a className="secondary-btn" href="/saved">Manage saved quests</a></div>
          {!savedQuestIds.length ? <div className="empty-state reminder-empty"><strong>Your reminder list is empty.</strong><br />Save a quest from the Quest Board or Quest Radar, then come back here to set reminders.</div> : reminderItems.length === 0 ? <div className="empty-state reminder-empty"><strong>No upcoming saved events yet.</strong><br />Past events and saved quests without a valid future date won’t be scheduled.</div> : <div className="reminders-list">{reminderItems.map((item) => <article className="reminder-card" key={item.event.id}><div className="reminder-date-stamp"><span>{new Date(item.start).toLocaleDateString('en-IN', {month:'short'})}</span><strong>{new Date(item.start).toLocaleDateString('en-IN', {day:'2-digit'})}</strong></div><div className="reminder-detail"><div className="radar-result-top"><span className="pill accent">{item.event.category || 'Community quest'}</span><span className={item.status === 'due' ? 'reminder-state due' : 'reminder-state'}>{item.status === 'due' ? 'Reminder window reached' : `In ${item.minutesUntil < 60 ? `${item.minutesUntil} min` : `${Math.floor(item.minutesUntil / 60)}h ${item.minutesUntil % 60}m`}`}</span></div><h3>{item.event.title}</h3><p className="small-copy">{formatEventDateTime(item.event)} · {[item.event.venue, item.event.locality, item.event.city].filter(Boolean).join(', ') || 'Location details unavailable'}</p><p className="helper-text">Reminder planned: {new Date(item.reminderAt).toLocaleString('en-IN', {dateStyle:'medium', timeStyle:'short'})}</p></div><button type="button" className="secondary-btn reminder-open" onClick={() => setDetailEvent(item.event)}>View quest</button></article>)}</div>}
          <p className="helper-text reminder-privacy">Local reminder settings are stored in this browser. Notifications are not guaranteed if the browser is closed, the device is asleep, or OS notification access is disabled.</p>
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



        {(page === 'home' || page === 'chains') && <section id="quest-chains" className="panel chains-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Feature 05 / Quest Chains</span>
              <h2>Turn a few stops into a whole adventure.</h2>
              <p className="small-copy">Build a mini-outing from multiple quests, then arrange the stops in the order you want to visit them.</p>
            </div>
            <span className="chain-route-mark" aria-hidden="true">↗ · · ✦</span>
          </div>

          <form className="chain-create-form" onSubmit={(event) => {
            event.preventDefault();
            const chain = createQuestChain(newChainTitle);
            if (!chain) { setChainError('Give your Quest Chain a name between 2 and 60 characters.'); return; }
            setQuestChains((current) => [chain, ...current]);
            setActiveChainId(chain.id);
            setNewChainTitle('');
            setChainError('');
            setToast(`“${chain.title}” created. Add quests from their detail cards.`);
          }}>
            <label className="chain-name-field"><span>Name your outing</span><input value={newChainTitle} onChange={(event) => { setNewChainTitle(event.target.value); if (chainError) setChainError(''); }} maxLength={60} placeholder="e.g. Saturday in the city" aria-label="Quest Chain name" /></label>
            <button type="submit" className="primary-btn">＋ Create Quest Chain</button>
          </form>
          {chainError ? <div className="message error-message" role="alert">{chainError}</div> : null}
          <p className="helper-text chain-storage-note">Saved on this browser only for now. Chains are not synced across devices or accounts.</p>

          {questChains.length === 0 ? (
            <div className="empty-state chain-empty"><strong>Your next mini-adventure starts with a name.</strong><br />Create a chain here, then open any quest and choose “Add to active chain.” You can build the stop list before deciding your route.</div>
          ) : (
            <div className="chains-list">
              {questChains.map((chain) => {
                const summary = estimateChainSummary(chain);
                const active = chain.id === activeChainId;
                return (
                  <article key={chain.id} className={active ? 'chain-card active' : 'chain-card'}>
                    <div className="chain-card-head">
                      <div><span className="chain-index">{active ? '✦ ACTIVE ROUTE' : 'FIELD PLAN'}</span><h3>{chain.title}</h3><p className="small-copy">{summary.stopCount} stop{summary.stopCount === 1 ? '' : 's'}{summary.cities.length ? ` · ${summary.cities.join(' → ')}` : ''}</p></div>
                      <div className="chain-card-actions">
                        {!active ? <button type="button" className="secondary-btn" onClick={() => { setActiveChainId(chain.id); setToast(`“${chain.title}” is now your active chain.`); }}>Make active</button> : <span className="chain-active-label">Ready for stops</span>}
                        <button type="button" className="ghost-btn" onClick={() => { setQuestChains((current) => current.filter((item) => item.id !== chain.id)); if (activeChainId === chain.id) setActiveChainId(questChains.find((item) => item.id !== chain.id)?.id || ''); setToast('Quest Chain deleted.'); }} aria-label={`Delete ${chain.title}`}>Delete</button>
                      </div>
                    </div>
                    {summary.multiDate || summary.multiCity ? <p className="message compact chain-warning">{summary.multiDate ? 'Stops are on different dates. ' : ''}{summary.multiCity ? 'This chain includes more than one city. Check travel time before setting off.' : 'Check the dates before setting off.'}</p> : null}
                    {chain.stops.length === 0 ? <div className="chain-stops-empty">No stops yet. Open a quest’s details to add it here.</div> : (
                      <ol className="chain-stops">
                        {chain.stops.map((stop, index) => (
                          <li key={`${chain.id}-${stop.eventId}`} className="chain-stop">
                            <span className="chain-stop-number">{String(index + 1).padStart(2, '0')}</span>
                            <div className="chain-stop-details"><strong>{stop.title}</strong><span>{formatEventDateTime(stop)} · {[stop.venue, stop.locality, stop.city].filter(Boolean).join(', ') || 'Location details unavailable'}</span></div>
                            <div className="chain-stop-actions">
                              <button type="button" className="chain-move-btn" disabled={index === 0} onClick={() => setQuestChains((current) => current.map((item) => item.id === chain.id ? { ...item, stops: moveChainStop(item.stops, index, -1) } : item))} aria-label={`Move ${stop.title} up`}>↑</button>
                              <button type="button" className="chain-move-btn" disabled={index === chain.stops.length - 1} onClick={() => setQuestChains((current) => current.map((item) => item.id === chain.id ? { ...item, stops: moveChainStop(item.stops, index, 1) } : item))} aria-label={`Move ${stop.title} down`}>↓</button>
                              <button type="button" className="chain-remove-btn" onClick={() => setQuestChains((current) => current.map((item) => item.id === chain.id ? { ...item, stops: removeChainStop(item.stops, stop.eventId) } : item))}>Remove</button>
                              <button type="button" className="secondary-btn chain-view-btn" onClick={() => { const found = allEvents.find((event) => String(event.id) === String(stop.eventId)); if (found) setDetailEvent(found); else getEventById(stop.eventId).then((response) => setDetailEvent(response.event)).catch(() => setToast('This quest is no longer available to open. The saved stop remains in your chain.')); }}>View quest</button>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                    {chain.stops.length > 0 ? <><div className="chain-footer"><span className="helper-text">Stop order is manual; distances and opening times are not calculated.</span><button type="button" className="secondary-btn" onClick={async () => { const text = [`SIDEQUEST · ${chain.title}`, ...chain.stops.map((stop, index) => `${index + 1}. ${stop.title} — ${formatEventDateTime(stop)} — ${[stop.venue, stop.locality, stop.city].filter(Boolean).join(', ')}\n${new URL(`/quests/${encodeURIComponent(stop.eventId)}`, window.location.origin).href}`)].join('\n\n'); setChainShareFallback(''); try { if (navigator.share) { await navigator.share({ title: chain.title, text }); setToast('Quest Chain ready to share.'); } else { await navigator.clipboard.writeText(text); setToast('Itinerary copied to clipboard.'); } } catch (shareError) { if (shareError?.name !== 'AbortError') { setChainShareFallback(text); setToast('Sharing or clipboard access is unavailable. Copy the itinerary below.'); } } }}>Share itinerary ↗</button></div>{chainShareFallback && <label className="chain-share-fallback">Copy your itinerary<textarea rows={5} readOnly value={chainShareFallback} onFocus={(event) => event.currentTarget.select()} /><small className="helper-text">Select the text and copy it to share your stop list.</small></label>}</> : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>}

        {page === 'safety' && <section className="panel safety-panel">
          <div className="section-heading"><div><span className="eyebrow">Feature 18 / Trust & Safety</span><h2>Help keep the adventure welcoming.</h2><p className="description">Report misleading listings, unsafe events, spam, harassment, or inappropriate content. Reports are private to your account.</p></div></div>
          <div className="safety-guidance"><h3>Before you submit</h3><ul><li>Share specific, factual details that help a moderator review the concern.</li><li>Do not include passwords, payment details, or other sensitive information.</li><li>If you are in immediate danger, contact local emergency services instead of relying on an app report.</li></ul></div>
          {!currentUser ? <div className="auth-gate"><h3>Sign in to report a concern</h3><p>Sign in so you can follow your report history.</p><a className="primary-btn" href="/login?next=%2Fsafety">Sign in</a></div> : <><h3>Your submitted reports</h3>{myReportsError ? <p className="message error-message" role="alert">{myReportsError}</p> : null}{myReports.length ? <div className="report-list">{myReports.map((report) => <article className="review-card" key={report.id}><div className="review-meta"><strong>{report.targetLabel}</strong><span className="pill muted">{report.status}</span></div><p>{report.reason.replace('-', ' ')}</p><time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</time></article>)}</div> : <p className="helper-text">You have not submitted any reports yet. You can report an event from its details.</p>}</>}
          <p className="helper-text">Current prototype: reports are recorded for review, but a staffed moderation queue, response-time guarantees, account blocking, and appeals are not yet implemented.</p>
        </section>}

        {page === 'organizer' && <section className="panel">
          <div className="section-heading"><div><span className="eyebrow">Feature 16 / Organizer Hub</span><h2>Creator & Organizer Dashboard</h2><p className="description">A snapshot of your published quests and community registrations.</p></div><a className="primary-btn" href="/publish">Create a quest</a></div>
          {authLoading ? <div className="loading-box">Checking your account…</div> : currentUser?.role !== 'organizer' ? <div className="auth-gate"><h3>Organizer access required</h3><p>Sign in with an organizer account to manage published quests.</p><a className="primary-btn" href="/login?next=%2Forganizer">Sign in as organizer</a><a className="secondary-btn" href="/register?role=organizer&next=%2Forganizer">Create organizer account</a></div> : (() => { const owned = allEvents.filter((event) => event.organizerName === currentUser.name && !event.isSampleData); const upcoming = owned.filter((event) => new Date(`${event.date}T${event.startTime || '09:00'}:00`) > new Date()); const registrationTotal = insights.topEvents.filter((entry) => owned.some((event) => event.title === entry.title)).reduce((sum, entry) => sum + entry.count, 0); return <><div className="insight-grid"><div className="stat-box"><strong>{owned.length}</strong><span>Published quests</span></div><div className="stat-box"><strong>{upcoming.length}</strong><span>Upcoming quests</span></div><div className="stat-box"><strong>{registrationTotal}</strong><span>Recorded registrations (matching event titles)</span></div></div><div className="insight-list">{owned.length ? owned.map((event) => <article className="insight-item" key={event.id}><div><strong>{event.title}</strong><span className="helper-text">{formatEventDateTime(event)} · {[event.venue, event.city].filter(Boolean).join(', ')}</span></div><a className="secondary-btn" href={`/quests/${encodeURIComponent(event.id)}`}>View quest</a></article>) : <div className="empty-state compact">You have not published a quest yet. Create your first quest to see it here.</div>}</div><p className="helper-text">Current prototype: this dashboard lists events matching your organizer name. Edit/pause/delete workflows and owner-ID based analytics are not yet implemented.</p></>; })()}
        </section>}

        {page === 'bookings' && <section className="panel">
          <div className="section-heading"><div><span className="eyebrow">Feature 17 / Tickets & Booking Status</span><h2>My bookings</h2><p className="description">Review your confirmed SIDEQUEST RSVPs and open external registration links when an organizer provides one.</p></div><a className="secondary-btn" href="/quests">Find more quests</a></div>
          {authLoading ? <div className="loading-box">Checking your account…</div> : !currentUser ? <div className="auth-gate"><h3>Sign in to view bookings</h3><p>Your booking list is linked to your account.</p><a className="primary-btn" href="/login?next=%2Fbookings">Sign in</a></div> : bookingsLoading ? <div className="loading-box">Loading your bookings…</div> : bookingsError ? <div className="message error-message" role="alert">{bookingsError}</div> : myBookings.length ? <div className="event-grid">{myBookings.map((booking) => <article className="event-card" key={booking.id}><div className="event-card-body"><span className="pill accent">{booking.status === 'confirmed' ? 'RSVP confirmed' : booking.status}</span><h3>{booking.event?.title || 'Quest no longer available'}</h3>{booking.event ? <ul className="meta-list"><li>{formatEventDateTime(booking.event)}</li><li>{[booking.event.venue, booking.event.locality, booking.event.city].filter(Boolean).join(', ')}</li></ul> : null}<p className="helper-text">Booked on {new Date(booking.createdAt).toLocaleDateString('en-IN')}</p>{booking.event ? <div className="card-actions"><a className="secondary-btn" href={`/quests/${encodeURIComponent(booking.eventId)}`}>View quest</a>{booking.event.registrationUrl ? <a className="primary-btn" href={booking.event.registrationUrl} target="_blank" rel="noreferrer">Open organizer checkout ↗</a> : <span className="helper-text">No payment required in SIDEQUEST RSVP.</span>}</div> : null}</div></article>)}</div> : <div className="empty-state compact">No bookings yet. Open a quest and choose “Join this quest” to create an RSVP.</div>}
          <p className="helper-text">Payment note: SIDEQUEST does not process payments or issue paid tickets yet. External checkout links open the organizer’s provider; the RSVP status shown here confirms only your SIDEQUEST registration, not an external payment.</p>
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

      <footer className="site-footer"><div className="footer-brand"><span className="brand-mark" aria-hidden="true">✳</span><div><strong>SIDEQUEST</strong><span>Your City. Your Next Quest.</span></div></div><p>Life is the main quest. Experiences are the sidequests.</p><div className="footer-links"><a href="/quests">Explore</a><a href="/nearby">Nearby</a><a href="/radar">Quest Radar</a><a href="/reminders">Reminders</a><a href="/mystery">Mystery Quest</a><a href="/achievements">Achievements</a><a href="/profile">Explorer Profile</a><a href="/publish">Publish</a><a href="/organizer">Organizer Hub</a><a href="/bookings">My Bookings</a><a href="/safety">Safety & Reports</a><a href="/assistant">Adventure AI</a></div><small>Demo project • Event details may include clearly labelled sample data.</small></footer>

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
            <section className="safety-report-inline" aria-labelledby="report-event-heading"><div className="section-heading"><div><span className="eyebrow">Trust & Safety</span><h4 id="report-event-heading">Something not right?</h4><p className="small-copy">Send a private report about this event for review.</p></div></div><form className="review-form" onSubmit={submitSafetyReport}><label>Reason<select value={reportDraft.reason} onChange={(event) => setReportDraft((current) => ({ ...current, reason: event.target.value }))}><option value="unsafe">Safety concern</option><option value="misleading">Misleading information</option><option value="spam">Spam or scam</option><option value="harassment">Harassment</option><option value="inappropriate">Inappropriate content</option><option value="other">Other concern</option></select></label><label>Details (optional)<textarea rows="2" maxLength={1000} value={reportDraft.details} onChange={(event) => setReportDraft((current) => ({ ...current, details: event.target.value }))} placeholder="Add factual context (up to 1,000 characters)." /></label><button className="secondary-btn" type="submit" disabled={reportBusy}>{reportBusy ? 'Submitting…' : 'Report this event'}</button>{reportMessage ? <p className="helper-text" role="status">{reportMessage}</p> : null}{!currentUser && !authLoading ? <p className="helper-text">Sign in is required to submit a report.</p> : null}</form></section>
            {detailEvent.latitude != null && detailEvent.longitude != null ? <div className="event-map-wrap"><iframe className="event-map" title={`Map for ${detailEvent.title}`} loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(detailEvent.longitude) - 0.01}%2C${Number(detailEvent.latitude) - 0.01}%2C${Number(detailEvent.longitude) + 0.01}%2C${Number(detailEvent.latitude) + 0.01}&layer=mapnik&marker=${detailEvent.latitude}%2C${detailEvent.longitude}`} /><small className="helper-text">Map data © OpenStreetMap contributors</small></div> : <p className="helper-text">No exact map pin has been added for this venue yet. Use the address-based directions link above.</p>}
            <section className="quest-reviews" aria-labelledby="review-heading"><div className="section-heading"><div><span className="eyebrow">Feature 10 / Community Field Notes</span><h4 id="review-heading">Explorer reviews & stories</h4><p className="small-copy">Share what the experience was like and leave a tip for the next explorer. Notes are stored locally in this prototype.</p></div></div>
              <form className="review-form" onSubmit={submitQuestReview}><label>Your rating<select value={reviewDraft.rating} onChange={(event) => setReviewDraft((current) => ({ ...current, rating: event.target.value }))}><option value="5">★★★★★ — Loved it</option><option value="4">★★★★☆ — Great</option><option value="3">★★★☆☆ — It was okay</option><option value="2">★★☆☆☆ — Could improve</option><option value="1">★☆☆☆☆ — Not for me</option></select></label><label>Your story<textarea rows="3" maxLength="600" required value={reviewDraft.story} onChange={(event) => setReviewDraft((current) => ({ ...current, story: event.target.value }))} placeholder="What should another explorer know? (12–600 characters)" /></label><label>Helpful tip (optional)<input maxLength="180" value={reviewDraft.tips} onChange={(event) => setReviewDraft((current) => ({ ...current, tips: event.target.value }))} placeholder="e.g. Arrive 10 minutes early" /></label><button type="submit" className="secondary-btn">Add field note</button>{reviewMessage ? <p className="helper-text" role="status">{reviewMessage}</p> : null}</form>
              {(reviewsByQuest[String(detailEvent.id)] || []).length ? <div className="review-list">{reviewsByQuest[String(detailEvent.id)].map((review) => <article className="review-card" key={review.id}><div className="review-meta"><strong>{review.author}</strong><span aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span></div><p>{review.story}</p>{review.tips ? <small>Explorer tip: {review.tips}</small> : null}<time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}</time></article>)}</div> : <p className="helper-text">No field notes yet. Be the first to share a useful story.</p>}
            </section>
            <div className="card-actions modal-actions">
              <button type="button" className="secondary-btn chain-add-btn" disabled={Boolean(activeQuestChain && activeQuestChain.stops.some((stop) => String(stop.eventId) === String(detailEvent.id)))} onClick={() => {
                if (questChains.length === 0) { setToast('Create a Quest Chain first, then add quests from their details.'); return; }
                const active = questChains.find((chain) => chain.id === activeChainId) || questChains[0];
                setQuestChains((current) => current.map((chain) => chain.id === active.id ? addEventToChain(chain, detailEvent) : chain));
                setActiveChainId(active.id);
                setToast((active.stops || []).some((stop) => String(stop.eventId) === String(detailEvent.id)) ? 'This quest is already in the active chain.' : `Added “${detailEvent.title}” to “${active.title}”.`);
              }}>↗ Add to {activeQuestChain?.title || 'active chain'}</button>
              {questChains.length === 0 ? <small className="helper-text chain-add-hint">Create a chain on the Quest Chains page to start building an outing.</small> : null}
              <button type="button" className="secondary-btn party-up-btn" onClick={() => handlePartyUp(detailEvent)}>♧ Party up · Invite friends</button>
              {partyMessage && <label className="party-invite-fallback">Your invite message<textarea readOnly rows={4} value={partyMessage} onFocus={(e) => e.currentTarget.select()} aria-label="Invite message to copy manually" /><small className="helper-text">Select the message, copy it, and send it to your friends.</small></label>}
              <button
                type="button"
                className={savedQuestIds.includes(detailEvent.id) ? 'save-btn active' : 'save-btn'}
                onClick={() => toggleSavedQuest(detailEvent)}
              >
                {savedQuestIds.includes(detailEvent.id) ? 'Saved' : 'Save quest'}
              </button>
              <button type="button" className="primary-btn" disabled={registering || authLoading} onClick={() => handleRegister(detailEvent.id)}>
                {registering ? 'Registering…' : authLoading ? 'Checking account…' : currentUser ? 'Join this quest' : 'Sign in to join quest'}
              </button>
              {!currentUser && !authLoading ? <p className="helper-text registration-auth-hint">Sign in or create an account before joining. Your registration will be linked to your account.</p> : null}
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
