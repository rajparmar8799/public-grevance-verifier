const mongoose = require('mongoose')

const deptScoreSchema = new mongoose.Schema({
  department:      { type: String, required: true },
  district:        { type: String, required: true },
  total_resolved:  { type: Number, default: 0 },
  verified_count:  { type: Number, default: 0 },
  failed_count:    { type: Number, default: 0 },
  reopened_count:  { type: Number, default: 0 },
  quality_score:   { type: Number, default: 0 },  // 0-100 percentage
  last_updated:    { type: Date, default: Date.now }
})

module.exports = mongoose.model('DepartmentScore', deptScoreSchema)
