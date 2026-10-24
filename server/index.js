const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { sampleEvents } = require('./sampleData');
const { rankEvents } = require('./recommendations');
const { connectMongo, EventModel, RegistrationModel, UserModel } = require('./db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI;
const SESSION_SECRET = process.env.SESSION_SECRET || 'sidequest-local-development-secret-change-before-deployment';
const SESSION_COOKIE = 'sidequest_session';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const ALLOWED_ORIGINS = new Set(
  [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000']
    .filter(Boolean),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));

const registrations = [];
const users = [];
if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32 || process.env.SESSION_SECRET.includes('replace-with-a-long-random-secret'))) {
  throw new Error('SESSION_SECRET must contain at least 32 characters in production.');
}
let mongoReady = false;
let events = sampleEvents.map((event, index) => ({
  ...event,
  _id: String(index + 1),
  id: event.id || String(index + 1),
  createdAt: new Date().toISOString(),
}));

async function startDatabase() {
  mongoReady = await connectMongo(MONGO_URI);
  if (mongoReady) {
    const persisted = await EventModel.find({}).lean();
    if (persisted.length) {
      events = persisted.map((event) => ({
        ...event,
        id: event.id || String(event._id),
        _id: String(event._id),
      }));
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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) {
    return false;
  }

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
  const required = ['title', 'description', 'category', 'date', 'startTime', 'city', 'locality', 'venue', 'organizerName'];

  required.forEach((field) => {
    const value = payload[field];
    if (!value || !String(value).trim()) {
      errors.push(`${field} is required.`);
    }
  });

  if (payload.date && !isValidIsoDate(String(payload.date).trim())) {
    errors.push('date must be a valid ISO date.');
  }

  if (payload.date && isValidIsoDate(String(payload.date).trim()) && payload.startTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(payload.startTime)) {
    if (new Date(`${payload.date}T${payload.startTime}:00`) <= new Date()) {
      errors.push('date and startTime must be in the future.');
    }
  }

  if (payload.title && String(payload.title).trim().length > 120) errors.push('title must be 120 characters or fewer.');
  if (payload.description && String(payload.description).trim().length > 2000) errors.push('description must be 2000 characters or fewer.');
  if (payload.organizerName && String(payload.organizerName).trim().length > 120) errors.push('organizerName must be 120 characters or fewer.');

  if (payload.startTime) {
    const timeMatch = /^([01]\d|2[0-3]):[0-5]\d$/.test(payload.startTime);
    if (!timeMatch) {
      errors.push('startTime must be in HH:mm format.');
    }
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
  return { id: String(user.id || user._id), name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
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
  if (mongoReady) return UserModel.findById(id).lean();
  return users.find((user) => String(user.id) === String(id)) || null;
}

async function authenticatedUser(req) {
  const payload = verifySession(cookieValue(req, SESSION_COOKIE));
  if (!payload) return null;
  return findUserById(payload.sub);
}

async function requireOrganizer(req, res, next) {
  try {
    const user = await authenticatedUser(req);
    if (!user) return res.status(401).json({ message: 'Please log in with an organizer account to publish a quest.' });
    if (user.role !== 'organizer') return res.status(403).json({ message: 'An organizer account is required to publish a quest.' });
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

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role = 'explorer' } = req.body || {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (cleanName.length < 2 || cleanName.length > 80) return res.status(400).json({ message: 'Name must be between 2 and 80 characters.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) return res.status(400).json({ message: 'Enter a valid email address.' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return res.status(400).json({ message: 'Password must be between 8 and 128 characters.' });
  if (!['explorer', 'organizer'].includes(role)) return res.status(400).json({ message: 'Choose a valid account type.' });

  try {
    const existing = mongoReady
      ? await UserModel.findOne({ email: cleanEmail }).lean()
      : users.find((user) => user.email === cleanEmail);
    if (existing) return res.status(409).json({ message: 'An account with this email already exists.' });

    const record = { name: cleanName, email: cleanEmail, passwordHash: await hashPassword(password), role, createdAt: new Date() };
    let user;
    if (mongoReady) {
      user = await UserModel.create(record);
      user = user.toObject();
    } else {
      user = { ...record, id: createUniqueId('user') };
      users.push(user);
    }
    const id = String(user.id || user._id);
    const token = signSession({ sub: id, role: user.role, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS });
    setSessionCookie(res, token);
    return res.status(201).json({ message: 'Your SIDEQUEST account is ready.', user: safeUser(user) });
  } catch (error) {
    if (error && error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' });
    console.error('Registration failed:', error.message);
    return res.status(500).json({ message: 'Account creation failed. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ message: 'Enter your email and password.' });
  try {
    const user = mongoReady ? await UserModel.findOne({ email }).lean() : users.find((item) => item.email === email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' });
    setSessionCookie(res, signSession({ sub: String(user.id || user._id), role: user.role, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS }));
    return res.json({ message: 'Welcome back.', user: safeUser(user) });
  } catch (error) {
    console.error('Login failed:', error.message);
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
  res.json({ status: 'ok', message: 'SIDEQUEST backend is running.', database: mongoReady ? 'mongodb' : 'memory' });
});

app.get('/api/events', async (req, res) => {
  const { search = '', category = 'all', date = 'all', city = 'all', locality = 'all' } = req.query;

  let filtered = [...events].filter(isUpcomingEvent);

  const searchText = String(search).trim().toLowerCase();
  if (searchText) {
    filtered = filtered.filter((event) => {
      const searchableFields = [
        event.title,
        event.description,
        event.category,
        event.city,
        event.locality,
        event.venue,
        ...(Array.isArray(event.interests) ? event.interests : []),
      ];
      return searchableFields.some((value) => String(value || '').toLowerCase().includes(searchText));
    });
  }

  if (category !== 'all') {
    filtered = filtered.filter((event) => String(event.category || '').toLowerCase() === String(category).toLowerCase());
  }

  if (city !== 'all') {
    filtered = filtered.filter((event) => String(event.city || '').toLowerCase() === String(city).toLowerCase());
  }

  if (locality !== 'all') {
    filtered = filtered.filter((event) => String(event.locality || '').toLowerCase() === String(locality).toLowerCase());
  }

  if (date !== 'all') {
    const today = new Date();
    const later = new Date(today);
    later.setDate(today.getDate() + 7);

    filtered = filtered.filter((event) => {
      const eventDate = getEventDate(event);
      if (!eventDate) return false;

      if (date === 'today') return eventDate.toDateString() === today.toDateString();
      if (date === 'weekend') {
        const day = eventDate.getDay();
        return day === 6 || day === 0;
      }
      if (date === 'next7days') return eventDate >= today && eventDate <= later;
      return true;
    });
  }

  filtered.sort((a, b) => {
    const aDate = getEventDate(a) || new Date(0);
    const bDate = getEventDate(b) || new Date(0);
    return aDate - bDate;
  });

  res.json({ count: filtered.length, events: filtered.map(normalizeEvent) });
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
  const newEvent = {
    id: eventId,
    _id: eventId,
    title: String(payload.title).trim(),
    description: String(payload.description).trim(),
    category: String(payload.category).trim(),
    interests: parseList(payload.interests),
    date: String(payload.date).trim(),
    startTime: String(payload.startTime).trim(),
    city: String(payload.city).trim(),
    locality: String(payload.locality).trim(),
    venue: String(payload.venue).trim(),
    organizerName: req.user.name,
    latitude: payload.latitude !== undefined && payload.latitude !== '' ? Number(payload.latitude) : undefined,
    longitude: payload.longitude !== undefined && payload.longitude !== '' ? Number(payload.longitude) : undefined,
    ownerId: req.user.id,
    capacity: payload.capacity ? Number(payload.capacity) : undefined,
    registrationUrl: payload.registrationUrl ? String(payload.registrationUrl).trim() : undefined,
    imageUrl: payload.imageUrl ? String(payload.imageUrl).trim() : undefined,
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
    } else {
      events.unshift(newEvent);
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

  const recommendations = ranked.slice(0, 5).map((event) => ({
    ...event,
    score: event.recommendationScore,
    reasons: event.recommendationReasons,
  }));

  return res.json({ count: recommendations.length, recommendations });
});

// Participant-level registration records are intentionally not exposed publicly.

app.get('/api/insights', async (req, res) => {
  const allRegistrations = mongoReady
    ? await RegistrationModel.find({}).lean()
    : [...registrations];

  const totalRegistrations = allRegistrations.length;
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

app.post('/api/events/:id/register', async (req, res) => {
  const { participantName = '', participantId = '' } = req.body || {};
  const normalizedName = typeof participantName === 'string' ? participantName.trim() : '';
  const normalizedParticipantId = typeof participantId === 'string' ? participantId.trim() : '';
  if (!normalizedName || normalizedName.length > 80) {
    return res.status(400).json({ message: 'Enter a participant name between 1 and 80 characters.' });
  }
  if (!normalizedParticipantId || normalizedParticipantId.length > 100) {
    return res.status(400).json({ message: 'A valid participant identifier is required. Refresh the page and try again.' });
  }

  const target = events.find((event) => event.id === req.params.id || event._id === req.params.id);

  if (!target) {
    return res.status(404).json({ message: 'Event not found.' });
  }

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

  try {
    if (mongoReady) {
      await RegistrationModel.create({
        id: registration.id,
        eventId: target.id,
        participantId: normalizedParticipantId,
        participantName: normalizedName,
        createdAt: new Date(registration.createdAt),
      });
    } else {
      registrations.push(registration);
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
  console.error('Request failed:', error.message);
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

module.exports = app;
