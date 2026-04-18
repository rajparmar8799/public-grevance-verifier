const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const ivrService = require('../services/ivrService'); // Placeholder

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
        // After marking resolved — assign to field officer and trigger IVR placeholder
        const grievance = await Complaint.findByIdAndUpdate(
          req.params.id,
          {
            status: 'RESOLVED_PENDING_VERIFICATION',
            resolved_by: req.session.user._id,
            resolved_at: new Date()
          },
          { new: true }
        )

        // Assign to a field officer (assign first available officer in same district)
        const officer = await User.findOne({
          role: 'field_officer',
          district: grievance.district || 'Ahmedabad'
        })
        if (officer) {
          await Complaint.findByIdAndUpdate(grievance._id, {
            assigned_officer: officer._id
          })
        }

        // IVR PLACEHOLDER — trigger demo response
        ivrService.triggerCall(grievance.phoneNumber, grievance._id)
        
        // For demo: auto-simulate IVR response after 10 seconds
        setTimeout(async () => {
          await Complaint.findByIdAndUpdate(grievance._id, {
            'evidence.ivr_call_status': 'SUCCESS',
            'evidence.ivr_response': 1,        // 1 = confirmed
            'evidence.ivr_called_at': new Date()
          })
          console.log(`[IVR DEMO] Simulated IVR response for ${grievance._id}`)
        }, 10000)

        res.redirect('/department');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
