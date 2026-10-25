require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const {
  EventModel,
  UserModel,
  BookingModel,
  RegistrationModel,
  PaymentModel,
  ReportModel,
  AuditLogModel,
} = require('../db');

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is missing in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB successfully.');

  // 1. Fetch current counts
  const totalEventsBefore = await EventModel.countDocuments();
  const totalUsersBefore = await UserModel.countDocuments();
  const totalBookingsBefore = await BookingModel.countDocuments();
  const totalRegistrationsBefore = await RegistrationModel.countDocuments();

  console.log('\n--- CURRENT DATABASE STATS ---');
  console.log(`Total Events: ${totalEventsBefore}`);
  console.log(`Total Users: ${totalUsersBefore}`);
  console.log(`Total Bookings: ${totalBookingsBefore}`);
  console.log(`Total Registrations: ${totalRegistrationsBefore}`);

  // 2. Perform full backup before any modification
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.resolve(__dirname, `../backups/backup-pre-cleanup-${timestamp}.json`);

  const allEvents = await EventModel.find({}).lean();
  const allUsers = await UserModel.find({}).lean();
  const allBookings = await BookingModel.find({}).lean();
  const allRegistrations = await RegistrationModel.find({}).lean();
  const allPayments = await PaymentModel.find({}).lean();
  const allReports = await ReportModel.find({}).lean();

  const backupData = {
    createdAt: new Date().toISOString(),
    counts: {
      events: allEvents.length,
      users: allUsers.length,
      bookings: allBookings.length,
      registrations: allRegistrations.length,
      payments: allPayments.length,
      reports: allReports.length,
    },
    events: allEvents,
    users: allUsers.map(u => ({ ...u, passwordHash: '[REDACTED_FOR_SECURITY]' })),
    bookings: allBookings,
    registrations: allRegistrations,
    payments: allPayments,
    reports: allReports,
  };

  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log(`\nBackup successfully written to: ${backupPath}`);

  // 3. Identify synthetic duplicate "Concert Tour <timestamp>" events
  // Pattern: Title starts with "Concert Tour " followed by numbers
  const syntheticEvents = await EventModel.find({
    title: { $regex: /^Concert Tour \d+/i },
  }).lean();

  console.log(`\nFound ${syntheticEvents.length} synthetic "Concert Tour <timestamp>" events:`);
  const syntheticIds = [];

  for (const ev of syntheticEvents) {
    // Check if any bookings or registrations exist for this event
    const eventId = ev.id || String(ev._id);
    const bookingsForEvent = await BookingModel.countDocuments({
      $or: [{ eventId: eventId }, { eventId: String(ev._id) }, { eventId: ev.id }],
    });
    const regForEvent = await RegistrationModel.countDocuments({
      $or: [{ eventId: eventId }, { eventId: String(ev._id) }, { eventId: ev.id }],
    });

    console.log(`- ID: ${eventId} | Title: "${ev.title}" | Venue: "${ev.venue}" | Bookings: ${bookingsForEvent} | Registrations: ${regForEvent}`);

    if (bookingsForEvent === 0 && regForEvent === 0) {
      syntheticIds.push(ev._id);
    } else {
      console.warn(`  WARNING: Event ${eventId} has active bookings/registrations! Skipping deletion.`);
    }
  }

  // 4. Safely delete ONLY confirmed synthetic events with 0 bookings
  if (syntheticIds.length > 0) {
    console.log(`\nDeleting ${syntheticIds.length} synthetic records...`);
    const deleteResult = await EventModel.deleteMany({
      _id: { $in: syntheticIds },
    });
    console.log(`Deleted ${deleteResult.deletedCount} events from MongoDB Atlas.`);
  } else {
    console.log('\nNo synthetic records to delete.');
  }

  // 5. Verify database post-cleanup
  const totalEventsAfter = await EventModel.countDocuments();
  console.log(`\nTotal events remaining in DB: ${totalEventsAfter}`);

  const remainingEvents = await EventModel.find({}, 'id title city category isSampleData').lean();
  console.log('\nRemaining Events List:');
  remainingEvents.forEach((e, idx) => {
    console.log(`  ${idx + 1}. [${e.city}] ${e.title} (${e.category}) - ID: ${e.id}`);
  });

  // Verify real user exists
  const realUser = await UserModel.findOne({ email: 'pinkeshchavhan159@gmail.com' });
  console.log('\nGenuine user check:');
  if (realUser) {
    console.log(`  Verified user pinkeshchavhan159@gmail.com is intact. (Role: ${realUser.role})`);
  } else {
    console.error('  ERROR: pinkeshchavhan159@gmail.com not found!');
  }

  await mongoose.disconnect();
  console.log('\nDatabase cleanup complete and connection closed.');
}

main().catch(err => {
  console.error('Fatal error in cleanup script:', err);
  process.exit(1);
});

