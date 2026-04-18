const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const DepartmentScore = require('../models/DepartmentScore');

// Collector Dashboard
router.get('/collector/dashboard', async (req, res) => {
    try {
        const scores = await DepartmentScore.find();
        const recentVerifications = await Complaint.find({
            status: { $in: ['VERIFIED', 'FAILED', 'REOPENED'] }
        }).sort({ 'verification.verified_at': -1 }).limit(20);

        const stats = {
            total: await Complaint.countDocuments(),
            verified: await Complaint.countDocuments({ status: 'VERIFIED' }),
            reopened: await Complaint.countDocuments({ status: 'REOPENED' }),
            avgScore: scores.length > 0 ? (scores.reduce((acc, s) => acc + s.quality_score, 0) / scores.length).toFixed(1) : 0
        };

        res.render('collector/dashboard', { scores, recentVerifications, stats });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
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
