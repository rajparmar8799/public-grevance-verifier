require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Mock Session to support prompted code
app.use((req, res, next) => {
    if(!req.session) req.session = {};
    req.session.user = { _id: new mongoose.Types.ObjectId() };
    next();
});

// View Engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
const indexRoutes = require('./routes/indexRoutes');
const citizenRoutes = require('./routes/citizenRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const fieldOfficerRoutes = require('./routes/fieldOfficerRoutes');
const collectorRoutes = require('./routes/collectorRoutes');

app.use('/', indexRoutes);
app.use('/citizen', citizenRoutes);
app.use('/department', departmentRoutes);
app.use('/', fieldOfficerRoutes);
app.use('/', collectorRoutes);

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
