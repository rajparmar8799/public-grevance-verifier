const express   = require('express');
const router    = express.Router();
const Complaint = require('../models/Complaint');
const { requireRoleAndApproved } = require('../middleware/authMiddleware');

router.use(requireRoleAndApproved(['citizen']));

// ─── Citizen Dashboard ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const complaints = await Complaint.find().sort({ createdAt: -1 });
        res.render('citizen/dashboard', { complaints });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// ─── New complaint form ──────────────────────────────────────────────────────
router.get('/new', (req, res) => {
    res.render('citizen/new');
});

// ─── Submit new complaint ────────────────────────────────────────────────────
router.post('/new', async (req, res) => {
    try {
        const { subject, description, phoneNumber, district, department } = req.body;

        if (!subject || !description || !phoneNumber) {
          return res.redirect('/citizen/new?error=Subject, description, and phone are required');
        }

        const newComplaint = new Complaint({
            subject:     subject.trim(),
            description: description.trim(),
            phoneNumber: (phoneNumber || '').replace(/\D/g, ''),   // strip non-digits
            district:    district    || 'Ahmedabad',
            department:  department  || 'Water Supply',
            status:      'PENDING'
        });

        await newComplaint.save();
        res.redirect('/citizen');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
