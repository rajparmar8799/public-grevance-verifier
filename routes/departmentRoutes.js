const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const ivrService = require('../services/ivrService'); // Placeholder
const { requireRoleAndApproved, canReviewTargetRole } = require('../middleware/authMiddleware');

router.use(requireRoleAndApproved(['department_officer']));

// Department Dashboard - View all complaints (mainly 'Pending')
router.get('/', async (req, res) => {
    try {
        const complaints = await Complaint.find().sort({ createdAt: -1 });
        const pendingFieldOfficers = await User.find({
          role: 'field_officer',
          status: 'PENDING',
          district: req.session.user.district || 'Ahmedabad'
        }).select('-password').sort({ createdAt: 1 });

        res.render('department/dashboard', {
          complaints,
          pendingFieldOfficers,
          message: req.query.message || null,
          error: req.query.error || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Department Officer can approve/reject pending field officers
router.post('/approvals/:id/decision', async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id);
        if (!targetUser) {
          return res.redirect('/department?error=User not found');
        }

        if (!canReviewTargetRole(req.session.user.role, targetUser.role)) {
          return res.redirect('/department?error=Not allowed to review this role');
        }

        if (targetUser.status !== 'PENDING') {
          return res.redirect(`/department?error=User already ${targetUser.status}`);
        }

        const action = (req.body.action || '').toUpperCase();
        if (!['APPROVE', 'REJECT'].includes(action)) {
          return res.redirect('/department?error=Invalid action');
        }

        targetUser.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        await targetUser.save();

        return res.redirect(`/department?message=Field officer ${targetUser.status.toLowerCase()}`);
    } catch (err) {
        console.error(err);
        return res.redirect('/department?error=Failed to update approval');
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
