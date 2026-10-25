const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { UserModel, EventModel, BookingModel } = require('../db');
const { getDemoUsers, organizerTestEvents, demoBookings } = require('../demoData');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function seedDemoData() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log('[SeedDemo] MONGO_URI not configured. Skipping persistent demo seed.');
    return;
  }

  await mongoose.connect(uri);
  console.log('[SeedDemo] Connected to MongoDB. Seeding demo accounts and testing state...');

  const demoUsers = await getDemoUsers();

  let userCreated = 0;
  let userUpdated = 0;
  for (const user of demoUsers) {
    const existing = await UserModel.findOne({ email: user.email });
    if (existing) {
      await UserModel.updateOne({ _id: existing._id }, { $set: user });
      userUpdated += 1;
    } else {
      await UserModel.create(user);
      userCreated += 1;
    }
  }
  console.log(`[SeedDemo] Demo users: ${userCreated} created, ${userUpdated} updated.`);

  let eventCreated = 0;
  for (const event of organizerTestEvents) {
    const existing = await EventModel.findOne({ id: event.id });
    if (existing) {
      await EventModel.updateOne({ _id: existing._id }, { $set: event });
    } else {
      await EventModel.create(event);
      eventCreated += 1;
    }
  }
  console.log(`[SeedDemo] Organizer test events seeded: ${organizerTestEvents.length} records.`);

  let bookingCreated = 0;
  for (const booking of demoBookings) {
    const existing = await BookingModel.findOne({ bookingRef: booking.bookingRef });
    if (!existing) {
      await BookingModel.create(booking);
      bookingCreated += 1;
    }
  }
  console.log(`[SeedDemo] Demo bookings seeded: ${bookingCreated} new records.`);

  await mongoose.disconnect();
}

if (require.main === module) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[SeedDemo] Error seeding demo data:', err);
      process.exit(1);
    });
}

module.exports = { seedDemoData };

