const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const { upload } = require('../utils/multerConfig');
const { haversineDistance } = require('../utils/geo');
const mlService = require('../services/mlService');
const { requireRoleAndApproved } = require('../middleware/authMiddleware');

router.use(requireRoleAndApproved(['field_officer']));

// Officer Dashboard
router.get('/officer/dashboard', async (req, res) => {
    try {
        // In a real app we'd filter by req.session.user._id
        // For demo we show all matching status
        const complaints = await Complaint.find({
            status: 'RESOLVED_PENDING_VERIFICATION'
        }).sort({ createdAt: -1 });
        res.render('field-officer/dashboard', {
            complaints,
            error: req.query.error || null,
            message: req.query.message || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Submit Evidence
router.post('/officer/evidence/:id/submit', upload.single('photo'), async (req, res) => {
    try {
        const { lat, lng } = req.body;
        const grievance = await Complaint.findById(req.params.id);

        if (!grievance) return res.status(404).send('Complaint not found');
        if (!req.file) {
            return res.redirect('/officer/dashboard?error=Please upload a valid image (jpg, jpeg, png, webp)');
        }

        const parsedLat = Number.parseFloat(lat);
        const parsedLng = Number.parseFloat(lng);
        const hasValidGps = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);

        // Logic check for GPS distance (Mocking grievance location if missing)
        // In production, the complaint data would have real Lat/Lng
        const targetLat = 23.0225; // Default Ahmedabad
        const targetLng = 72.5714;

        let distance = null;
        let gps_match = 0;

        if (hasValidGps) {
            distance = haversineDistance(parsedLat, parsedLng, targetLat, targetLng);
            gps_match = distance < 500 ? 1 : 0;
        }

        await Complaint.findByIdAndUpdate(req.params.id, {
            'evidence.photo_url': `/uploads/${req.file.filename}`,
            'evidence.photo_uploaded': 1,
            'evidence.photo_timestamp': new Date(),
            'evidence.officer_lat': hasValidGps ? parsedLat : null,
            'evidence.officer_lng': hasValidGps ? parsedLng : null,
            'evidence.gps_match_flag': gps_match,
            'evidence.gps_distance_meters': Number.isFinite(distance) ? Math.round(distance) : null
        });

        // Trigger ML verification
        await mlService.verifyGrievance(req.params.id);

        if (!hasValidGps) {
            return res.redirect('/officer/dashboard?message=Evidence submitted, but GPS was unavailable');
        }

        res.redirect('/officer/dashboard?message=Evidence submitted successfully');
    } catch (err) {
        console.error(err);
        res.redirect('/officer/dashboard?error=Evidence submission failed. Try again');
    }
});

module.exports = router;
