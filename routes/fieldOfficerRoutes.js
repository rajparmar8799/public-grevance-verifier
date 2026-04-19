const express = require("express");
const router = express.Router();
const path = require("path");
const Complaint = require("../models/Complaint");
const { upload } = require("../utils/multerConfig");
const { haversineDistance } = require("../utils/geo");
const { crossVerifyGps, addGpsWatermark } = require("../utils/photoVerify");
const mlService = require("../services/mlService");
const { requireRoleAndApproved } = require("../middleware/authMiddleware");

router.use(requireRoleAndApproved(["field_officer"]));

router.get("/dashboard", async (req, res) => {
  try {
    const complaints = await Complaint.find({
      status: "RESOLVED_PENDING_VERIFICATION",
      assigned_officer: req.session.user._id,
    }).sort({ createdAt: -1 });

    const unassigned = await Complaint.find({
      status: "RESOLVED_PENDING_VERIFICATION",
      assigned_officer: null,
      district: req.session.user.district || "Ahmedabad",
    }).sort({ createdAt: -1 });

    res.render("field-officer/dashboard", {
      complaints: [...complaints, ...unassigned],
      error: req.query.error || null,
      message: req.query.message || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

router.post(
  "/evidence/:id/submit",
  upload.single("photo"),
  async (req, res) => {
    try {
      const {
        lat,
        lng,
        accuracy,
        modal_open_lat,
        modal_open_lng,
        modal_open_accuracy,
      } = req.body;
      const grievance = await Complaint.findById(req.params.id);

      if (!grievance) return res.status(404).send("Complaint not found");

      if (!req.file) {
        return res.redirect(
          "/officer/dashboard?error=Please upload a valid image (jpg, jpeg, png, webp)",
        );
      }

      const parsedLat = Number.parseFloat(lat);
      const parsedLng = Number.parseFloat(lng);
      const parsedAccuracy = Number.parseFloat(accuracy);
      const hasValidGps =
        Number.isFinite(parsedLat) && Number.isFinite(parsedLng);

      let targetLat, targetLng, gpsSource;

      if (
        Number.isFinite(grievance.complaint_lat) &&
        Number.isFinite(grievance.complaint_lng)
      ) {
        targetLat = grievance.complaint_lat;
        targetLng = grievance.complaint_lng;
        gpsSource = "COMPLAINT_GPS";
      } else {
        const districtCentres = {
          Ahmedabad: { lat: 23.0225, lng: 72.5714 },
          Surat: { lat: 21.1702, lng: 72.8311 },
          Gandhinagar: { lat: 23.2156, lng: 72.6369 },
          Vadodara: { lat: 22.3072, lng: 73.1812 },
          Rajkot: { lat: 22.3039, lng: 70.8022 },
          Bhavnagar: { lat: 21.7645, lng: 72.1519 },
          Jamnagar: { lat: 22.4707, lng: 70.0577 },
          Junagadh: { lat: 21.5222, lng: 70.4579 },
        };
        const centre =
          districtCentres[grievance.district] || districtCentres["Ahmedabad"];
        targetLat = centre.lat;
        targetLng = centre.lng;
        gpsSource = "DISTRICT_CENTRE";
      }

      let distance = null;
      let gps_match = 0;

      if (hasValidGps) {
        distance = haversineDistance(
          parsedLat,
          parsedLng,
          targetLat,
          targetLng,
        );
        const demoMode =
          (process.env.DEMO_MODE || "false").toLowerCase() === "true";
        const threshold = demoMode ? 50000 : 500; // 50km for demo, 500m for production
        gps_match = distance < threshold ? 1 : 0;
      }

      const uploadedPath = path.join(
        __dirname,
        "..",
        "public",
        "uploads",
        req.file.filename,
      );
      const exifResult = await crossVerifyGps(
        uploadedPath,
        parsedLat,
        parsedLng,
      );

      console.log(
        `[EXIF] Grievance ${req.params.id}: photo EXIF → ${exifResult.match_status}` +
          (exifResult.distance_meters != null
            ? ` (${exifResult.distance_meters}m)`
            : ""),
      );

      const watermarkedFilename = `wm_${req.file.filename}`;
      const watermarkedPath = path.join(
        __dirname,
        "..",
        "public",
        "uploads",
        watermarkedFilename,
      );

      await addGpsWatermark(uploadedPath, watermarkedPath, {
        lat: hasValidGps ? parsedLat : 0,
        lng: hasValidGps ? parsedLng : 0,
        accuracy: parsedAccuracy || null,
        distance: distance != null ? Math.round(distance) : null,
        status: gps_match ? "GPS MATCH ✓" : "GPS MISMATCH ✗",
        timestamp: new Date().toISOString(),
      });

      const updateObj = {
        "evidence.photo_url": `/uploads/${req.file.filename}`,
        "evidence.photo_watermarked_url": `/uploads/${watermarkedFilename}`,
        "evidence.photo_uploaded": 1,
        "evidence.photo_timestamp": new Date(),
        "evidence.evidence_submitted_at": new Date(),
        "evidence.officer_lat": hasValidGps ? parsedLat : null,
        "evidence.officer_lng": hasValidGps ? parsedLng : null,
        "evidence.gps_accuracy": Number.isFinite(parsedAccuracy)
          ? parsedAccuracy
          : null,
        "evidence.gps_match_flag": gps_match,
        "evidence.gps_distance_meters": Number.isFinite(distance)
          ? Math.round(distance)
          : null,
        // EXIF results
        "evidence.exif_lat": exifResult.exif_data
          ? exifResult.exif_data.lat
          : null,
        "evidence.exif_lng": exifResult.exif_data
          ? exifResult.exif_data.lng
          : null,
        "evidence.exif_camera": exifResult.exif_data
          ? exifResult.exif_data.camera
          : null,
        "evidence.exif_match_status": exifResult.match_status,
        "evidence.exif_distance_meters": exifResult.distance_meters,
      };

      const visits = [];

      const moLat = Number.parseFloat(modal_open_lat);
      const moLng = Number.parseFloat(modal_open_lng);
      if (Number.isFinite(moLat) && Number.isFinite(moLng)) {
        visits.push({
          timestamp: new Date(Date.now() - 30000), // approx 30s before submission
          lat: moLat,
          lng: moLng,
          accuracy: Number.parseFloat(modal_open_accuracy) || null,
          officer_id: req.session.user._id,
          action: "GPS_ACQUIRED",
        });
      }

      if (hasValidGps) {
        visits.push({
          timestamp: new Date(),
          lat: parsedLat,
          lng: parsedLng,
          accuracy: Number.isFinite(parsedAccuracy) ? parsedAccuracy : null,
          officer_id: req.session.user._id,
          action: "EVIDENCE_SUBMITTED",
        });
      }

      if (visits.length > 0) {
        updateObj.$push = { field_visits: { $each: visits } };
      }

      await Complaint.findByIdAndUpdate(req.params.id, updateObj);

      console.log(
        `[FIELD] Evidence for ${req.params.id} | GPS: ${gps_match ? "MATCH" : "MISMATCH"} | ` +
          `dist: ${distance ? Math.round(distance) + "m" : "N/A"} | EXIF: ${exifResult.match_status} | ` +
          `visits logged: ${visits.length}`,
      );

      const ivrDone = ["SUCCESS", "DISPUTED", "NO_RESPONSE", "FAILED"].includes(
        grievance.evidence.ivr_call_status,
      );

      if (ivrDone) {
        console.log(`[FIELD] IVR done — triggering ML for ${req.params.id}`);
        mlService.verifyGrievance(req.params.id).catch(console.error);
      } else {
        console.log(`[FIELD] IVR pending — ML deferred for ${req.params.id}`);
      }

      if (!hasValidGps) {
        return res.redirect(
          "/officer/dashboard?message=Evidence submitted. GPS unavailable — verification will proceed with IVR and photo signals.",
        );
      }

      res.redirect(
        "/officer/dashboard?message=Evidence submitted successfully. GPS watermark applied. Awaiting IVR confirmation.",
      );
    } catch (err) {
      console.error(err);
      res.redirect(
        "/officer/dashboard?error=Evidence submission failed. Try again.",
      );
    }
  },
);

module.exports = router;
