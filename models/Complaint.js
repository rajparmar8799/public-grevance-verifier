const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  description: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Resolved', 'Reopened', 'Verification Failed', 'IN_PROGRESS', 'RESOLVED_PENDING_VERIFICATION', 'VERIFIED', 'FAILED', 'REOPENED'],
    default: 'Pending'
  },
  department: { type: String, default: 'Water Supply' },
  district: { type: String, default: 'Ahmedabad' },
  evidence: {
    photo_url: { type: String, default: null },
    photo_uploaded: { type: Number, default: 0 },
    photo_timestamp: { type: Date, default: null },
    officer_lat: { type: Number, default: null },
    officer_lng: { type: Number, default: null },
    gps_match_flag: { type: Number, default: 0 },
    gps_distance_meters: { type: Number, default: null },
    ivr_call_status: { type: String, default: 'NOT_CALLED' },
    ivr_response: { type: Number, default: 0 },
    ivr_called_at: { type: Date, default: null }
  },
  verification: {
    status: { type: String, default: null },
    reopen_flag: { type: Number, default: 0 },
    confidence: { type: Number, default: null },
    risk_score: { type: Number, default: null },
    reason: { type: String, default: null },
    flags: [String],
    verified_at: { type: Date, default: null }
  },
  reopen_count: { type: Number, default: 0 },
  assigned_officer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolved_at: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);
