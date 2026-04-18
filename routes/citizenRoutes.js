const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const { requireRoleAndApproved } = require('../middleware/authMiddleware');

router.use(requireRoleAndApproved(['citizen']));

// Citizen Dashboard - View old complaints and statuses
router.get('/', async (req, res) => {
    try {
        const complaints = await Complaint.find().sort({ createdAt: -1 });
        res.render('citizen/dashboard', { complaints });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Render new complaint form
router.get('/new', (req, res) => {
    res.render('citizen/new');
});

// Handle new complaint submission
router.post('/new', async (req, res) => {
    try {
        const { subject, description, phoneNumber } = req.body;
        const newComplaint = new Complaint({
            subject,
            description,
            phoneNumber
        });
        await newComplaint.save();
        res.redirect('/citizen');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
