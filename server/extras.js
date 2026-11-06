const crypto = require('crypto');
const { ReviewModel, BookingModel } = require('./db');

const IST_OFFSET_MINUTES = 330;

function eventStartDate(event) {
  if (!event || !event.date) return null;
  const [y, m, d] = String(event.date).split('-').map(Number);
  const [hh, mm] = String(event.startTime || '09:00').split(':').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, hh || 0, (mm || 0) - IST_OFFSET_MINUTES));
}

function eventEndDate(event) {
  const start = eventStartDate(event);
  if (!start) return null;
  if (event.endTime) {
    const [y, m, d] = String(event.endDate || event.date).split('-').map(Number);
    const [hh, mm] = String(event.endTime).split(':').map(Number);
    const end = new Date(Date.UTC(y, m - 1, d, hh || 0, (mm || 0) - IST_OFFSET_MINUTES));
    if (end > start) return end;
  }
  return new Date(start.getTime() + 2 * 60 * 60 * 1000);
}

function icsStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function buildIcs(event) {
  const start = eventStartDate(event);
  const end = eventEndDate(event);
  if (!start || !end) return null;
  const location = [event.venue, event.locality, event.city, event.state].filter(Boolean).join(', ');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SIDEQUEST//Event//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${icsEscape(event.id)}@sidequest`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(String(event.description || '').slice(0, 800))}`,
    `LOCATION:${icsEscape(location)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(`${event.title} starts in 1 hour`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

function describeEvent({ title, category, city, venue, tags = [], audience, tone = 'friendly', isFree, price }) {
  const cleanTitle = String(title || 'This event').trim();
  const cat = String(category || 'community').trim().toLowerCase();
  const where = [venue, city].filter(Boolean).join(', ');
  const tagLine = (Array.isArray(tags) ? tags : String(tags || '').split(','))
    .map((t) => String(t).trim())
    .filter(Boolean)
    .slice(0, 5);
  const who = String(audience || '').trim() || 'curious locals, students, and anyone who loves meeting new people';
  const cost = isFree ? 'Entry is free, so just show up and join in.' : price ? `Tickets start at ₹${Number(price).toLocaleString('en-IN')}, and spots are limited.` : 'Spots are limited, so book early.';

  const openers = {
    friendly: `Join us for ${cleanTitle}, a ${cat} experience${where ? ` at ${where}` : ''} that brings the neighbourhood together.`,
    professional: `${cleanTitle} is a curated ${cat} event${where ? ` hosted at ${where}` : ''}, designed for meaningful learning and networking.`,
    energetic: `Get ready for ${cleanTitle}! 🚀 An unmissable ${cat} experience${where ? ` at ${where}` : ''}, packed with energy and good company.`,
  };
  const opener = openers[tone] || openers.friendly;

  const lines = [
    opener,
    `Expect hands-on activities, great conversations${tagLine.length ? `, and a focus on ${tagLine.join(', ')}` : ''}. It is perfect for ${who}.`,
    cost,
    'Bring a friend, arrive a few minutes early, and carry your digital QR ticket for quick check-in.',
  ];
  return lines.join('\n\n');
}

module.exports = function registerExtras(app, ctx) {
  const { getEvents, isMongoReady, inMemoryState, authenticatedUser, requireAuth, requireOrganizer, normalizeEvent, createUniqueId } = ctx;
  if (!inMemoryState.reviews) inMemoryState.reviews = [];

  const findEvent = (id) => getEvents().find((e) => String(e.id || e._id) === String(id));

  async function loadReviews(eventId) {
    const rows = isMongoReady()
      ? await ReviewModel.find({ eventId: String(eventId) }).sort({ createdAt: -1 }).lean()
      : inMemoryState.reviews.filter((r) => r.eventId === String(eventId)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return rows.map(({ _id, __v, userId, ...rest }) => rest);
  }

  function summarize(reviews) {
    const count = reviews.length;
    const average = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
    return { count, average };
  }

  app.get('/api/events/:id/reviews', async (req, res) => {
    if (!findEvent(req.params.id)) return res.status(404).json({ message: 'Event not found.' });
    const reviews = await loadReviews(req.params.id);
    return res.json({ reviews, summary: summarize(reviews) });
  });

  app.post('/api/events/:id/reviews', requireAuth, async (req, res) => {
    const event = findEvent(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    const rating = Number(req.body?.rating);
    const story = String(req.body?.story || '').trim();
    const tips = String(req.body?.tips || '').trim().slice(0, 140);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
    if (story.length < 10 || story.length > 500) return res.status(400).json({ message: 'Your note must be 10 to 500 characters.' });

    const userId = String(req.user.id);
    const eventId = String(event.id || event._id);
    const booking = isMongoReady()
      ? await BookingModel.findOne({ userId, eventId, status: 'confirmed' }).lean()
      : inMemoryState.bookings.find((b) => b.userId === userId && b.eventId === eventId && b.status === 'confirmed');

    const review = {
      id: createUniqueId('review'),
      eventId,
      userId,
      author: req.user.name,
      rating,
      story,
      tips,
      verifiedAttendee: Boolean(booking),
      createdAt: new Date().toISOString(),
    };

    try {
      if (isMongoReady()) {
        await ReviewModel.create({ ...review, createdAt: new Date(review.createdAt) });
      } else {
        if (inMemoryState.reviews.some((r) => r.eventId === eventId && r.userId === userId)) {
          return res.status(409).json({ message: 'You have already reviewed this event.' });
        }
        inMemoryState.reviews.push(review);
      }
    } catch (error) {
      if (error && error.code === 11000) return res.status(409).json({ message: 'You have already reviewed this event.' });
      throw error;
    }
    const reviews = await loadReviews(eventId);
    const { userId: _omit, ...publicReview } = review;
    return res.status(201).json({ review: publicReview, reviews, summary: summarize(reviews) });
  });

  app.get('/api/events/:id/calendar.ics', (req, res) => {
    const event = findEvent(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    const ics = buildIcs(normalizeEvent(event));
    if (!ics) return res.status(400).json({ message: 'This event has no valid date.' });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sidequest-${String(event.id).replace(/[^a-z0-9-]/gi, '')}.ics"`);
    return res.send(ics);
  });

  app.get('/api/my-upcoming', async (req, res) => {
    const user = await authenticatedUser(req).catch(() => null);
    if (!user) return res.status(401).json({ message: 'Please sign in.' });
    const userId = String(user.id || user._id);
    const rows = isMongoReady()
      ? await BookingModel.find({ userId, status: 'confirmed' }).lean()
      : inMemoryState.bookings.filter((b) => b.userId === userId && b.status === 'confirmed');
    const now = Date.now();
    const upcoming = rows
      .map((b) => {
        const event = findEvent(b.eventId);
        const start = event && eventStartDate(event);
        if (!start || start.getTime() < now) return null;
        return {
          bookingRef: b.bookingRef,
          eventId: b.eventId,
          title: event.title,
          venue: event.venue,
          city: event.city,
          startsAt: start.toISOString(),
          minutesUntil: Math.round((start.getTime() - now) / 60000),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.minutesUntil - b.minutesUntil);
    return res.json({ count: upcoming.length, upcoming });
  });

  app.get('/api/organizer/analytics', requireOrganizer, async (req, res) => {
    const isAdmin = req.user.role === 'admin';
    const mine = getEvents().filter((e) => isAdmin || e.ownerId === req.user.id);
    const ids = mine.map((e) => String(e.id || e._id));
    const rows = isMongoReady()
      ? await BookingModel.find({ eventId: { $in: ids } }).lean()
      : inMemoryState.bookings.filter((b) => ids.includes(b.eventId));
    const confirmed = rows.filter((b) => b.status === 'confirmed');

    const days = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ date: d.toISOString().slice(0, 10), bookings: 0, revenue: 0 });
    }
    confirmed.forEach((b) => {
      const key = new Date(b.createdAt).toISOString().slice(0, 10);
      const slot = days.find((d) => d.date === key);
      if (slot) {
        slot.bookings += Number(b.quantity) || 1;
        slot.revenue += Number(b.totalAmount) || 0;
      }
    });

    const perEvent = mine
      .map((e) => {
        const id = String(e.id || e._id);
        const list = confirmed.filter((b) => b.eventId === id);
        const booked = list.reduce((s, b) => s + (Number(b.quantity) || 1), 0);
        const capacity = Number(e.capacity) || (e.ticketTiers || []).reduce((s, t) => s + (Number(t.capacity) || 0), 0) || 0;
        return {
          id,
          title: e.title,
          booked,
          capacity,
          fillRate: capacity ? Math.min(100, Math.round((booked / capacity) * 100)) : 0,
          checkedIn: list.filter((b) => b.isCheckedIn).length,
          revenue: list.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0),
        };
      })
      .sort((a, b) => b.booked - a.booked)
      .slice(0, 8);

    const totalBooked = perEvent.reduce((s, e) => s + e.booked, 0);
    const totalCheckedIn = confirmed.filter((b) => b.isCheckedIn).length;
    return res.json({
      daily: days,
      perEvent,
      checkInRate: confirmed.length ? Math.round((totalCheckedIn / confirmed.length) * 100) : 0,
      totalBooked,
    });
  });

  app.post('/api/organizer/generate-description', requireOrganizer, (req, res) => {
    const body = req.body || {};
    if (!String(body.title || '').trim()) return res.status(400).json({ message: 'Add a title first so the writer has something to work with.' });
    return res.json({ description: describeEvent(body) });
  });
};

module.exports.buildIcs = buildIcs;
module.exports.describeEvent = describeEvent;
module.exports.eventStartDate = eventStartDate;
