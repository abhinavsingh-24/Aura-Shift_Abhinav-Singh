/**
 * Illustrative SIDEQUEST demo quests around Nallasopara, Maharashtra.
 * These are synthetic sample activities placed at real public landmarks for
 * testing discovery and Quest Chains. They are NOT announced/live events.
 */
const buildDate = (offsetDays) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const venues = {
  openGround: { venue: 'Nallasopara Open Ground', locality: 'Nalasopara West', latitude: 19.41483, longitude: 72.8201 },
  parishadPark: { venue: 'Nallasopara Nagar Parishad Park', locality: 'Nalasopara East', latitude: 19.41348, longitude: 72.8227 },
  zalawad: { venue: 'Zalawad Maidan', locality: 'Nalasopara East', latitude: 19.41311, longitude: 72.82402 },
  nanaNani: { venue: 'Nana Nani Park', locality: 'Nalasopara West', latitude: 19.41684, longitude: 72.81339 },
  station: { venue: 'Nallasopara Station Area', locality: 'Nalasopara West', latitude: 19.4179, longitude: 72.8186 },
};

const makeQuest = (id, title, description, category, venue, offsetDays, startTime, endTime, extras = {}) => ({
  id,
  title,
  description: `DEMO QUEST — Illustrative sample activity only; this is not a scheduled or confirmed real-world event. ${description}`,
  category,
  tags: extras.tags || [],
  interests: extras.interests || [category, 'Community activities'],
  date: buildDate(offsetDays),
  startTime,
  endDate: buildDate(offsetDays),
  endTime,
  city: 'Nallasopara',
  state: 'Maharashtra',
  ...venue,
  isOnline: false,
  organizerName: 'SIDEQUEST Demo Community',
  capacity: extras.capacity || 30,
  status: 'published',
  isFree: extras.priceStarting ? false : true,
  priceStarting: extras.priceStarting || 0,
  currency: 'INR',
  isSampleData: true,
  demoNotice: 'Illustrative demo quest only — no real event has been announced at this venue.',
  terms: 'Demo listing only. This activity is illustrative and is not actually scheduled. Do not travel to the venue based on this listing.',
  cancellationPolicy: 'No real booking is created by this demo listing.',
  source: { name: 'SIDEQUEST synthetic demo data; venue coordinates referenced from public map listings', url: 'https://www.openstreetmap.org/', license: 'Fictional sample activity at a real public landmark; not a live event' },
  ticketTiers: [{ id: `${id}-free`, name: 'Demo RSVP', description: 'Sample-only RSVP for testing the booking interface; not a real admission ticket.', price: 0, currency: 'INR', capacity: extras.capacity || 30, soldCount: 0 }],
});

const nallasoparaDemoQuests = [
  makeQuest('demo-nsp-photo-walk', 'Golden Hour Photo Walk', 'A relaxed beginner-friendly photo walk. Try framing, light, portrait composition, and a short photo-story challenge with other local explorers.', 'Art and culture', venues.nanaNani, 2, '16:30', '18:00', { tags: ['Photography', 'Beginner friendly', 'Outdoor'], interests: ['Art and culture', 'Community activities'], capacity: 24 }),
  makeQuest('demo-nsp-yoga-park', 'Weekend Stretch & Yoga Circle', 'A gentle outdoor movement session with warm-ups, guided stretches, breathing exercises, and a cool-down. Bring a mat and water.', 'Fitness', venues.parishadPark, 3, '07:00', '08:00', { tags: ['Wellness', 'Yoga', 'Morning'], interests: ['Fitness', 'Community activities'], capacity: 25 }),
  makeQuest('demo-nsp-sketch-ground', 'Sketch the Neighbourhood', 'A casual urban-sketching meetup. Capture everyday street scenes and public spaces in a small sketchbook; beginners are welcome.', 'Art and culture', venues.openGround, 4, '17:00', '18:30', { tags: ['Sketching', 'Creative', 'Beginner friendly'], interests: ['Art and culture', 'Workshops'], capacity: 20 }),
  makeQuest('demo-nsp-football', 'Friendly Football & Fitness Meetup', 'A social, low-pressure football session with warm-up drills and short mixed-team games. Participants should bring sports shoes and water.', 'Sports', venues.openGround, 5, '07:00', '09:00', { tags: ['Football', 'Fitness', 'Team sport'], interests: ['Sports', 'Community activities'], capacity: 22 }),
  makeQuest('demo-nsp-community-book', 'Community Book Swap', 'Bring one book in good condition, discover something new, and meet readers from the neighbourhood. No purchase or payment required.', 'Education', venues.nanaNani, 7, '10:00', '12:00', { tags: ['Books', 'Reading', 'Community'], interests: ['Education', 'Community activities'], capacity: 35 }),
  makeQuest('demo-nsp-zalawad-cleanup', 'Green Neighbourhood Volunteer Hour', 'A sample community volunteering activity focused on litter awareness and keeping shared public spaces welcoming. Confirm permissions and arrangements before any real-world activity.', 'Community activities', venues.zalawad, 8, '08:00', '09:30', { tags: ['Volunteering', 'Environment', 'Community'], interests: ['Community activities', 'Nature'], capacity: 30 }),
  makeQuest('demo-nsp-dance', 'Open-Air Dance Fitness', 'A beginner-friendly dance-fitness practice with simple follow-along routines and short breaks. Comfortable shoes recommended.', 'Fitness', venues.parishadPark, 10, '17:30', '18:30', { tags: ['Dance', 'Fitness', 'Beginner friendly'], interests: ['Fitness', 'Music'], capacity: 28 }),
  makeQuest('demo-nsp-heritage-walk', 'Sopara Stories: Local History Walk', 'A sample self-guided neighbourhood history walk beginning near the station. Explore local heritage themes and public landmarks; no guide or official tour is included.', 'History and heritage', venues.station, 12, '08:00', '09:30', { tags: ['Local history', 'Walking', 'Culture'], interests: ['History and heritage', 'Art and culture'], capacity: 18 }),
];

module.exports = { nallasoparaDemoQuests };
