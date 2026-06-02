// ============================================================
// server.js — Complete Backend for "Tutor for All" Platform
// ============================================================
// Stack  : Node.js · Express · Mongoose (MongoDB)
// Covers : Auth · Enrollment · Payments · Dashboard ·
//          Admin · Chat Messages · Assessments · Games
// ============================================================

// ── 1. CORE DEPENDENCIES ─────────────────────────────────────
const express    = require('express');       // Web framework
const mongoose   = require('mongoose');      // MongoDB ODM
const cors       = require('cors');          // Cross-origin requests (front-end on diff port)
const helmet     = require('helmet');        // Security HTTP headers
const morgan     = require('morgan');        // HTTP request logger
const bcrypt     = require('bcryptjs');      // Password hashing
const jwt        = require('jsonwebtoken'); // JSON Web Tokens for auth
const path       = require('path');          // Node built-in path utilities
require('dotenv').config();                  // Load .env variables into process.env

// ── 2. IMPORT MONGODB CONNECTION ─────────────────────────────
const { connectDB } = require('./db');       // Our dedicated DB connection file

// ── 3. CREATE EXPRESS APP ─────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 5000;      // Server port (override via .env)

// ── 4. GLOBAL MIDDLEWARE ──────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || '*',    // Allow all origins in dev; restrict in prod
  credentials: true,                        // Allow cookies / auth headers
}));
app.use(helmet());                          // Adds Content-Security-Policy, X-Frame-Options etc.
app.use(morgan('dev'));                     // Logs: METHOD /route STATUS time
app.use(express.json());                    // Parse incoming JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded form data

// ── 5. SERVE STATIC FRONT-END ─────────────────────────────────
// Place index.html in a folder called "public" next to server.js.
// The front-end fetches /api/... endpoints below.
app.use(express.static(path.join(__dirname, 'public')));

// ── 5a. DISASTER WEATHER MODULE ──────────────────────────────
const weatherRoutes = require('./disaster/weatherRoutes');
app.use('/api/weather', weatherRoutes);                          // REST API
app.use('/disaster', express.static(path.join(__dirname, 'disaster/public'))); // Dashboard UI

// ── 6. MONGOOSE SCHEMAS & MODELS ─────────────────────────────

// ── 6a. User Schema ──────────────────────────────────────────
// Covers both students and tutors (role field differentiates)
const userSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },           // Full display name
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:     { type: String, required: true, trim: true },           // Indian mobile number
  password:  { type: String, required: true, minlength: 6 },        // Stored as bcrypt hash
  role:      { type: String, enum: ['student', 'tutor', 'admin'], default: 'student' },
  city:      { type: String, trim: true },                           // Student's city
  isActive:  { type: Boolean, default: false },                      // Admin must activate
  plan:      { type: String, enum: ['basic', 'pro', 'elite'], default: 'basic' }, // Subscription tier
  subjects:  [{ type: String }],                                     // Enrolled subjects array
}, { timestamps: true }); // adds createdAt & updatedAt automatically

// Hash password before saving (pre-save hook)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();  // Only hash if password changed
  this.password = await bcrypt.hash(this.password, 12); // Salt rounds = 12
  next();
});

// Instance method to compare plain password vs stored hash
userSchema.methods.matchPassword = async function (plain) {
  return await bcrypt.compare(plain, this.password);
};

const User = mongoose.model('User', userSchema);

// ── 6b. Enrollment Schema ────────────────────────────────────
// Tracks a student's enrollment application before activation
const enrollmentSchema = new mongoose.Schema({
  name:          { type: String, required: true },   // Student name from form
  phone:         { type: String, required: true },   // Contact number
  email:         { type: String },                   // Optional at enrollment step
  subjects:      [{ type: String }],                 // Subjects picked on enrollment page
  plan:          { type: String, default: 'pro' },   // Plan chosen
  city:          { type: String },                   // City field from form
  parentName:    { type: String },                   // Parent / guardian name
  parentPhone:   { type: String },                   // Parent contact
  goal:          { type: String },                   // "JEE / NEET / Board" etc.
  status:        { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
}, { timestamps: true });

const Enrollment = mongoose.model('Enrollment', enrollmentSchema);

// ── 6c. Payment Schema ───────────────────────────────────────
// Minimal payment record (never store real card data!)
const paymentSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Link to user
  enrollId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment' },
  plan:        { type: String, required: true },    // basic / pro / elite
  amount:      { type: Number, required: true },    // Amount in INR paise (₹999 → 99900)
  currency:    { type: String, default: 'INR' },
  status:      { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  method:      { type: String, default: 'card' },   // card / upi / netbanking
  txnRef:      { type: String },                    // Transaction reference / Razorpay ID
  cardLast4:   { type: String, maxlength: 4 },      // Last 4 digits only — never full card!
  payerName:   { type: String },                    // Name on card
}, { timestamps: true });

const Payment = mongoose.model('Payment', paymentSchema);

// ── 6d. Class / Session Schema ───────────────────────────────
// Represents live or recorded class sessions shown in dashboard
const classSchema = new mongoose.Schema({
  title:       { type: String, required: true },   // e.g. "Reaction Mechanisms"
  subject:     { type: String, required: true },   // Chemistry / DBMS / Mathematics
  tutorId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tutorName:   { type: String },                   // Cached for quick display
  scheduledAt: { type: Date, required: true },     // When the class starts
  duration:    { type: Number, default: 60 },      // Duration in minutes
  status:      { type: String, enum: ['upcoming', 'live', 'completed'], default: 'upcoming' },
  meetLink:    { type: String },                   // Google Meet / Zoom link
  recordingUrl:{ type: String },                   // Video URL after class ends
  enrolledIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Students enrolled
}, { timestamps: true });

const Class = mongoose.model('Class', classSchema);

// ── 6e. Study Material Schema ────────────────────────────────
const materialSchema = new mongoose.Schema({
  name:       { type: String, required: true },   // "Organic Chemistry Notes"
  subject:    { type: String, required: true },
  type:       { type: String, enum: ['pdf', 'video', 'notes', 'worksheet'] },
  fileUrl:    { type: String },                   // S3 / Cloudinary URL
  fileSize:   { type: String },                   // Human-readable "2.4 MB"
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  downloads:  { type: Number, default: 0 },
}, { timestamps: true });

const Material = mongoose.model('Material', materialSchema);

// ── 6f. Chat Message Schema ──────────────────────────────────
// Simple support chat stored in DB (could also use Socket.io)
const chatSchema = new mongoose.Schema({
  roomId:    { type: String, required: true },  // "support-<userId>" or group ID
  senderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  senderName:{ type: String },
  role:      { type: String, enum: ['student', 'support'] },
  message:   { type: String, required: true, trim: true },
}, { timestamps: true });

const Chat = mongoose.model('Chat', chatSchema);

// ── 6g. Assessment / Quiz Schema ─────────────────────────────
const assessmentSchema = new mongoose.Schema({
  title:    { type: String, required: true },   // "Chemistry Quiz 1"
  subject:  { type: String },
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  score:    { type: Number },                   // Marks obtained
  maxScore: { type: Number },                   // Total marks
  answers:  [{ question: String, selected: String, correct: Boolean }],
  timeTaken:{ type: Number },                   // Seconds taken to complete
}, { timestamps: true });

const Assessment = mongoose.model('Assessment', assessmentSchema);

// ── 6h. Game Score Schema ─────────────────────────────────────
const gameScoreSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String },
  game:     { type: String },   // "element-rush" / "true-false"
  score:    { type: Number, default: 0 },
}, { timestamps: true });

const GameScore = mongoose.model('GameScore', gameScoreSchema);

// ── 7. AUTH HELPERS ──────────────────────────────────────────

// Generate a signed JWT token (expires in 7 days)
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'changeme_secret_key', { expiresIn: '7d' });

// Middleware: verify JWT on protected routes
const protect = async (req, res, next) => {
  let token;
  // Token must arrive in Authorization header as "Bearer <token>"
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ error: 'Not authorised — no token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'changeme_secret_key');
    req.user = await User.findById(decoded.id).select('-password'); // attach user, hide password
    if (!req.user) return res.status(401).json({ error: 'User no longer exists' });
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalid or expired' });
  }
};

// Middleware: restrict route to admins only
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Admin access required' });
  next();
};

// ── 8. ROUTES ────────────────────────────────────────────────

// ── 8a. Health Check ─────────────────────────────────────────
// GET /api/health
// Returns server & DB status. Useful for load balancers and monitoring.
app.get('/api/health', (req, res) => {
  res.json({
    status:   'ok',
    server:   'Tutor for All API',
    dbState:  mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time:     new Date().toISOString(),
  });
});

// ── 8b. AUTH ROUTES ──────────────────────────────────────────

// POST /api/auth/register
// Body: { name, email, phone, password, role? }
// Creates a new user account. Admin must set isActive=true before they can log in.
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password)
      return res.status(400).json({ error: 'name, email, phone, and password are required' });

    // Prevent duplicate email
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    // Create user (password is hashed by pre-save hook in schema)
    const user = await User.create({ name, email, phone, password, role: role || 'student' });

    res.status(201).json({
      message: 'Registration successful. Await admin activation.',
      userId: user._id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
// Body: { email, password }
// Returns a JWT token used in subsequent protected requests.
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await user.matchPassword(password);    // Compare with bcrypt hash
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    if (!user.isActive && user.role !== 'admin')         // Block inactive accounts
      return res.status(403).json({ error: 'Account not yet activated by admin' });

    res.json({
      token: generateToken(user._id),                   // Send JWT to client
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        plan:  user.plan,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me  (protected)
// Returns the logged-in user's profile. Front-end calls this to restore session.
app.get('/api/auth/me', protect, (req, res) => {
  res.json({ user: req.user });
});

// PATCH /api/auth/change-password  (protected)
// Body: { currentPassword, newPassword }
app.patch('/api/auth/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    const match = await user.matchPassword(currentPassword);
    if (!match) return res.status(400).json({ error: 'Current password is incorrect' });
    user.password = newPassword;        // Pre-save hook will re-hash automatically
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 8c. ENROLLMENT ROUTES ────────────────────────────────────

// POST /api/enrollments
// Body: { name, phone, email?, subjects[], plan, city, parentName, parentPhone, goal }
// Public route — student submits enrollment form from the UI.
app.post('/api/enrollments', async (req, res) => {
  try {
    const enroll = await Enrollment.create(req.body);  // Save form data as-is
    res.status(201).json({ message: 'Enrollment submitted successfully', id: enroll._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/enrollments  (admin)
// Query params: ?status=pending&page=1&limit=20
// Returns paginated list of enrollments for the admin panel.
app.get('/api/enrollments', protect, adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};           // Filter by pending/approved/rejected
    const total  = await Enrollment.countDocuments(filter);
    const list   = await Enrollment.find(filter)
      .sort({ createdAt: -1 })                         // Newest first
      .skip((page - 1) * limit)                        // Pagination offset
      .limit(Number(limit));
    res.json({ total, page: Number(page), list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/enrollments/:id/approve  (admin)
// Marks enrollment as approved (admin clicks "Approve" button)
app.patch('/api/enrollments/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const enroll = await Enrollment.findByIdAndUpdate(
      req.params.id,
      { status: 'approved' },
      { new: true }          // Return updated document
    );
    if (!enroll) return res.status(404).json({ error: 'Enrollment not found' });
    res.json({ message: 'Enrollment approved', enroll });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/enrollments/:id/reject  (admin)
app.patch('/api/enrollments/:id/reject', protect, adminOnly, async (req, res) => {
  try {
    const enroll = await Enrollment.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected' },
      { new: true }
    );
    if (!enroll) return res.status(404).json({ error: 'Enrollment not found' });
    res.json({ message: 'Enrollment rejected', enroll });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 8d. PAYMENT ROUTES ───────────────────────────────────────

// POST /api/payments
// Body: { plan, amount, payerName, cardLast4, enrollId? }
// In production: integrate Razorpay / Stripe here instead of raw card data.
app.post('/api/payments', protect, async (req, res) => {
  try {
    const { plan, amount, payerName, cardLast4, enrollId } = req.body;

    if (!plan || !amount)
      return res.status(400).json({ error: 'plan and amount are required' });

    // Create payment record with status 'success' for demo
    // In production: call Razorpay API, verify webhook, then mark success
    const payment = await Payment.create({
      userId:   req.user._id,      // Logged-in user's ID from JWT
      enrollId: enrollId || null,
      plan,
      amount,                      // Store in paise (₹999 = 99900)
      status:   'success',
      payerName,
      cardLast4: cardLast4 || '',  // Only last 4 — NEVER store full card number!
      txnRef:   'TXN' + Date.now(), // Fake ref — replace with gateway ref in prod
    });

    // Upgrade user plan after successful payment
    await User.findByIdAndUpdate(req.user._id, { plan, isActive: true });

    // Mark enrollment as paid if enrollId provided
    if (enrollId) {
      await Enrollment.findByIdAndUpdate(enrollId, { paymentStatus: 'paid' });
    }

    res.status(201).json({ message: 'Payment recorded', paymentId: payment._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payments/my  (protected)
// Returns payment history for the logged-in student.
app.get('/api/payments/my', protect, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payments  (admin)
// Returns all payments; used in admin > Payments tab.
app.get('/api/payments', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const total    = await Payment.countDocuments();
    const payments = await Payment.find()
      .populate('userId', 'name email phone')   // Replace userId ObjectId with user fields
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ total, payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 8e. USER / STUDENT MANAGEMENT ROUTES (admin) ─────────────

// GET /api/users  (admin)
// Returns all users for the Students tab in admin panel.
app.get('/api/users', protect, adminOnly, async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const filter = role ? { role } : {};
    const total  = await User.countDocuments(filter);
    const users  = await User.find(filter)
      .select('-password')             // Never return password hash
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ total, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id  (admin or self)
// Returns a single user's full profile.
app.get('/api/users/:id', protect, async (req, res) => {
  try {
    const isSelf  = req.user._id.toString() === req.params.id;
    const isAdmin = req.user.role === 'admin';
    if (!isSelf && !isAdmin)
      return res.status(403).json({ error: 'Access denied' });

    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id/activate  (admin)
// Activates a student account after approval.
app.patch('/api/users/:id/activate', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User activated', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id  (admin)
// Permanently removes a user account.
app.delete('/api/users/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 8f. CLASS / SESSION ROUTES ───────────────────────────────

// GET /api/classes
// Protected. Students see their own enrolled classes; admins see all.
// Query: ?status=live&subject=Chemistry
app.get('/api/classes', protect, async (req, res) => {
  try {
    const { status, subject } = req.query;
    const filter = {};
    if (status)  filter.status  = status;
    if (subject) filter.subject = subject;

    // Students only see classes they are enrolled in
    if (req.user.role === 'student') filter.enrolledIds = req.user._id;

    const classes = await Class.find(filter).sort({ scheduledAt: 1 });
    res.json({ classes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/classes  (admin / tutor)
// Body: { title, subject, tutorId, scheduledAt, duration, meetLink }
app.post('/api/classes', protect, async (req, res) => {
  try {
    if (!['admin', 'tutor'].includes(req.user.role))
      return res.status(403).json({ error: 'Only tutors or admins can create classes' });

    const cls = await Class.create({ ...req.body, tutorName: req.user.name });
    res.status(201).json({ message: 'Class scheduled', cls });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/classes/:id/status  (admin / tutor)
// Body: { status: 'live' | 'completed' }
// Used to mark a class as live or completed.
app.patch('/api/classes/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const cls = await Class.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    res.json({ message: `Class status updated to ${status}`, cls });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 8g. STUDY MATERIAL ROUTES ────────────────────────────────

// GET /api/materials
// Protected. Returns study materials optionally filtered by subject.
app.get('/api/materials', protect, async (req, res) => {
  try {
    const { subject } = req.query;
    const filter = subject ? { subject } : {};
    const materials = await Material.find(filter).sort({ createdAt: -1 });
    res.json({ materials });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/materials  (admin / tutor)
// Body: { name, subject, type, fileUrl, fileSize }
// In production: handle actual file upload via multer + S3.
app.post('/api/materials', protect, async (req, res) => {
  try {
    if (!['admin', 'tutor'].includes(req.user.role))
      return res.status(403).json({ error: 'Only tutors or admins can upload materials' });

    const material = await Material.create({ ...req.body, uploadedBy: req.user._id });
    res.status(201).json({ message: 'Material uploaded', material });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/materials/:id/download  (protected)
// Increments download counter each time a student downloads.
app.patch('/api/materials/:id/download', protect, async (req, res) => {
  try {
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      { $inc: { downloads: 1 } },   // Atomic increment
      { new: true }
    );
    if (!material) return res.status(404).json({ error: 'Material not found' });
    res.json({ fileUrl: material.fileUrl, downloads: material.downloads });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/materials/:id  (admin)
app.delete('/api/materials/:id', protect, adminOnly, async (req, res) => {
  try {
    const material = await Material.findByIdAndDelete(req.params.id);
    if (!material) return res.status(404).json({ error: 'Material not found' });
    res.json({ message: 'Material deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 8h. CHAT MESSAGE ROUTES ──────────────────────────────────

// GET /api/chat/:roomId  (protected)
// Returns message history for a given room (e.g. "support-<userId>").
app.get('/api/chat/:roomId', protect, async (req, res) => {
  try {
    const messages = await Chat.find({ roomId: req.params.roomId })
      .sort({ createdAt: 1 })    // Chronological order
      .limit(100);               // Cap at 100 messages per fetch
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/:roomId  (protected)
// Body: { message }
// Student or support agent posts a chat message.
app.post('/api/chat/:roomId', protect, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message cannot be empty' });

    const chat = await Chat.create({
      roomId:     req.params.roomId,
      senderId:   req.user._id,
      senderName: req.user.name,
      role:       req.user.role === 'student' ? 'student' : 'support',
      message:    message.trim(),
    });
    res.status(201).json({ chat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 8i. ASSESSMENT / QUIZ ROUTES ─────────────────────────────

// POST /api/assessments  (protected)
// Body: { title, subject, score, maxScore, answers[], timeTaken }
// Called when student submits a quiz.
app.post('/api/assessments', protect, async (req, res) => {
  try {
    const result = await Assessment.create({ ...req.body, userId: req.user._id });
    res.status(201).json({ message: 'Assessment submitted', result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/assessments/my  (protected)
// Returns the logged-in student's assessment history (used in Progress tab).
app.get('/api/assessments/my', protect, async (req, res) => {
  try {
    const results = await Assessment.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/assessments  (admin)
// Returns all assessments across all students.
app.get('/api/assessments', protect, adminOnly, async (req, res) => {
  try {
    const results = await Assessment.find()
      .populate('userId', 'name email')   // Attach student name/email
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 8j. GAME SCORE ROUTES ─────────────────────────────────────

// POST /api/games/score  (protected)
// Body: { game, score }
// Saves a player's score after each game session.
app.post('/api/games/score', protect, async (req, res) => {
  try {
    const { game, score } = req.body;
    if (!game || score === undefined)
      return res.status(400).json({ error: 'game and score are required' });

    const entry = await GameScore.create({
      userId:   req.user._id,
      userName: req.user.name,
      game,
      score,
    });
    res.status(201).json({ message: 'Score saved', entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/games/leaderboard  (protected)
// Query: ?game=element-rush&limit=10
// Returns top scores for a specific game (shown on leaderboard).
app.get('/api/games/leaderboard', protect, async (req, res) => {
  try {
    const { game, limit = 10 } = req.query;
    const filter = game ? { game } : {};
    const scores = await GameScore.find(filter)
      .sort({ score: -1 })           // Highest score first
      .limit(Number(limit))
      .select('userName game score createdAt'); // Only safe fields
    res.json({ scores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 8k. ADMIN DASHBOARD STATS ────────────────────────────────

// GET /api/admin/stats  (admin)
// Returns aggregate numbers for the admin overview cards.
app.get('/api/admin/stats', protect, adminOnly, async (req, res) => {
  try {
    const [totalStudents, activeTutors, paymentsAgg, classesToday] = await Promise.all([
      User.countDocuments({ role: 'student' }),                          // Total students
      User.countDocuments({ role: 'tutor', isActive: true }),           // Active tutors
      Payment.aggregate([                                                // Revenue this month
        {
          $match: {
            status: 'success',
            createdAt: { $gte: new Date(new Date().setDate(1)) },       // First day of month
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Class.countDocuments({                                             // Classes scheduled today
        scheduledAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt:  new Date(new Date().setHours(23, 59, 59, 999)),
        },
      }),
    ]);

    res.json({
      totalStudents,
      activeTutors,
      revenueThisMonth: paymentsAgg[0]?.total || 0,  // Returns 0 if no payments
      classesToday,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 9. 404 HANDLER ───────────────────────────────────────────
// Catch-all for any unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

// ── 10. GLOBAL ERROR HANDLER ─────────────────────────────────
// Catches any error passed via next(err) from route handlers
app.use((err, req, res, _next) => {
  console.error('🔥 Unhandled Error:', err.stack || err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// ── 11. STARTUP ──────────────────────────────────────────────
// Connect to MongoDB first, then start listening for HTTP requests.
const start = async () => {
  await connectDB();                               // Establishes Mongoose connection (from db.js)
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📋 API docs base  : http://localhost:${PORT}/api`);
    console.log(`❤️  Health check  : http://localhost:${PORT}/api/health`);
  });
};

start();

// ── 12. GRACEFUL SHUTDOWN ─────────────────────────────────────
// Ensures DB connections are closed cleanly on Ctrl+C or PM2 stop
process.on('SIGINT',  () => { console.log('\n🛑 Shutting down...'); mongoose.disconnect(); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n🛑 SIGTERM received.'); mongoose.disconnect(); process.exit(0); });
