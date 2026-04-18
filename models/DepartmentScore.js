const mongoose = require('mongoose');

const departmentScoreSchema = new mongoose.Schema({
  department: { type: String, required: true },
  district: { type: String, required: true },
  total_resolved: { type: Number, default: 0 },
  verified_count: { type: Number, default: 0 },
  failed_count: { type: Number, default: 0 },
  reopened_count: { type: Number, default: 0 },
  quality_score: { type: Number, default: 0 },
  last_updated: { type: Date, default: Date.now }
}, { timestamps: true });

departmentScoreSchema.index({ department: 1, district: 1 }, { unique: true });

module.exports = mongoose.model('DepartmentScore', departmentScoreSchema);
