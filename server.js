require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const path     = require('path');
const session  = require('express-session');
const { hydrateSessionUser } = require('./middleware/authMiddleware');

const app  = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/grievance-verification';

// ── Global Middleware — ensure ngrok doesn't block webhooks (Twilio/IVR) ─────
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', '1');
  if (req.url.includes('/api/ivr') || req.url.includes('/audio/')) {
    console.log(`[IVR-TRAFFIC] ${req.method} ${req.url} | UA: ${req.headers['user-agent']}`);
  }
  next();
});

// ── Body parsers & static files ──────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Session ──────────────────────────────────────────────────────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev_session_secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   1000 * 60 * 60 * 12      // 12 hours
  }
}));

// ── IVR webhook routes — registered BEFORE session hydration so Twilio
//    callbacks (which send no session cookie) are handled cleanly ────────────
const ivrRoutes = require('./routes/ivrRoutes');
app.use('/api/ivr', ivrRoutes);

// ── Public routes (no auth required) ──────────────────────────────────────────
const publicRoutes = require('./routes/publicRoutes');
app.use('/public', (req, res, next) => {
  res.locals.currentUser = null;  // layout templates expect this variable
  next();
}, publicRoutes);

// ── Hydrate session for all authenticated routes ──────────────────────────────
app.use(hydrateSessionUser);

// ── View engine ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── MongoDB ───────────────────────────────────────────────────────────────────
mongoose.connect(MONGO_URI)
  .then(() => console.log('✓ Connected to MongoDB'))
  .catch(err => console.error('✗ MongoDB connection error:', err));

// ── Application routes ────────────────────────────────────────────────────────
const indexRoutes        = require('./routes/indexRoutes');
const authRoutes         = require('./routes/auth');
const citizenRoutes      = require('./routes/citizenRoutes');
const departmentRoutes   = require('./routes/departmentRoutes');
const fieldOfficerRoutes = require('./routes/fieldOfficerRoutes');
const collectorRoutes    = require('./routes/collectorRoutes');

app.use('/',           indexRoutes);
app.use('/auth',       authRoutes);
app.use('/citizen',    citizenRoutes);
app.use('/department', departmentRoutes);
app.use('/officer',    fieldOfficerRoutes);
app.use('/collector',  collectorRoutes);

// ── Serve uploaded evidence photos ────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.listen(PORT, () => {
    console.log(`✓ Swagat Grievance Server running on http://localhost:${PORT}`);
    console.log(`  IVR webhooks: ${process.env.BACKEND_URL || '(BACKEND_URL not set)'}/api/ivr/...`);
});
