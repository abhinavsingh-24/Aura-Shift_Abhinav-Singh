const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, sparse: true, index: true },
    title: String,
    description: String,
    category: String,
    interests: [String],
    date: String,
    startTime: String,
    city: String,
    locality: String,
    venue: String,
    organizerName: String,
    capacity: Number,
    registrationUrl: String,
    imageUrl: String,
    latitude: Number,
    longitude: Number,
    ownerId: String,
    isSampleData: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'events' },
);

const registrationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, sparse: true },
    eventId: { type: String, required: true, index: true },
    participantId: { type: String, required: true },
    participantName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'registrations' },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['explorer', 'organizer'], default: 'explorer' },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'users' },
);

const EventModel = mongoose.models.Event || mongoose.model('Event', eventSchema);
registrationSchema.index({ eventId: 1, participantId: 1 }, { unique: true });

const RegistrationModel = mongoose.models.Registration || mongoose.model('Registration', registrationSchema);
const UserModel = mongoose.models.User || mongoose.model('User', userSchema);

async function connectMongo(uri) {
  if (!uri) return false;

  try {
    await mongoose.connect(uri);
    return true;
  } catch (error) {
    console.warn('MongoDB connection failed. Falling back to in-memory storage.', error.message);
    return false;
  }
}

module.exports = {
  connectMongo,
  EventModel,
  RegistrationModel,
  UserModel,
};
