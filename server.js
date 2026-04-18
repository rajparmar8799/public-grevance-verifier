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

app.use('/', indexRoutes);
app.use('/citizen', citizenRoutes);
app.use('/department', departmentRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
