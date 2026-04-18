const express    = require('express');
const router     = express.Router();
const Complaint  = require('../models/Complaint');
const User       = require('../models/User');
const ivrService = require('../services/ivrService');
const { requireRoleAndApproved, canReviewTargetRole } = require('../middleware/authMiddleware');

router.use(requireRoleAndApproved(['department_officer']));

// ─── Department Dashboard ────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const complaints = await Complaint.find().sort({ createdAt: -1 });

        // Only show PENDING field officers in the same district
        const pendingFieldOfficers = await User.find({
          role:     'field_officer',
          status:   'PENDING',
          district: req.session.user.district || 'Ahmedabad'
        }).select('-password').sort({ createdAt: 1 });

        res.render('department/dashboard', {
          complaints,
          pendingFieldOfficers,
          message: req.query.message || null,
          error:   req.query.error   || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// ─── Approve / Reject pending field officers ─────────────────────────────────
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

// ─── Mark complaint as resolved (triggers 3-step verification) ───────────────
router.post('/:id/resolve', async (req, res) => {
    try {
        // Step 1 — Update status and set resolved_by
        const grievance = await Complaint.findByIdAndUpdate(
          req.params.id,
          {
            status:      'RESOLVED_PENDING_VERIFICATION',
            resolved_by: req.session.user._id,
            resolved_at: new Date(),
            // Mark IVR as pending so the dashboard reflects live state
            'evidence.ivr_call_status': 'PENDING'
          },
          { new: true }
        );

        if (!grievance) {
          return res.redirect('/department?error=Grievance not found');
        }

        // Step 2 — Assign to an APPROVED field officer in the same district
        const officer = await User.findOne({
          role:     'field_officer',
          status:   'APPROVED',                      // Bug #6 fix — only APPROVED
          district: grievance.district || 'Ahmedabad'
        });

        if (officer) {
          await Complaint.findByIdAndUpdate(grievance._id, {
            assigned_officer: officer._id
          });
          console.log(`[DEPT] Assigned grievance ${grievance._id} to officer ${officer.name}`);
        } else {
          console.warn(`[DEPT] No approved field officer found in district ${grievance.district}`);
        }

        // Step 3 — Trigger IVR call NOW (per problem statement: fires when dept marks resolved)
        // IVR timing: dept resolves → citizen gets call immediately → field officer uploads evidence
        // ML runs once BOTH IVR response AND field evidence are in.
        const ivrResult = await ivrService.triggerCall(grievance.phoneNumber, String(grievance._id));

        let redirectMsg;
        if (ivrResult.success) {
          redirectMsg = `Grievance marked resolved. IVR call initiated to ${grievance.phoneNumber}. Awaiting citizen response.`;
        } else if (ivrResult.reason && ivrResult.reason.includes('unverified')) {
          // Twilio Trial account can only call verified numbers
          redirectMsg = `Grievance resolved. WARNING: Could not call ${grievance.phoneNumber} — Twilio trial accounts can only call verified numbers. Add this number at console.twilio.com/phone-numbers/verified`;
          // Mark IVR as failed so ML can still run via field evidence
          await Complaint.findByIdAndUpdate(grievance._id, {
            'evidence.ivr_call_status': 'FAILED'
          });
        } else if (ivrResult.reason === 'TWILIO_NOT_CONFIGURED') {
          redirectMsg = 'Grievance resolved. IVR not configured — add Twilio credentials to .env';
        } else {
          redirectMsg = `Grievance resolved. IVR skipped: ${ivrResult.reason || 'unknown error'}`;
        }

        res.redirect(`/department?message=${encodeURIComponent(redirectMsg)}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
