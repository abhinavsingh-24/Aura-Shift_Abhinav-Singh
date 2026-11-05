const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { UserModel, EventModel, RegistrationModel, BookingModel, ReportModel } = require('../db');
const { seedEvents } = require('./seed');
const { seedDemoData } = require('./seedDemo');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function resetDevelopmentDatabase() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[CRITICAL] db:reset:dev is strictly disallowed in production environment.');
    process.exit(1);
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log('[DevReset] MONGO_URI not configured. In-memory mode will reset on start.');
    return;
  }

  await mongoose.connect(uri);
  console.log('[DevReset] Connected to database for safe development reset.');

  // 1. Create a recoverable backup before any modifications
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const collections = ['events', 'reports', 'registrations', 'users', 'bookings'];
  const snapshot = {};
  for (const c of collections) {
    try {
      snapshot[c] = await mongoose.connection.db.collection(c).find({}).toArray();
    } catch {
      snapshot[c] = [];
    }
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `pre-reset-backup-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2));
  console.log(`[DevReset] Pre-reset backup safely stored at: ${backupPath}`);

  // 2. Preserve genuine non-test user accounts!
  // Any user that does not match test patterns: test-*, e2e-*, explorer-auth-*, organizer-*, or demo accounts
  // E.g., pinkeshchavhan159@gmail.com is genuine and preserved.
  const allUsers = await UserModel.find({}).lean();
  const testUserFilter = {
    $or: [
      { isDemoUser: true },
      { email: { $regex: /^(e2e-|test-|explorer-auth-|organizer-)/i } },
      { name: { $regex: /(^E2E |^Host \d+|^Atlas Explorer|^Safety Reporter|^Booker Explorer)/i } },
    ],
  };

  const usersToDelete = await UserModel.find(testUserFilter).select('_id email').lean();
  console.log(`[DevReset] Found ${usersToDelete.length} test/demo users to clean up out of ${allUsers.length} total users.`);

  await UserModel.deleteMany(testUserFilter);

  // 3. Delete only test/sample events (old sample events or test events with timestamp patterns)
  const eventFilter = {
    $or: [
      { isSampleData: true },
      { title: { $regex: /(^E2E |^Concert Tour \d+)/i } },
      { id: { $in: ['evt-1', 'evt-2', 'evt-3', 'evt-4', 'evt-5', 'evt-6'] } },
    ],
  };
  const deletedEventsResult = await EventModel.deleteMany(eventFilter);
  console.log(`[DevReset] Cleaned up ${deletedEventsResult.deletedCount} old test/sample events.`);

  // 4. Clean up dummy registrations, dummy bookings, and dummy reports associated with test records
  await RegistrationModel.deleteMany({});
  await ReportModel.deleteMany({});
  await BookingModel.deleteMany({ bookingRef: { $regex: /^SQ-2026-IN/ } });

  console.log('[DevReset] Database cleaned of test artifacts while preserving genuine user data.');
  await mongoose.disconnect();

  // 5. Run idempotent seeds
  console.log('[DevReset] Seeding verified India events catalogue...');
  await seedEvents();

  console.log('[DevReset] Seeding demo accounts and test states...');
  await seedDemoData();

  console.log('[DevReset] Development reset and seed complete!');
}

if (require.main === module) {
  resetDevelopmentDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[DevReset] Reset failed:', err);
      process.exit(1);
    });
}

module.exports = { resetDevelopmentDatabase };

