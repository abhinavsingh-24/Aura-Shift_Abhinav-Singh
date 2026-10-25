const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { verifiedIndiaEvents } = require('./indiaEvents');
const { rankEvents } = require('./recommendations');
const { validateReportDraft } = require('./reportRules');
const { createRateLimiter } = require('./rateLimit');
const {
  connectMongo,
  EventModel,
  RegistrationModel,
  BookingModel,
  PaymentModel,
  UserModel,
  ReportModel,
  AuditLogModel,
} = require('./db');
const {
  isLiveRazorpay,
  createOrder,
  verifyPayment,
  verifyCheckIn,
  signSandboxPayment,
  generateBookingRef,
} = require('./payments');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.NODE_ENV === 'test' ? '' : (process.env.MONGO_URI || '');
const SESSION_SECRET = process.env.SESSION_SECRET || 'sidequest-local-development-secret-change-before-deployment';
const SESSION_COOKIE = 'sidequest_session';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const ALLOWED_ORIGINS = new Set(
  [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:5199',
    'http://127.0.0.1:5199',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ].filter(Boolean),
);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (process.env.NODE_ENV !== 'production') {
    try {
      const parsed = new URL(origin);
      const host = parsed.hostname;
      if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1') {
        return true;
      }
      if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  }),
);

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '512kb', strict: true }));

const authRateLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 50 });
const writeRateLimit = createRateLimiter({ windowMs: 60 * 1000, max: 60 });
const bookingRateLimit = createRateLimiter({ windowMs: 60 * 1000, max: 40 });

const registrations = [];
const users = [];
const reports = [];
const bookings = [];
const payments = [];
const auditLogs = [];

const inMemoryState = {
  registrations,
  users,
  reports,
  bookings,
  payments,
  auditLogs,
  events: [],
};

if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32 ||
    process.env.SESSION_SECRET.includes('replace-with-a-long-random-secret'))
) {
  throw new Error('SESSION_SECRET must contain at least 32 characters in production.');
}

let mongoReady = false;

// Preload events memory store with verified India events for immediate availability
let events = [
  ...verifiedIndiaEvents.map((event) => ({
    ...event,
    _id: event.id,
    status: event.status || 'published',
    createdAt: new Date().toISOString(),
  })),
];
inMemoryState.events = events;

async function startDatabase() {
  mongoReady = await connectMongo(MONGO_URI);
  console.log('[DB-INIT] connectMongo result:', mongoReady, 'URI:', MONGO_URI ? MONGO_URI.replace(/:[^:]*@/, ':***@') : '(empty)');
  if (mongoReady) {
    const persisted = await EventModel.find({}).lean();
    console.log('[DB-INIT] EventModel.find({}).lean() returned count:', persisted.length);
    if (persisted.length) {
      events = persisted.map((event) => ({
        ...event,
        id: event.id || String(event._id),
        _id: String(event._id),
      }));
      inMemoryState.events = events;
    }
  }
}

function getEventDate(event) {
  if (!event || !event.date) return null;
  const time = event.startTime || '09:00';
  return new Date(`${event.date}T${time}:00`);
}

function isUpcomingEvent(event) {
  const eventDate = getEventDate(event);
  return Boolean(eventDate && eventDate > new Date());
}

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  const values = String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return values.filter((item, index) => values.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index);
}

function normalizeEvent(event) {
  const { ownerId, ...publicFields } = event;
  return {
    ...publicFields,
    id: event.id || String(event._id),
    _id: String(event._id || event.id),
  };
}

function isValidIsoDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) return false;
  const [year, month, day] = dateString.split('-').map(Number);
  const asDate = new Date(Date.UTC(year, month - 1, day));
  return (
    !Number.isNaN(asDate.getTime()) &&
    asDate.getUTCFullYear() === year &&
    asDate.getUTCMonth() === month - 1 &&
    asDate.getUTCDate() === day
  );
}

function createUniqueId(prefix) {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function validateEventPayload(payload) {
  const errors = [];
  const required = ['title', 'description', 'category', 'date', 'startTime', 'city', 'venue'];

  required.forEach((field) => {
    const value = payload[field];
    if (!value || !String(value).trim()) {
      errors.push(`${field} is required.`);
    }
  });

  if (payload.date && !isValidIsoDate(String(payload.date).trim())) {
    errors.push('date must be a valid ISO date.');
  }

  if (
    payload.date &&
    isValidIsoDate(String(payload.date).trim()) &&
    payload.startTime &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(payload.startTime)
  ) {
    if (new Date(`${payload.date}T${payload.startTime}:00`) <= new Date()) {
      errors.push('date and startTime must be in the future.');
    }
  }

  if (payload.title && String(payload.title).trim().length > 140) errors.push('title must be 140 characters or fewer.');
  if (payload.description && String(payload.description).trim().length > 3000) errors.push('description must be 3000 characters or fewer.');
  if (payload.organizerName && String(payload.organizerName).trim().length > 120) errors.push('organizerName must be 120 characters or fewer.');

  if (payload.startTime) {
    const timeMatch = /^([01]\d|2[0-3]):[0-5]\d$/.test(payload.startTime);
    if (!timeMatch) errors.push('startTime must be in HH:mm format.');
  }

  if (payload.capacity !== undefined && payload.capacity !== '' && payload.capacity !== null) {
    const numericCapacity = Number(payload.capacity);
    if (!Number.isFinite(numericCapacity) || !Number.isInteger(numericCapacity) || numericCapacity <= 0) {
      errors.push('capacity must be a positive whole number when provided.');
    }
  }

  for (const field of ['latitude', 'longitude']) {
    if (payload[field] !== undefined && payload[field] !== '' && payload[field] !== null) {
      const value = Number(payload[field]);
      const min = field === 'latitude' ? -90 : -180;
      const max = field === 'latitude' ? 90 : 180;
      if (!Number.isFinite(value) || value < min || value > max) errors.push(`${field} must be between ${min} and ${max}.`);
    }
  }
  if ((payload.latitude === undefined || payload.latitude === '') !== (payload.longitude === undefined || payload.longitude === '')) {
    errors.push('latitude and longitude must be provided together.');
  }

  for (const field of ['registrationUrl', 'imageUrl']) {
    if (!payload[field]) continue;
    try {
      const url = new URL(String(payload[field]));
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol');
    } catch {
      errors.push(`${field} must be a valid HTTP or HTTPS URL when provided.`);
    }
  }

  return { isValid: errors.length === 0, errors };
}

function safeUser(user) {
  if (!user) return null;
  return {
    id: String(user.id || user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    organizationName: user.organizationName || '',
    isVerified: Boolean(user.isVerified),
    createdAt: user.createdAt,
  };
}

function cookieValue(req, name) {
  const cookies = String(req.headers.cookie || '').split(';');
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split('=');
    if (key === name) {
      try { return decodeURIComponent(value.join('=')); } catch { return ''; }
    }
  }
  return '';
}

function signSession(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifySession(token) {
  if (!token || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest();
  let actual;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000) || !payload.sub) return null;
    return payload;
  } catch { return null; }
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

async function findUserById(id) {
  if (!id) return null;
  if (mongoReady) {
    try {
      let user = await UserModel.findOne({ id }).lean();
      if (user) return user;
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(id)) {
        user = await UserModel.findById(id).lean();
        if (user) return user;
      }
      return null;
    } catch (err) {
      console.warn('findUserById lookup error:', err.message);
      return null;
    }
  }
  return users.find((user) => String(user.id) === String(id) || String(user._id) === String(id)) || null;
}

async function authenticatedUser(req) {
  const payload = verifySession(cookieValue(req, SESSION_COOKIE));
  if (!payload) return null;
  return findUserById(payload.sub);
}

async function requireOrganizer(req, res, next) {
  try {
    const user = await authenticatedUser(req);
    if (!user) return res.status(401).json({ message: 'Please log in with an organizer account to perform this action.' });
    if (!['organizer', 'admin'].includes(user.role)) {
      return res.status(403).json({ message: 'An organizer account is required for this action.' });
    }
    req.user = safeUser(user);
    return next();
  } catch (error) {
    return res.status(500).json({ message: 'Unable to verify your account right now.' });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const user = await authenticatedUser(req);
    if (!user) return res.status(401).json({ message: 'Admin authentication required.' });
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Administrator permissions required.' });
    }
    req.user = safeUser(user);
    return next();
  } catch (error) {
    return res.status(500).json({ message: 'Unable to verify your account right now.' });
  }
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = await scrypt(password, salt, 64);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// ======================== AUTH ROUTES ========================

app.post('/api/auth/register', authRateLimit, async (req, res) => {
  const { name, email, password, role = 'explorer', phone, organizationName } = req.body || {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!name || cleanName.length < 2 || cleanName.length > 80) {
    return res.status(400).json({ message: 'Name must be between 2 and 80 characters.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ message: 'Password must be between 8 and 128 characters.' });
  }

  // Accept and normalize Explorer, Organizer, Organiser, and Admin
  let cleanRole = typeof role === 'string' ? role.trim().toLowerCase() : 'explorer';
  if (cleanRole === 'organiser') cleanRole = 'organizer';
  if (!['explorer', 'organizer', 'admin'].includes(cleanRole)) {
    return res.status(400).json({ message: 'Choose a valid account type.' });
  }

  try {
    const existing = mongoReady
      ? await UserModel.findOne({ email: cleanEmail }).lean()
      : users.find((user) => user.email === cleanEmail);
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const userId = createUniqueId('user');
    const record = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      passwordHash: await hashPassword(password),
      role: cleanRole,
      phone: typeof phone === 'string' ? phone.trim() : '',
      organizationName: typeof organizationName === 'string' ? organizationName.trim() : '',
      isVerified: cleanRole === 'admin',
      isDemoUser: false,
      createdAt: new Date(),
    };

    let user;
    if (mongoReady) {
      const created = await UserModel.create(record);
      user = created.toObject();
    } else {
      user = { ...record, _id: userId };
      users.push(user);
    }

    const id = String(user.id || user._id);
    const token = signSession({
      sub: id,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    });
    setSessionCookie(res, token);
    return res.status(201).json({ message: 'Your SIDEQUEST account is ready.', user: safeUser(user) });
  } catch (error) {
    if (error && (error.code === 11000 || (error.name === 'MongoServerError' && error.code === 11000))) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    if (error && error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Registration failed:', error.stack || error.message);
    return res.status(500).json({ message: 'Account creation failed. Please try again.' });
  }
});

app.post('/api/auth/login', authRateLimit, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ message: 'Enter your email and password.' });
  try {
    const user = mongoReady ? await UserModel.findOne({ email }).lean() : users.find((item) => item.email === email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }
    const id = String(user.id || user._id);
    setSessionCookie(
      res,
      signSession({ sub: id, role: user.role, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS }),
    );
    return res.json({ message: 'Welcome back.', user: safeUser(user) });
  } catch (error) {
    console.error('Login failed:', error.stack || error.message);
    return res.status(500).json({ message: 'Unable to log in right now.' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await authenticatedUser(req);
    if (!user) return res.status(200).json({ user: null });
    return res.json({ user: safeUser(user) });
  } catch {
    return res.status(200).json({ user: null });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  return res.json({ message: 'You have been signed out.' });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'SIDEQUEST India Event & Ticketing Platform is running.',
    database: mongoReady ? 'mongodb' : 'memory',
    eventsCount: events.length,
    paymentProvider: isLiveRazorpay ? 'Razorpay (Live/Test Mode)' : 'SIDEQUEST India Payment Sandbox',
  });
});

// ======================== EVENTS & DISCOVERY ROUTES ========================

app.get('/api/events', async (req, res) => {
  const {
    search = '',
    category = 'all',
    date = 'all',
    city = 'all',
    locality = 'all',
    price = 'all',
    type = 'all',
    sort = 'date-asc',
  } = req.query;

  // Filter published & upcoming events for discovery
  let filtered = [...events].filter((e) => e.status !== 'draft' && e.status !== 'cancelled');
  filtered = filtered.filter(isUpcomingEvent);

  const searchText = String(search).trim().toLowerCase();
  if (searchText) {
    filtered = filtered.filter((event) => {
      const searchableFields = [
        event.title,
        event.description,
        event.category,
        event.city,
        event.state,
        event.locality,
        event.venue,
        event.organizerName,
        ...(Array.isArray(event.tags) ? event.tags : []),
        ...(Array.isArray(event.interests) ? event.interests : []),
      ];
      return searchableFields.some((value) => String(value || '').toLowerCase().includes(searchText));
    });
  }

  if (category !== 'all') {
    const targetCat = String(category).toLowerCase();
    filtered = filtered.filter((event) => {
      const eventCat = String(event.category || '').toLowerCase();
      return eventCat === targetCat || eventCat.includes(targetCat) || targetCat.includes(eventCat);
    });
  }

  if (city !== 'all') {
    filtered = filtered.filter((event) => {
      const eventCity = String(event.city || '').toLowerCase();
      const targetCity = String(city).toLowerCase();
      return eventCity.includes(targetCity) || targetCity.includes(eventCity);
    });
  }

  if (locality !== 'all') {
    filtered = filtered.filter((event) => String(event.locality || '').toLowerCase() === String(locality).toLowerCase());
  }

  if (price !== 'all') {
    if (price === 'free') filtered = filtered.filter((e) => e.isFree || e.priceStarting === 0);
    if (price === 'paid') filtered = filtered.filter((e) => !e.isFree && e.priceStarting > 0);
  }

  if (type !== 'all') {
    if (type === 'online') filtered = filtered.filter((e) => e.isOnline);
    if (type === 'in-person') filtered = filtered.filter((e) => !e.isOnline);
  }

  if (date !== 'all') {
    const today = new Date();
    const later7 = new Date(today);
    later7.setDate(today.getDate() + 7);
    const later30 = new Date(today);
    later30.setDate(today.getDate() + 30);

    filtered = filtered.filter((event) => {
      const eventDate = getEventDate(event);
      if (!eventDate) return false;

      if (date === 'today') return eventDate.toDateString() === today.toDateString();
      if (date === 'weekend') {
        const day = eventDate.getDay();
        return day === 6 || day === 0;
      }
      if (date === 'next7days') return eventDate >= today && eventDate <= later7;
      if (date === 'thisMonth') return eventDate >= today && eventDate <= later30;
      return true;
    });
  }

  // Sorting
  filtered.sort((a, b) => {
    const aDate = getEventDate(a) || new Date(0);
    const bDate = getEventDate(b) || new Date(0);
    const aPrice = Number(a.priceStarting || 0);
    const bPrice = Number(b.priceStarting || 0);

    if (sort === 'date-desc') return bDate - aDate;
    if (sort === 'price-asc') return aPrice - bPrice;
    if (sort === 'price-desc') return bPrice - aPrice;
    return aDate - bDate; // default date-asc
  });

  res.json({
    count: filtered.length,
    events: filtered.map(normalizeEvent),
  });
});

app.get('/api/events/:id', (req, res) => {
  const target = events.find((event) => event.id === req.params.id || event._id === req.params.id);
  if (!target) {
    return res.status(404).json({ message: 'Event not found.' });
  }
  return res.json({ event: normalizeEvent(target) });
});

app.post('/api/events', requireOrganizer, async (req, res) => {
  const payload = req.body || {};
  const validation = validateEventPayload(payload);

  if (!validation.isValid) {
    return res.status(400).json({
      message: 'Please fix the highlighted form errors.',
      errors: validation.errors,
    });
  }

  const eventId = createUniqueId('evt');
  const priceStarting = payload.priceStarting ? Number(payload.priceStarting) : 0;
  const isFree = payload.isFree !== undefined ? Boolean(payload.isFree) : priceStarting === 0;

  // Build ticket tiers
  let ticketTiers = [];
  if (Array.isArray(payload.ticketTiers) && payload.ticketTiers.length > 0) {
    ticketTiers = payload.ticketTiers.map((tier, idx) => ({
      id: tier.id || `tier-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`,
      name: String(tier.name || 'General Admission').trim(),
      description: String(tier.description || '').trim(),
      price: Number(tier.price || 0),
      currency: 'INR',
      capacity: Number(tier.capacity || payload.capacity || 100),
      soldCount: 0,
    }));
  } else {
    ticketTiers = [
      {
        id: `tier-std-${Date.now()}`,
        name: isFree ? 'General RSVP' : 'Standard Entry Pass',
        description: isFree ? 'Free entry pass' : 'General entry ticket',
        price: priceStarting,
        currency: 'INR',
        capacity: payload.capacity ? Number(payload.capacity) : 100,
        soldCount: 0,
      },
    ];
  }

  const newEvent = {
    id: eventId,
    _id: eventId,
    title: String(payload.title).trim(),
    description: String(payload.description).trim(),
    category: String(payload.category).trim(),
    tags: parseList(payload.tags || payload.category),
    interests: parseList(payload.interests),
    date: String(payload.date).trim(),
    startTime: String(payload.startTime).trim(),
    endDate: payload.endDate ? String(payload.endDate).trim() : undefined,
    endTime: payload.endTime ? String(payload.endTime).trim() : undefined,
    city: String(payload.city).trim(),
    state: payload.state ? String(payload.state).trim() : '',
    locality: payload.locality ? String(payload.locality).trim() : '',
    venue: String(payload.venue).trim(),
    isOnline: Boolean(payload.isOnline),
    organizerName: req.user.name,
    organizerId: req.user.id,
    ownerId: req.user.id,
    capacity: payload.capacity ? Number(payload.capacity) : undefined,
    registrationUrl: payload.registrationUrl ? String(payload.registrationUrl).trim() : undefined,
    imageUrl: payload.imageUrl ? String(payload.imageUrl).trim() : undefined,
    latitude: payload.latitude !== undefined && payload.latitude !== '' ? Number(payload.latitude) : undefined,
    longitude: payload.longitude !== undefined && payload.longitude !== '' ? Number(payload.longitude) : undefined,
    status: payload.status && ['draft', 'published'].includes(payload.status) ? payload.status : 'published',
    isFree,
    priceStarting,
    currency: 'INR',
    bookingDeadline: payload.bookingDeadline ? String(payload.bookingDeadline).trim() : undefined,
    cancellationPolicy: payload.cancellationPolicy ? String(payload.cancellationPolicy).trim() : 'Free cancellation up to 24 hours before the event starts.',
    terms: payload.terms ? String(payload.terms).trim() : '',
    source: {
      name: `${req.user.name} (Direct Host)`,
      url: payload.registrationUrl || '',
      verifiedDate: new Date().toISOString().slice(0, 10),
      license: 'Organizer Direct Listing',
    },
    ticketTiers,
    createdAt: new Date().toISOString(),
    isSampleData: false,
  };

  try {
    if (mongoReady) {
      const eventDocument = { ...newEvent };
      delete eventDocument._id;
      const saved = await EventModel.create({
        ...eventDocument,
        id: newEvent.id,
        createdAt: new Date(newEvent.createdAt),
      });
      events = [normalizeEvent(saved.toObject()), ...events];
      inMemoryState.events = events;
      await AuditLogModel.create({
        id: createUniqueId('audit'),
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: 'EVENT_CREATED',
        targetType: 'event',
        targetId: newEvent.id,
        details: { title: newEvent.title, status: newEvent.status },
      });
    } else {
      events.unshift(newEvent);
      inMemoryState.events = events;
    }
  } catch (error) {
    console.error('Unable to persist event:', error.message);
    return res.status(500).json({ message: 'The quest could not be saved. Please try again.' });
  }

  return res.status(201).json({
    message: 'Quest published successfully.',
    event: normalizeEvent(newEvent),
  });
});

app.put('/api/events/:id', requireOrganizer, async (req, res) => {
  const targetId = req.params.id;
  const event = events.find((e) => e.id === targetId || e._id === targetId);
  if (!event) return res.status(404).json({ message: 'Event not found.' });

  // Only event owner or admin can edit
  if (event.ownerId && event.ownerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'You are not authorized to edit this event.' });
  }

  const updates = req.body || {};
  const updatable = [
    'title', 'description', 'category', 'date', 'startTime', 'endDate', 'endTime',
    'city', 'state', 'locality', 'venue', 'isOnline', 'capacity', 'imageUrl',
    'registrationUrl', 'isFree', 'priceStarting', 'cancellationPolicy', 'terms', 'status'
  ];

  updatable.forEach((field) => {
    if (updates[field] !== undefined) event[field] = updates[field];
  });

  if (Array.isArray(updates.ticketTiers)) {
    event.ticketTiers = updates.ticketTiers;
  }

  if (mongoReady) {
    await EventModel.updateOne({ id: event.id }, { $set: event });
    await AuditLogModel.create({
      id: createUniqueId('audit'),
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'EVENT_UPDATED',
      targetType: 'event',
      targetId: event.id,
      details: { updates },
    });
  }

  return res.json({ message: 'Event updated successfully.', event: normalizeEvent(event) });
});

app.patch('/api/events/:id/status', requireOrganizer, async (req, res) => {
  const targetId = req.params.id;
  const { status } = req.body || {};
  if (!['draft', 'published', 'cancelled', 'unverified'].includes(status)) {
    return res.status(400).json({ message: 'Invalid event status.' });
  }

  const event = events.find((e) => e.id === targetId || e._id === targetId);
  if (!event) return res.status(404).json({ message: 'Event not found.' });

  if (event.ownerId && event.ownerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'You are not authorized to change status for this event.' });
  }

  event.status = status;
  if (mongoReady) {
    await EventModel.updateOne({ id: event.id }, { $set: { status } });
    await AuditLogModel.create({
      id: createUniqueId('audit'),
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: `EVENT_STATUS_${status.toUpperCase()}`,
      targetType: 'event',
      targetId: event.id,
      details: { status },
    });
  }

  return res.json({ message: `Event status changed to ${status}.`, event: normalizeEvent(event) });
});

// ======================== PAYMENTS & BOOKINGS ROUTES ========================

app.post('/api/payments/create-order', bookingRateLimit, async (req, res) => {
  let user;
  try { user = await authenticatedUser(req); } catch { user = null; }
  if (!user) return res.status(401).json({ message: 'Please sign in to book tickets.', code: 'AUTH_REQUIRED' });

  const { eventId, tierId, quantity = 1, buyerPhone } = req.body || {};
  const event = events.find((e) => e.id === eventId || e._id === eventId);
  if (!event) return res.status(404).json({ message: 'Event not found.' });

  try {
    const orderResult = await createOrder({
      event,
      tierId,
      quantity,
      buyer: { name: user.name, email: user.email, phone: buyerPhone },
      user,
      mongoReady,
      inMemoryState,
    });

    return res.status(201).json({
      message: orderResult.isFree ? 'Booking confirmed!' : 'Payment order created.',
      ...orderResult,
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

app.post('/api/payments/verify', bookingRateLimit, async (req, res) => {
  const { orderId, paymentId, signature, bookingId } = req.body || {};
  try {
    const result = await verifyPayment({
      orderId,
      paymentId,
      signature,
      bookingId,
      mongoReady,
      inMemoryState,
    });
    return res.json({
      message: 'Payment verified and ticket issued successfully!',
      booking: result.booking,
      qrCodeData: result.qrCodeData,
    });
  } catch (err) {
    console.error('Payment verification failed:', err.message);
    return res.status(400).json({ message: err.message });
  }
});

// Sandbox one-click simulated payment for frictionless testing
app.post('/api/payments/sandbox-pay', bookingRateLimit, async (req, res) => {
  const { orderId, bookingId } = req.body || {};
  if (!orderId || !bookingId) return res.status(400).json({ message: 'Order ID and Booking ID required.' });

  const paymentId = `pay_sbx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const signature = signSandboxPayment(orderId, paymentId);

  try {
    const result = await verifyPayment({
      orderId,
      paymentId,
      signature,
      bookingId,
      mongoReady,
      inMemoryState,
    });
    return res.json({
      message: 'Sandbox payment simulated successfully! Your ticket is confirmed.',
      booking: result.booking,
      qrCodeData: result.qrCodeData,
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

app.post('/api/payments/webhook', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const event = req.body?.event;
  const payload = req.body?.payload;

  if (!signature || !event || !payload) {
    return res.status(400).json({ message: 'Invalid webhook payload or signature.' });
  }

  // Idempotency check / handling
  try {
    if (event === 'payment.captured' || event === 'order.paid') {
      const orderId = payload.payment?.entity?.order_id;
      const paymentId = payload.payment?.entity?.id;
      if (orderId && paymentId) {
        let booking;
        if (mongoReady) {
          booking = await BookingModel.findOne({ paymentOrderId: orderId });
          if (booking && booking.status !== 'confirmed') {
            booking.status = 'confirmed';
            booking.paymentStatus = 'paid';
            booking.paymentId = paymentId;
            await booking.save();
          }
        }
      }
    }
    return res.json({ status: 'ok', received: true });
  } catch (err) {
    console.error('Webhook processing error:', err.message);
    return res.status(500).json({ message: 'Webhook processing error.' });
  }
});

app.get('/api/my-bookings', async (req, res) => {
  let user;
  try { user = await authenticatedUser(req); } catch { user = null; }
  if (!user) return res.status(401).json({ message: 'Please sign in to view your tickets.', code: 'AUTH_REQUIRED' });

  const userId = String(user.id || user._id);
  const bookingRecords = mongoReady
    ? await BookingModel.find({ userId }).sort({ createdAt: -1 }).lean()
    : inMemoryState.bookings.filter((b) => b.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const regRecords = mongoReady
    ? await RegistrationModel.find({ participantId: userId }).sort({ createdAt: -1 }).lean()
    : registrations.filter((r) => r.participantId === userId);

  // Merge any registrations that don't already have a booking
  const existingEventIds = new Set(bookingRecords.map((b) => String(b.eventId)));
  const mergedBookings = [...bookingRecords];

  for (const reg of regRecords) {
    if (!existingEventIds.has(String(reg.eventId))) {
      mergedBookings.push({
        id: reg.id || String(reg._id),
        bookingRef: `SQ-${(reg.id || 'REG').slice(-6).toUpperCase()}`,
        eventId: reg.eventId,
        userId: reg.participantId,
        buyerName: reg.participantName,
        buyerEmail: user.email,
        ticketTierName: 'General RSVP',
        quantity: 1,
        unitPrice: 0,
        totalAmount: 0,
        currency: 'INR',
        status: 'confirmed',
        paymentStatus: 'free',
        qrCodeData: `SQPASS:${reg.eventId}:${userId}`,
        isCheckedIn: false,
        createdAt: reg.createdAt,
      });
    }
  }

  const items = mergedBookings.map((booking) => {
    const event = events.find((e) => String(e.id || e._id) === String(booking.eventId));
    return {
      ...booking,
      event: event ? normalizeEvent(event) : null,
    };
  });

  return res.json({ count: items.length, bookings: items });
});

app.post('/api/bookings/:id/cancel', writeRateLimit, async (req, res) => {
  let user;
  try { user = await authenticatedUser(req); } catch { user = null; }
  if (!user) return res.status(401).json({ message: 'Sign in required.' });

  const bookingId = req.params.id;
  let booking;
  if (mongoReady) {
    booking = await BookingModel.findOne({ id: bookingId });
  } else {
    booking = inMemoryState.bookings.find((b) => b.id === bookingId);
  }

  if (!booking) return res.status(404).json({ message: 'Booking not found.' });
  if (booking.userId !== String(user.id || user._id) && user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized to cancel this booking.' });
  }

  if (booking.status === 'cancelled') {
    return res.status(400).json({ message: 'This booking is already cancelled.' });
  }

  booking.status = 'cancelled';
  booking.refundReason = req.body?.reason || 'User cancelled';

  if (mongoReady) {
    await booking.save();
    // Restore tier inventory
    await EventModel.updateOne(
      { id: booking.eventId, 'ticketTiers.id': booking.ticketTierId },
      { $inc: { 'ticketTiers.$.soldCount': -booking.quantity } },
    );
  } else {
    const event = inMemoryState.events.find((e) => e.id === booking.eventId);
    if (event && Array.isArray(event.ticketTiers)) {
      const tier = event.ticketTiers.find((t) => t.id === booking.ticketTierId);
      if (tier && tier.soldCount >= booking.quantity) tier.soldCount -= booking.quantity;
    }
  }

  return res.json({ message: 'Booking cancelled successfully.', booking });
});

// Legacy /api/my-registrations backward compatibility
app.get('/api/my-registrations', async (req, res) => {
  let user;
  try { user = await authenticatedUser(req); } catch { user = null; }
  if (!user) return res.status(401).json({ message: 'Please sign in to view your bookings.', code: 'AUTH_REQUIRED' });
  const participantId = String(user.id || user._id || '');

  // Fetch both legacy registrations and new bookings
  const regRecords = mongoReady
    ? await RegistrationModel.find({ participantId }).sort({ createdAt: -1 }).lean()
    : registrations.filter((entry) => entry.participantId === participantId);

  const bookingRecords = mongoReady
    ? await BookingModel.find({ userId: participantId }).sort({ createdAt: -1 }).lean()
    : inMemoryState.bookings.filter((b) => b.userId === participantId);

  const bookingsList = [
    ...regRecords.map((record) => {
      const event = events.find((item) => String(item.id || item._id) === String(record.eventId));
      return {
        id: record.id || String(record._id),
        eventId: record.eventId,
        createdAt: record.createdAt,
        status: 'confirmed',
        bookingType: event?.registrationUrl ? 'external-registration-available' : 'free-rsvp',
        event: event ? normalizeEvent(event) : null,
      };
    }),
    ...bookingRecords.map((b) => {
      const event = events.find((item) => String(item.id || item._id) === String(b.eventId));
      return {
        id: b.id,
        bookingRef: b.bookingRef,
        eventId: b.eventId,
        createdAt: b.createdAt,
        status: b.status,
        bookingType: b.paymentStatus === 'free' ? 'free-rsvp' : 'paid-ticket',
        qrCodeData: b.qrCodeData,
        event: event ? normalizeEvent(event) : null,
      };
    }),
  ];

  return res.json({ count: bookingsList.length, bookings: bookingsList });
});

// ======================== ORGANIZER PORTAL ROUTES ========================

app.get('/api/organizer/events', requireOrganizer, async (req, res) => {
  const organizerId = req.user.id;
  const organizerName = req.user.name;
  const orgEvents = events.filter(
    (e) => e.ownerId === organizerId || (e.organizerName && e.organizerName === organizerName) || req.user.role === 'admin',
  );
  return res.json({ count: orgEvents.length, events: orgEvents.map(normalizeEvent) });
});

app.get('/api/organizer/events/:id/attendees', requireOrganizer, async (req, res) => {
  const eventId = req.params.id;
  const event = events.find((e) => e.id === eventId || e._id === eventId);
  if (!event) return res.status(404).json({ message: 'Event not found.' });

  if (event.ownerId && event.ownerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized access to attendee list.' });
  }

  const attendees = mongoReady
    ? await BookingModel.find({ eventId }).sort({ createdAt: -1 }).lean()
    : inMemoryState.bookings.filter((b) => b.eventId === eventId);

  return res.json({ count: attendees.length, attendees });
});

app.get('/api/organizer/events/:id/attendees/csv', requireOrganizer, async (req, res) => {
  const eventId = req.params.id;
  const event = events.find((e) => e.id === eventId || e._id === eventId);
  if (!event) return res.status(404).json({ message: 'Event not found.' });

  if (event.ownerId && event.ownerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized.' });
  }

  const attendees = mongoReady
    ? await BookingModel.find({ eventId }).sort({ createdAt: -1 }).lean()
    : inMemoryState.bookings.filter((b) => b.eventId === eventId);

  const csvRows = [
    'Booking Ref,Attendee Name,Email,Phone,Ticket Tier,Quantity,Total (INR),Status,Checked In,Booking Date',
  ];

  attendees.forEach((a) => {
    const row = [
      `"${a.bookingRef || a.id}"`,
      `"${(a.buyerName || '').replace(/"/g, '""')}"`,
      `"${a.buyerEmail || ''}"`,
      `"${a.buyerPhone || ''}"`,
      `"${(a.ticketTierName || '').replace(/"/g, '""')}"`,
      a.quantity || 1,
      a.totalAmount || 0,
      `"${a.status}"`,
      a.isCheckedIn ? 'YES' : 'NO',
      `"${new Date(a.createdAt).toISOString()}"`,
    ];
    csvRows.push(row.join(','));
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="attendees-${eventId}.csv"`);
  return res.send(csvRows.join('\n'));
});

app.post('/api/organizer/check-in', requireOrganizer, async (req, res) => {
  const { ticketReference, eventId } = req.body || {};
  try {
    const result = await verifyCheckIn({
      ticketReference,
      eventId,
      scannedByUserId: req.user.id,
      mongoReady,
      inMemoryState,
    });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message, isValid: false });
  }
});

app.get('/api/organizer/stats', requireOrganizer, async (req, res) => {
  const organizerId = req.user.id;
  const myEvents = events.filter((e) => e.ownerId === organizerId || req.user.role === 'admin');
  const myEventIds = myEvents.map((e) => e.id || String(e._id));

  const allBookings = mongoReady
    ? await BookingModel.find({ eventId: { $in: myEventIds } }).lean()
    : inMemoryState.bookings.filter((b) => myEventIds.includes(b.eventId));

  const confirmed = allBookings.filter((b) => b.status === 'confirmed');
  const grossRevenue = confirmed.reduce((acc, b) => acc + (Number(b.totalAmount) || 0), 0);
  const totalAttendees = confirmed.reduce((acc, b) => acc + (Number(b.quantity) || 1), 0);
  const checkedInCount = confirmed.filter((b) => b.isCheckedIn).length;

  return res.json({
    totalEvents: myEvents.length,
    activeEvents: myEvents.filter((e) => e.status === 'published').length,
    totalBookings: confirmed.length,
    totalAttendees,
    checkedInCount,
    grossRevenue,
    currency: 'INR',
  });
});

// ======================== ADMIN MANAGEMENT ROUTES ========================

app.get('/api/admin/overview', requireAdmin, async (req, res) => {
  const totalUsers = mongoReady ? await UserModel.countDocuments({}) : users.length;
  const totalEvents = events.length;
  const totalBookings = mongoReady ? await BookingModel.countDocuments({ status: 'confirmed' }) : inMemoryState.bookings.filter((b) => b.status === 'confirmed').length;
  const totalReports = mongoReady ? await ReportModel.countDocuments({ status: 'received' }) : reports.filter((r) => r.status === 'received').length;

  return res.json({
    totalUsers,
    totalEvents,
    totalBookings,
    totalReports,
    systemStatus: 'healthy',
    database: mongoReady ? 'MongoDB Atlas' : 'In-Memory Store',
  });
});

app.get('/api/admin/events', requireAdmin, async (req, res) => {
  return res.json({ count: events.length, events: events.map(normalizeEvent) });
});

app.patch('/api/admin/events/:id/moderate', requireAdmin, async (req, res) => {
  const { action } = req.body || {}; // approve, reject, unpublish
  const event = events.find((e) => e.id === req.params.id || e._id === req.params.id);
  if (!event) return res.status(404).json({ message: 'Event not found.' });

  if (action === 'approve') event.status = 'published';
  else if (action === 'reject') event.status = 'cancelled';
  else if (action === 'unpublish') event.status = 'draft';
  else return res.status(400).json({ message: 'Invalid moderation action.' });

  if (mongoReady) {
    await EventModel.updateOne({ id: event.id }, { $set: { status: event.status } });
    await AuditLogModel.create({
      id: createUniqueId('audit'),
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: `ADMIN_EVENT_${action.toUpperCase()}`,
      targetType: 'event',
      targetId: event.id,
      details: { status: event.status },
    });
  }

  return res.json({ message: `Event marked as ${event.status}.`, event: normalizeEvent(event) });
});

app.post('/api/admin/import', requireAdmin, async (req, res) => {
  const { events: importList = [] } = req.body || {};
  if (!Array.isArray(importList) || importList.length === 0) {
    return res.status(400).json({ message: 'A non-empty list of events is required for import.' });
  }

  const results = { imported: 0, duplicates: 0, errors: [] };

  for (const item of importList) {
    const validation = validateEventPayload(item);
    if (!validation.isValid) {
      results.errors.push({ title: item.title || 'Untitled', errors: validation.errors });
      continue;
    }

    // Check duplicate
    const existing = events.find(
      (e) => e.title.toLowerCase() === item.title.toLowerCase() && e.city.toLowerCase() === item.city.toLowerCase(),
    );
    if (existing) {
      results.duplicates += 1;
      continue;
    }

    const eventId = createUniqueId('evt-imp');
    const newEvent = {
      ...item,
      id: eventId,
      _id: eventId,
      ownerId: req.user.id,
      organizerName: item.organizerName || req.user.name,
      status: 'published',
      isSampleData: false,
      createdAt: new Date().toISOString(),
    };

    if (mongoReady) {
      const doc = { ...newEvent };
      delete doc._id;
      await EventModel.create(doc);
    }
    events.unshift(newEvent);
    results.imported += 1;
  }

  return res.json({ message: 'Import process completed.', results });
});

app.get('/api/admin/reports', requireAdmin, async (req, res) => {
  const allReports = mongoReady ? await ReportModel.find({}).sort({ createdAt: -1 }).lean() : reports;
  return res.json({ count: allReports.length, reports: allReports });
});

app.patch('/api/admin/reports/:id', requireAdmin, async (req, res) => {
  const { status } = req.body || {};
  if (!['received', 'reviewing', 'resolved', 'dismissed'].includes(status)) {
    return res.status(400).json({ message: 'Invalid report status.' });
  }
  if (mongoReady) {
    await ReportModel.updateOne({ id: req.params.id }, { $set: { status } });
  } else {
    const report = reports.find((r) => r.id === req.params.id);
    if (report) report.status = status;
  }
  return res.json({ message: `Report status updated to ${status}.` });
});

app.get('/api/admin/audit-logs', requireAdmin, async (req, res) => {
  const logs = mongoReady ? await AuditLogModel.find({}).sort({ createdAt: -1 }).limit(100).lean() : auditLogs;
  return res.json({ count: logs.length, logs });
});

// ======================== RECOMMENDATIONS & REPORTS ========================

app.get('/api/recommendations', (req, res) => {
  const interestParam = req.query.interests || req.query.interest || '';
  const selectedInterests = parseList(interestParam);
  const selectedCategory = req.query.category || '';
  const city = req.query.city || '';
  const locality = req.query.locality || '';

  const ranked = rankEvents(events, {
    interests: selectedInterests,
    category: selectedCategory,
    city,
    locality,
  });

  const recommendations = ranked.slice(0, 8).map((event) => ({
    ...event,
    score: event.recommendationScore,
    reasons: event.recommendationReasons,
  }));

  return res.json({ count: recommendations.length, recommendations });
});

app.post('/api/reports', writeRateLimit, async (req, res) => {
  let user;
  try { user = await authenticatedUser(req); } catch { user = null; }
  if (!user) return res.status(401).json({ message: 'Please sign in before submitting a report.' });
  const validation = validateReportDraft(req.body || {});
  if (!validation.isValid) return res.status(400).json({ message: 'Please check your report details.', errors: validation.errors });
  const { targetType, targetId, reason, details } = validation.value;
  const targetEvent = events.find((event) => String(event.id) === targetId || String(event._id) === targetId);
  if (targetType === 'event' && !targetEvent) return res.status(404).json({ message: 'The event could not be found.' });
  const targetLabel = targetType === 'event' ? targetEvent.title : String(req.body?.targetLabel || '').trim().slice(0, 160);
  if (!targetLabel) return res.status(400).json({ message: 'A target name is required for organizer reports.' });

  const existing = mongoReady
    ? await ReportModel.findOne({ reporterId: String(user.id || user._id), targetType, targetId, status: { $in: ['received', 'reviewing'] } }).lean()
    : reports.find((report) => report.reporterId === String(user.id || user._id) && report.targetType === targetType && report.targetId === targetId && ['received', 'reviewing'].includes(report.status));
  if (existing) return res.status(409).json({ message: 'You already have an open report for this target.' });

  const report = {
    id: createUniqueId('report'),
    reporterId: String(user.id || user._id),
    reporterName: user.name,
    targetType,
    targetId,
    targetLabel,
    reason,
    details,
    status: 'received',
    createdAt: new Date().toISOString(),
  };

  try {
    if (mongoReady) await ReportModel.create(report);
    else reports.unshift(report);
  } catch (error) {
    if (error && error.code === 11000) return res.status(409).json({ message: 'This report has already been submitted.' });
    console.error('Unable to save report:', error.message);
    return res.status(500).json({ message: 'Your report could not be saved. Please try again.' });
  }

  return res.status(201).json({
    message: 'Report received. Thank you for helping keep SIDEQUEST safe.',
    report: { id: report.id, targetType, targetLabel, reason, status: report.status, createdAt: report.createdAt },
  });
});

app.get('/api/my-reports', async (req, res) => {
  let user;
  try { user = await authenticatedUser(req); } catch { user = null; }
  if (!user) return res.status(401).json({ message: 'Please sign in to view your reports.' });
  try {
    const mine = mongoReady
      ? await ReportModel.find({ reporterId: String(user.id || user._id) }).sort({ createdAt: -1 }).select('id targetId targetType targetLabel reason status createdAt').lean()
      : reports.filter((report) => report.reporterId === String(user.id || user._id)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(({ id, targetId, targetType, targetLabel, reason, status, createdAt }) => ({ id, targetId, targetType, targetLabel, reason, status, createdAt }));
    return res.json({ reports: mine });
  } catch (error) {
    console.error('Unable to load reports:', error.message);
    return res.status(500).json({ message: 'Your reports could not be loaded right now.' });
  }
});

app.get('/api/insights', async (req, res) => {
  const allRegistrations = mongoReady ? await RegistrationModel.find({}).lean() : [...registrations];
  const allBookings = mongoReady ? await BookingModel.find({ status: 'confirmed' }).lean() : inMemoryState.bookings.filter((b) => b.status === 'confirmed');

  const totalRegistrations = allRegistrations.length + allBookings.length;
  const categoryRegistrations = {};
  const eventCounts = {};
  const eventCategories = {};

  events.forEach((event) => {
    const category = event.category || 'Uncategorized';
    categoryRegistrations[category] = categoryRegistrations[category] || 0;
    eventCategories[event.id] = category;
    eventCounts[event.id] = { title: event.title, count: 0 };
  });

  allRegistrations.forEach((entry) => {
    if (eventCounts[entry.eventId]) {
      eventCounts[entry.eventId].count += 1;
      const category = eventCategories[entry.eventId] || 'Uncategorized';
      categoryRegistrations[category] = (categoryRegistrations[category] || 0) + 1;
    }
  });

  allBookings.forEach((entry) => {
    if (eventCounts[entry.eventId]) {
      eventCounts[entry.eventId].count += entry.quantity || 1;
      const category = eventCategories[entry.eventId] || 'Uncategorized';
      categoryRegistrations[category] = (categoryRegistrations[category] || 0) + (entry.quantity || 1);
    }
  });

  const topEvents = Object.values(eventCounts)
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const popularCategories = Object.entries(categoryRegistrations)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  return res.json({
    totalRegistrations,
    popularCategories,
    topEvents,
  });
});

// Existing free RSVP route for backwards compatibility with tests and simple RSVPs
app.post('/api/events/:id/register', writeRateLimit, async (req, res) => {
  let user;
  try {
    user = await authenticatedUser(req);
  } catch (error) {
    console.error('Unable to verify registration session:', error.message);
    return res.status(500).json({ message: 'Unable to verify your account right now.' });
  }
  if (!user) {
    return res.status(401).json({ message: 'Please sign in before joining a quest.', code: 'AUTH_REQUIRED' });
  }

  const normalizedName = String(user.name || '').trim();
  const normalizedParticipantId = String(user.id || user._id || '');
  if (!normalizedName || !normalizedParticipantId) {
    return res.status(401).json({ message: 'Your account could not be verified. Please sign in again.' });
  }

  const target = events.find((event) => event.id === req.params.id || event._id === req.params.id);
  if (!target) return res.status(404).json({ message: 'Event not found.' });

  if (target.capacity) {
    const existingCount = mongoReady
      ? await RegistrationModel.countDocuments({ eventId: target.id })
      : registrations.filter((entry) => entry.eventId === target.id).length;

    if (existingCount >= Number(target.capacity)) {
      return res.status(409).json({ message: 'This quest has reached its capacity.' });
    }
  }

  const duplicate = mongoReady
    ? await RegistrationModel.exists({ eventId: target.id, participantId: normalizedParticipantId })
    : registrations.some((entry) => entry.eventId === target.id && entry.participantId === normalizedParticipantId);

  if (duplicate) {
    return res.status(409).json({ message: 'You have already registered for this quest.' });
  }

  const registration = {
    id: createUniqueId('reg'),
    eventId: target.id,
    participantId: normalizedParticipantId,
    participantName: normalizedName,
    createdAt: new Date().toISOString(),
  };

  const bookingRef = generateBookingRef();
  const booking = {
    id: createUniqueId('bk'),
    bookingRef,
    eventId: target.id,
    userId: normalizedParticipantId,
    buyerName: normalizedName,
    buyerEmail: user.email,
    ticketTierId: 'free-rsvp',
    ticketTierName: 'General RSVP',
    quantity: 1,
    unitPrice: 0,
    totalAmount: 0,
    currency: 'INR',
    status: 'confirmed',
    paymentStatus: 'free',
    qrCodeData: `SQPASS:${bookingRef}:${target.id}:${normalizedParticipantId}`,
    isCheckedIn: false,
    createdAt: new Date(),
  };

  try {
    if (mongoReady) {
      await RegistrationModel.create({
        id: registration.id,
        eventId: target.id,
        participantId: normalizedParticipantId,
        participantName: normalizedName,
        createdAt: new Date(registration.createdAt),
      });
      await BookingModel.create(booking);
    } else {
      registrations.push(registration);
      inMemoryState.bookings.push(booking);
    }
  } catch (error) {
    if (error && error.code === 11000) return res.status(409).json({ message: 'You have already registered for this quest.' });
    console.error('Unable to save registration:', error.message);
    return res.status(500).json({ message: 'Registration could not be saved. Please try again.' });
  }

  return res.status(201).json({
    message: 'Quest accepted. You are on the list.',
    registration,
    event: normalizeEvent(target),
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error && error.type === 'entity.too.large') return res.status(413).json({ message: 'Request body is too large.' });
  if (error && error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Request body must contain valid JSON.' });
  if (error && error.name === 'ValidationError') return res.status(400).json({ message: error.message });
  if (error && error.name === 'CastError') return res.status(400).json({ message: 'Invalid identifier format.' });
  if (error && (error.status || error.statusCode)) {
    return res.status(error.status || error.statusCode).json({ message: error.message || 'Request failed.' });
  }
  console.error('Request failed:', error.stack || error.message);
  return res.status(500).json({ message: 'An unexpected server error occurred.' });
});

async function boot() {
  await startDatabase();
  return app.listen(PORT, () => {
    console.log(`SIDEQUEST server running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  boot().catch((error) => {
    console.error('SIDEQUEST could not start:', error.message);
    process.exitCode = 1;
  });
}

app.startDatabase = startDatabase;
module.exports = app;
