require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const { hydrateSessionUser } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/grievance-verification';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 12
  }
}));
app.use(hydrateSessionUser);

// View Engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MongoDB Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
const indexRoutes = require('./routes/indexRoutes');
const authRoutes = require('./routes/auth');
const citizenRoutes = require('./routes/citizenRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const fieldOfficerRoutes = require('./routes/fieldOfficerRoutes');
const collectorRoutes = require('./routes/collectorRoutes');

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/citizen', citizenRoutes);
app.use('/department', departmentRoutes);
app.use('/', fieldOfficerRoutes);
app.use('/', collectorRoutes);

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
