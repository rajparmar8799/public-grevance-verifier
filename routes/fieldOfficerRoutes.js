const express   = require('express');
const router    = express.Router();
const Complaint = require('../models/Complaint');
const { upload }           = require('../utils/multerConfig');
const { haversineDistance } = require('../utils/geo');
const mlService             = require('../services/mlService');
const { requireRoleAndApproved } = require('../middleware/authMiddleware');

router.use(requireRoleAndApproved(['field_officer']));

// ─── Field Officer Dashboard ─────────────────────────────────────────────────
router.get('/officer/dashboard', async (req, res) => {
    try {
        // Show complaints needing evidence upload — assigned to this officer
        const complaints = await Complaint.find({
            status:           'RESOLVED_PENDING_VERIFICATION',
            assigned_officer: req.session.user._id
        }).sort({ createdAt: -1 });

        // Also show any unassigned ones in same district (backup)
        const unassigned = await Complaint.find({
            status:           'RESOLVED_PENDING_VERIFICATION',
            assigned_officer: null,
            district:         req.session.user.district || 'Ahmedabad'
        }).sort({ createdAt: -1 });

        res.render('field-officer/dashboard', {
            complaints: [...complaints, ...unassigned],
            error:   req.query.error   || null,
            message: req.query.message || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// ─── Submit Evidence ─────────────────────────────────────────────────────────
// Note: ML verification is NOT triggered here — it fires from the IVR webhook
// once the citizen has confirmed/disputed. This follows the 3-step flow:
//   Step 1 (Dept) → Step 2 (IVR citizen call) → Step 3 (Field evidence + ML)
//
// However, if the IVR already completed before the officer uploads evidence,
// we detect that and trigger ML immediately.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/officer/evidence/:id/submit', upload.single('photo'), async (req, res) => {
    try {
        const { lat, lng } = req.body;
        const grievance    = await Complaint.findById(req.params.id);

        if (!grievance) return res.status(404).send('Complaint not found');

        if (!req.file) {
            return res.redirect('/officer/dashboard?error=Please upload a valid image (jpg, jpeg, png, webp)');
        }

        const parsedLat  = Number.parseFloat(lat);
        const parsedLng  = Number.parseFloat(lng);
        const hasValidGps = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);

        // GPS distance check against complaint's district centre
        // In production the Complaint model would store the actual grievance lat/lng
        const districtCentres = {
            'Ahmedabad':  { lat: 23.0225, lng: 72.5714 },
            'Surat':      { lat: 21.1702, lng: 72.8311 },
            'Gandhinagar':{ lat: 23.2156, lng: 72.6369 },
            'Vadodara':   { lat: 22.3072, lng: 73.1812 },
            'Rajkot':     { lat: 22.3039, lng: 70.8022 }
        };
        const centre   = districtCentres[grievance.district] || districtCentres['Ahmedabad'];
        const targetLat = centre.lat;
        const targetLng = centre.lng;

        let distance  = null;
        let gps_match = 0;

        if (hasValidGps) {
            distance  = haversineDistance(parsedLat, parsedLng, targetLat, targetLng);
            gps_match = distance < 500 ? 1 : 0;
        }

        // Update evidence fields
        await Complaint.findByIdAndUpdate(req.params.id, {
            'evidence.photo_url':             `/uploads/${req.file.filename}`,
            'evidence.photo_uploaded':        1,
            'evidence.photo_timestamp':       new Date(),
            'evidence.evidence_submitted_at': new Date(),
            'evidence.officer_lat':           hasValidGps ? parsedLat : null,
            'evidence.officer_lng':           hasValidGps ? parsedLng : null,
            'evidence.gps_match_flag':        gps_match,
            'evidence.gps_distance_meters':   Number.isFinite(distance) ? Math.round(distance) : null
        });

        console.log(`[FIELD] Evidence submitted for grievance ${req.params.id} | GPS match: ${gps_match}`);

        // ── Smart ML trigger ──────────────────────────────────────────────────
        // If IVR already completed before evidence upload, trigger ML now.
        // Otherwise, IVR webhook (/api/ivr/response or /api/ivr/status) will trigger it.
        const ivrDone = ['SUCCESS', 'DISPUTED', 'NO_RESPONSE', 'FAILED'].includes(
            grievance.evidence.ivr_call_status
        );

        if (ivrDone) {
            console.log(`[FIELD] IVR already completed — triggering ML immediately for ${req.params.id}`);
            // Run async, don't block the redirect
            mlService.verifyGrievance(req.params.id).catch(console.error);
        } else {
            console.log(`[FIELD] IVR pending — ML will trigger from IVR webhook for ${req.params.id}`);
        }

        if (!hasValidGps) {
            return res.redirect('/officer/dashboard?message=Evidence submitted. GPS unavailable — verification will proceed with IVR and photo signals.');
        }

        res.redirect('/officer/dashboard?message=Evidence submitted successfully. Awaiting IVR confirmation for final verification.');
    } catch (err) {
        console.error(err);
        res.redirect('/officer/dashboard?error=Evidence submission failed. Try again.');
    }
});

module.exports = router;
