const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  subject:     { type: String, required: true },
  description: { type: String, required: true },
  phoneNumber:  { type: String, required: true },

  // ── Status — standardised to ALL_CAPS ──────────────────────────────────
  status: {
    type: String,
    enum: [
      'PENDING',                       // freshly submitted by citizen
      'IN_PROGRESS',                   // department working on it
      'RESOLVED_PENDING_VERIFICATION', // dept marked resolved; awaiting evidence + IVR
      'VERIFIED',                      // ML confirmed genuine resolution
      'FAILED',                        // verification failed (evidence / IVR issues)
      'REOPENED'                       // citizen disputed or auto-reopened
    ],
    default: 'PENDING'
  },

  department: { type: String, default: 'Water Supply' },
  district:   { type: String, default: 'Ahmedabad' },

  // ── Field-officer evidence packet ───────────────────────────────────────
  evidence: {
    photo_url:              { type: String,  default: null },
    photo_uploaded:         { type: Number,  default: 0 },
    photo_timestamp:        { type: Date,    default: null },
    evidence_submitted_at:  { type: Date,    default: null },

    officer_lat:            { type: Number,  default: null },
    officer_lng:            { type: Number,  default: null },
    gps_match_flag:         { type: Number,  default: 0 },
    gps_distance_meters:    { type: Number,  default: null },

    // IVR fields
    ivr_call_sid:           { type: String,  default: null },   // Twilio call SID for audit
    ivr_call_status:        { type: String,  default: 'NOT_CALLED' },
    ivr_response:           { type: Number,  default: 0 },      // 0=none, 1=confirmed, 2=disputed
    ivr_called_at:          { type: Date,    default: null }
  },

  // ── ML verification result ───────────────────────────────────────────────
  verification: {
    status:      { type: String, default: null },
    reopen_flag: { type: Number, default: 0 },
    confidence:  { type: Number, default: null },
    risk_score:  { type: Number, default: null },
    reason:      { type: String, default: null },
    flags:       [String],
    verified_at: { type: Date,   default: null }
  },

  reopen_count:     { type: Number,                        default: 0 },
  assigned_officer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolved_by:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolved_at:      { type: Date,                           default: null }

}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);
