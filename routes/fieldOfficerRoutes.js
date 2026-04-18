const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const { upload } = require('../utils/multerConfig');
const { haversineDistance } = require('../utils/geo');
const mlService = require('../services/mlService');

// Officer Dashboard
router.get('/officer/dashboard', async (req, res) => {
    try {
        // In a real app we'd filter by req.session.user._id
        // For demo we show all matching status
        const complaints = await Complaint.find({
            status: 'RESOLVED_PENDING_VERIFICATION'
        }).sort({ createdAt: -1 });
        res.render('field-officer/dashboard', { complaints });
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

        // Logic check for GPS distance (Mocking grievance location if missing)
        // In production, the complaint data would have real Lat/Lng
        const targetLat = 23.0225; // Default Ahmedabad
        const targetLng = 72.5714;
        
        const distance = haversineDistance(parseFloat(lat), parseFloat(lng), targetLat, targetLng);
        const gps_match = distance < 500 ? 1 : 0;

        await Complaint.findByIdAndUpdate(req.params.id, {
            'evidence.photo_url': `/uploads/${req.file.filename}`,
            'evidence.photo_uploaded': 1,
            'evidence.photo_timestamp': new Date(),
            'evidence.officer_lat': parseFloat(lat),
            'evidence.officer_lng': parseFloat(lng),
            'evidence.gps_match_flag': gps_match,
            'evidence.gps_distance_meters': Math.round(distance)
        });

        // Trigger ML verification
        mlService.verifyGrievance(req.params.id);

        res.redirect('/officer/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
