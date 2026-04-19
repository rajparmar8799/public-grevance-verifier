const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    description: { type: String, required: true },
    phoneNumber: { type: String, required: true },

    // ── Status — standardised to ALL_CAPS ──────────────────────────────────
    status: {
      type: String,
      enum: [
        "PENDING",
        "IN_PROGRESS",
        "RESOLVED_PENDING_VERIFICATION",
        "VERIFIED",
        "FAILED",
        "REOPENED",
      ],
      default: "PENDING",
    },

    department: { type: String, default: "Water Supply" },
    district: { type: String, default: "Ahmedabad" },

    complaint_lat: { type: Number, default: null },
    complaint_lng: { type: Number, default: null },

    evidence: {
      photo_url: { type: String, default: null },
      photo_watermarked_url: { type: String, default: null },
      photo_uploaded: { type: Number, default: 0 },
      photo_timestamp: { type: Date, default: null },
      evidence_submitted_at: { type: Date, default: null },

      officer_lat: { type: Number, default: null },
      officer_lng: { type: Number, default: null },
      gps_accuracy: { type: Number, default: null },
      gps_match_flag: { type: Number, default: 0 },
      gps_distance_meters: { type: Number, default: null },

      // EXIF cross-verification
      exif_lat: { type: Number, default: null },
      exif_lng: { type: Number, default: null },
      exif_camera: { type: String, default: null },
      exif_match_status: { type: String, default: null },
      exif_distance_meters: { type: Number, default: null },

      // IVR fields
      ivr_call_sid: { type: String, default: null },
      ivr_call_status: { type: String, default: "NOT_CALLED" },
      ivr_response: { type: Number, default: 0 },
      ivr_called_at: { type: Date, default: null },
    },

    field_visits: [
      {
        timestamp: { type: Date, default: Date.now },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        accuracy: { type: Number, default: null },
        officer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        action: {
          type: String,
          enum: ["GPS_ACQUIRED", "EVIDENCE_SUBMITTED", "PHOTO_CAPTURED"],
        },
      },
    ],

    verification: {
      status: { type: String, default: null },
      reopen_flag: { type: Number, default: 0 },
      confidence: { type: Number, default: null },
      risk_score: { type: Number, default: null },
      reason: { type: String, default: null },
      flags: [String],
      verified_at: { type: Date, default: null },
    },

    reopened_by: {
      type: String,
      enum: ["CITIZEN_IVR", "ML_VERIFICATION", "COLLECTOR", null],
      default: null,
    },

    reopen_count: { type: Number, default: 0 },
    assigned_officer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolved_at: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Complaint", complaintSchema);
