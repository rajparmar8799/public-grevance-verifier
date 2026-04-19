const express = require("express");
const router = express.Router();
const Complaint = require("../models/Complaint");
const DepartmentScore = require("../models/DepartmentScore");
const User = require("../models/User");
const {
  requireRoleAndApproved,
  canReviewTargetRole,
} = require("../middleware/authMiddleware");

router.use(requireRoleAndApproved(["collector"]));

// Collector Dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const scores = await DepartmentScore.find().sort({ quality_score: -1 });
    const pendingApprovals = await User.find({
      role: { $in: ["field_officer", "department_officer"] },
      status: "PENDING",
    })
      .select("-password")
      .sort({ createdAt: 1 });

    const recentVerifications = await Complaint.find({
      status: { $in: ["VERIFIED", "FAILED", "REOPENED"] },
    })
      .sort({ "verification.verified_at": -1 })
      .limit(20);

    const stats = {
      total: await Complaint.countDocuments(),
      verified: await Complaint.countDocuments({ status: "VERIFIED" }),
      reopened: await Complaint.countDocuments({ status: "REOPENED" }),
      failed: await Complaint.countDocuments({ status: "FAILED" }),
      avgScore:
        scores.length > 0
          ? (
              scores.reduce((acc, s) => acc + s.quality_score, 0) /
              scores.length
            ).toFixed(1)
          : 0,
    };

    res.render("collector/dashboard", {
      scores,
      recentVerifications,
      stats,
      pendingApprovals,
      message: req.query.message || null,
      error: req.query.error || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

router.post("/approvals/:id/decision", async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.redirect("/collector/dashboard?error=User not found");
    }

    if (!canReviewTargetRole(req.session.user.role, targetUser.role)) {
      return res.redirect(
        "/collector/dashboard?error=Not allowed to review this role",
      );
    }

    if (targetUser.status !== "PENDING") {
      return res.redirect(
        `/collector/dashboard?error=User already ${targetUser.status}`,
      );
    }

    const action = (req.body.action || "").toUpperCase();
    if (!["APPROVE", "REJECT"].includes(action)) {
      return res.redirect("/collector/dashboard?error=Invalid action");
    }

    targetUser.status = action === "APPROVE" ? "APPROVED" : "REJECTED";
    await targetUser.save();

    return res.redirect(
      `/collector/dashboard?message=User ${targetUser.status.toLowerCase()}`,
    );
  } catch (err) {
    console.error(err);
    return res.redirect("/collector/dashboard?error=Failed to update approval");
  }
});

// Evidence Audit Page — with populated refs and full evidence packet
router.get("/evidence/:id", async (req, res) => {
  try {
    const grievance = await Complaint.findById(req.params.id)
      .populate("resolved_by", "name email role")
      .populate("assigned_officer", "name email role")
      .populate("field_visits.officer_id", "name email");

    if (!grievance) {
      return res.redirect("/collector/dashboard?error=Grievance not found");
    }

    res.render("collector/evidence", { grievance });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

router.get("/evidence/:id/download", async (req, res) => {
  try {
    const grievance = await Complaint.findById(req.params.id)
      .populate("resolved_by", "name email role")
      .populate("assigned_officer", "name email role");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=audit_${req.params.id}.json`,
    );
    res.json({
      grievance_id: grievance._id,
      generated_at: new Date(),
      subject: grievance.subject,
      department: grievance.department,
      district: grievance.district,
      status: grievance.status,
      complaint_location: {
        lat: grievance.complaint_lat,
        lng: grievance.complaint_lng,
      },
      evidence: grievance.evidence,
      field_visits: grievance.field_visits,
      verification: grievance.verification,
      resolved_by: grievance.resolved_by,
      assigned_officer: grievance.assigned_officer,
      reopened_by: grievance.reopened_by,
      reopen_count: grievance.reopen_count,
      timeline: {
        submitted: grievance.createdAt,
        resolved: grievance.resolved_at,
        ivr_called: grievance.evidence.ivr_called_at,
        evidence_submitted: grievance.evidence.evidence_submitted_at,
        verified: grievance.verification.verified_at,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
