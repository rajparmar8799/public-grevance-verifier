const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');

// Department Dashboard - View all complaints (mainly 'Pending')
router.get('/', async (req, res) => {
    try {
        const complaints = await Complaint.find().sort({ createdAt: -1 });
        res.render('department/dashboard', { complaints });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Mark complaint as resolved
router.post('/:id/resolve', async (req, res) => {
    try {
        await Complaint.findByIdAndUpdate(req.params.id, { status: 'Resolved' });
        // NOTE: Here is where the verification steps (IVR trigger, etc) will start in the future.
        res.redirect('/department');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
