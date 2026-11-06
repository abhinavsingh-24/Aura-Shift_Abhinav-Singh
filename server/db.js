const mongoose = require('mongoose');

const ticketTierSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => `tier-${Math.random().toString(36).slice(2, 9)}` },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, default: 'INR' },
    capacity: { type: Number, required: true, min: 1 },
    soldCount: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const eventSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, sparse: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true, index: true },
    tags: [String],
    interests: [String],
    date: { type: String, required: true, index: true },
    startTime: { type: String, required: true },
    endDate: { type: String },
    endTime: { type: String },
    city: { type: String, required: true, index: true },
    state: { type: String, default: '' },
    locality: { type: String, default: '' },
    venue: { type: String, required: true },
    isOnline: { type: Boolean, default: false },
    organizerName: { type: String, required: true },
    organizerId: { type: String, index: true },
    ownerId: { type: String, index: true },
    capacity: { type: Number },
    registrationUrl: { type: String },
    imageUrl: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled', 'unverified'],
      default: 'published',
      index: true,
    },
    isFree: { type: Boolean, default: true },
    priceStarting: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    bookingDeadline: { type: String },
    cancellationPolicy: {
      type: String,
      default: 'Free cancellation up to 24 hours before the event starts.',
    },
    terms: { type: String, default: '' },
    source: {
      name: { type: String, default: 'Verified Public Announcement' },
      url: { type: String },
      verifiedDate: { type: String },
      license: { type: String, default: 'Fair use / Public event announcement' },
    },
    ticketTiers: [ticketTierSchema],
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
registrationSchema.index({ eventId: 1, participantId: 1 }, { unique: true });

const bookingSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    bookingRef: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    buyerName: { type: String, required: true },
    buyerEmail: { type: String, required: true },
    buyerPhone: { type: String, default: '' },
    ticketTierId: { type: String, default: 'free-tier' },
    ticketTierName: { type: String, default: 'General RSVP' },
    quantity: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'refunded', 'failed'],
      default: 'confirmed',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['free', 'pending', 'paid', 'refunded', 'failed'],
      default: 'free',
      index: true,
    },
    paymentId: { type: String, default: '' },
    paymentOrderId: { type: String, default: '' },
    qrCodeData: { type: String, default: '' },
    isCheckedIn: { type: Boolean, default: false, index: true },
    checkedInAt: { type: Date },
    checkedInBy: { type: String },
    refundReason: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: 'bookings' },
);

const paymentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    bookingId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    paymentId: { type: String, default: '' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['created', 'captured', 'failed', 'refunded'],
      default: 'created',
      index: true,
    },
    signature: { type: String, default: '' },
    method: { type: String, default: 'SANDBOX' },
    idempotencyKey: { type: String, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'payments' },
);

const reportSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, sparse: true },
    reporterId: { type: String, required: true, index: true },
    reporterName: { type: String, required: true },
    targetType: { type: String, enum: ['event', 'organizer'], required: true },
    targetId: { type: String, required: true, index: true },
    targetLabel: { type: String, required: true, maxlength: 160 },
    reason: {
      type: String,
      required: true,
      enum: ['misleading', 'unsafe', 'spam', 'harassment', 'inappropriate', 'other'],
    },
    details: { type: String, maxlength: 1000, default: '' },
    status: {
      type: String,
      enum: ['received', 'reviewing', 'resolved', 'dismissed'],
      default: 'received',
      index: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'reports' },
);

const userSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, sparse: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['explorer', 'organizer', 'admin'], default: 'explorer', index: true },
    phone: { type: String, default: '' },
    organizationName: { type: String, default: '' },
    isVerified: { type: Boolean, default: false },
    isDemoUser: { type: Boolean, default: false },
    interests: { type: [String], default: [] },
    preferredCity: { type: String, default: '' },
    preferredLocality: { type: String, default: '' },
    homeLocation: { type: mongoose.Schema.Types.Mixed, default: null },
    onboardingCompleted: { type: Boolean, default: false },
    remindersEnabled: { type: Boolean, default: true },
    reminderLeadTime: { type: String, default: '1hour' },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'users' },
);

const auditLogSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    actorId: { type: String, index: true },
    actorEmail: { type: String },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true },
    targetId: { type: String, index: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'audit_logs' },
);

const geoLocationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    type: { type: String, required: true, enum: ['country', 'state', 'district', 'city', 'locality', 'postal_code'] },
    name: { type: String, required: true },
    nameLower: { type: String, required: true },
    altNames: { type: [String], default: [] },
    parentId: { type: String, default: null },
    countryId: { type: String, default: 'IN' },
    stateId: { type: String, default: null },
    districtId: { type: String, default: null },
    cityId: { type: String, default: null },
    code: { type: String, default: '' },
    pincode: { type: String, default: '' },
    officeType: { type: String, default: '' },
    geo: { type: { type: String, enum: ['Point'] }, coordinates: { type: [Number] } },
    active: { type: Boolean, default: true },
    editedByAdmin: { type: Boolean, default: false },
    source: { type: String, default: '' },
    datasetVersion: { type: String, default: '' },
    contentHash: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'geo_locations', minimize: false },
);
geoLocationSchema.index({ type: 1, nameLower: 1 });
geoLocationSchema.index({ type: 1, stateId: 1, nameLower: 1 });
geoLocationSchema.index({ type: 1, districtId: 1, nameLower: 1 });
geoLocationSchema.index({ type: 1, cityId: 1, nameLower: 1 });
geoLocationSchema.index({ pincode: 1, type: 1 });
geoLocationSchema.index({ parentId: 1 });
geoLocationSchema.index({ geo: '2dsphere' }, { sparse: true });

const geoImportSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    dataset: { type: String },
    source: { type: String },
    datasetVersion: { type: String },
    status: { type: String, index: true },
    dryRun: { type: Boolean, default: false },
    actorId: { type: String },
    actorEmail: { type: String },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    report: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { collection: 'geo_imports', minimize: false },
);

const reviewSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    eventId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    author: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    story: { type: String, required: true, maxlength: 500 },
    tips: { type: String, default: '', maxlength: 140 },
    verifiedAttendee: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'reviews' },
);
reviewSchema.index({ eventId: 1, userId: 1 }, { unique: true });

const GeoLocationModel = mongoose.models.GeoLocation || mongoose.model('GeoLocation', geoLocationSchema);
const GeoImportModel = mongoose.models.GeoImport || mongoose.model('GeoImport', geoImportSchema);
const ReviewModel = mongoose.models.Review || mongoose.model('Review', reviewSchema);
const EventModel = mongoose.models.Event || mongoose.model('Event', eventSchema);
const RegistrationModel = mongoose.models.Registration || mongoose.model('Registration', registrationSchema);
const BookingModel = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
const PaymentModel = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
const ReportModel = mongoose.models.Report || mongoose.model('Report', reportSchema);
const AuditLogModel = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

async function connectMongo(uri) {
  if (process.env.NODE_ENV === 'test') {
    return false;
  }
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
  BookingModel,
  PaymentModel,
  UserModel,
  ReportModel,
  AuditLogModel,
  ReviewModel,
  GeoLocationModel,
  GeoImportModel,
};
