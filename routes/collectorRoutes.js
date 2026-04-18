const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const DepartmentScore = require('../models/DepartmentScore');
const User = require('../models/User');
const { requireRoleAndApproved, canReviewTargetRole } = require('../middleware/authMiddleware');

router.use(requireRoleAndApproved(['collector']));

router.use((req, res, next) => {
    const sessionRole = req.session && req.session.user && req.session.user.role;
    const sessionEmail = req.session && req.session.user && req.session.user.email;
    console.log('[COLLECTOR ROUTE] role:', sessionRole, 'email:', sessionEmail, 'path:', req.path);
    next();
});

// Collector Dashboard
router.get('/collector/dashboard', async (req, res) => {
    try {
        const scores = await DepartmentScore.find();
        const pendingApprovals = await User.find({
            role: { $in: ['field_officer', 'department_officer'] },
            status: 'PENDING'
        }).select('-password').sort({ createdAt: 1 });

        const recentVerifications = await Complaint.find({
            status: { $in: ['VERIFIED', 'FAILED', 'REOPENED'] }
        }).sort({ 'verification.verified_at': -1 }).limit(20);

        const stats = {
            total: await Complaint.countDocuments(),
            verified: await Complaint.countDocuments({ status: 'VERIFIED' }),
            reopened: await Complaint.countDocuments({ status: 'REOPENED' }),
            avgScore: scores.length > 0 ? (scores.reduce((acc, s) => acc + s.quality_score, 0) / scores.length).toFixed(1) : 0
        };

        res.render('collector/dashboard', {
            scores,
            recentVerifications,
            stats,
            pendingApprovals,
            message: req.query.message || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/collector/approvals/:id/decision', async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id);
        if (!targetUser) {
            return res.redirect('/collector/dashboard?error=User not found');
        }

        if (!canReviewTargetRole(req.session.user.role, targetUser.role)) {
            return res.redirect('/collector/dashboard?error=Not allowed to review this role');
        }

        if (targetUser.status !== 'PENDING') {
            return res.redirect(`/collector/dashboard?error=User already ${targetUser.status}`);
        }

        const action = (req.body.action || '').toUpperCase();
        if (!['APPROVE', 'REJECT'].includes(action)) {
            return res.redirect('/collector/dashboard?error=Invalid action');
        }

        targetUser.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        await targetUser.save();

        return res.redirect(`/collector/dashboard?message=User ${targetUser.status.toLowerCase()}`);
    } catch (err) {
        console.error(err);
        return res.redirect('/collector/dashboard?error=Failed to update approval');
    }
});

// Evidence Audit Page
router.get('/collector/evidence/:id', async (req, res) => {
    try {
        const grievance = await Complaint.findById(req.params.id);
        res.render('collector/evidence', { grievance });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Download Audit JSON
router.get('/collector/evidence/:id/download', async (req, res) => {
    try {
        const grievance = await Complaint.findById(req.params.id);
        res.setHeader('Content-Disposition', `attachment; filename=audit_${req.params.id}.json`);
        res.json({
          grievance_id: grievance._id,
          generated_at: new Date(),
          evidence: grievance.evidence,
          verification: grievance.verification,
          timeline: {
            submitted: grievance.createdAt,
            resolved: grievance.resolved_at,
            ivr_called: grievance.evidence.ivr_called_at,
            verified: grievance.verification.verified_at
          }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
