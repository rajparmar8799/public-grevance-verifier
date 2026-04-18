const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, enum: ['citizen', 'department', 'field_officer', 'collector'], required: true },
  district: { type: String, default: 'Ahmedabad' },
  department: { type: String, default: 'Water Supply' }
});

module.exports = mongoose.model('User', userSchema);
