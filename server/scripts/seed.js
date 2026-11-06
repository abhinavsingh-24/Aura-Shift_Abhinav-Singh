const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { EventModel } = require('../db');
const { verifiedIndiaEvents } = require('../indiaEvents');
const { nallasoparaDemoQuests } = require('../localDemoEvents');
const allSeedEvents = [...verifiedIndiaEvents, ...nallasoparaDemoQuests];

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function seedEvents() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log('[Seed] MONGO_URI not configured. Skipping persistent seed (in-memory dataset will use India events).');
    return;
  }

  await mongoose.connect(uri);
  console.log('[Seed] Connected to MongoDB. Seeding India events and Nallasopara demo quests idempotently...');

  let createdCount = 0;
  let updatedCount = 0;

  for (const event of allSeedEvents) {
    const existing = await EventModel.findOne({
      $or: [{ id: event.id }, { title: event.title }],
    });

    if (existing) {
      await EventModel.updateOne({ _id: existing._id }, { $set: event });
      updatedCount += 1;
    } else {
      await EventModel.create({ ...event, isSampleData: Boolean(event.isSampleData) });
      createdCount += 1;
    }
  }

  console.log(`[Seed] Event seed completed successfully. Created: ${createdCount}, Updated/Verified: ${updatedCount}. Total: ${allSeedEvents.length}`);
  await mongoose.disconnect();
}

if (require.main === module) {
  seedEvents()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Error seeding events:', err);
      process.exit(1);
    });
}

module.exports = { seedEvents };

