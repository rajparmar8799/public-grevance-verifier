const express = require("express");
const router = express.Router();
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const ivrService = require("../services/ivrService");
const {
  requireRoleAndApproved,
  canReviewTargetRole,
} = require("../middleware/authMiddleware");

router.use(requireRoleAndApproved(["department_officer"]));

router.get("/", async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ createdAt: -1 });

    // Only show PENDING field officers in the same district
    const pendingFieldOfficers = await User.find({
      role: "field_officer",
      status: "PENDING",
      district: req.session.user.district || "Ahmedabad",
    })
      .select("-password")
      .sort({ createdAt: 1 });

    res.render("department/dashboard", {
      complaints,
      pendingFieldOfficers,
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
      return res.redirect("/department?error=User not found");
    }

    if (!canReviewTargetRole(req.session.user.role, targetUser.role)) {
      return res.redirect("/department?error=Not allowed to review this role");
    }

    if (targetUser.status !== "PENDING") {
      return res.redirect(
        `/department?error=User already ${targetUser.status}`,
      );
    }

    const action = (req.body.action || "").toUpperCase();
    if (!["APPROVE", "REJECT"].includes(action)) {
      return res.redirect("/department?error=Invalid action");
    }

    targetUser.status = action === "APPROVE" ? "APPROVED" : "REJECTED";
    await targetUser.save();

    return res.redirect(
      `/department?message=Field officer ${targetUser.status.toLowerCase()}`,
    );
  } catch (err) {
    console.error(err);
    return res.redirect("/department?error=Failed to update approval");
  }
});

router.post("/:id/resolve", async (req, res) => {
  try {
    const grievance = await Complaint.findById(req.params.id);

    if (!grievance) {
      return res.redirect("/department?error=Grievance not found");
    }

    if (
      grievance.reopened_by &&
      ["CITIZEN_IVR", "ML_VERIFICATION"].includes(grievance.reopened_by) &&
      grievance.resolved_by &&
      String(grievance.resolved_by) === String(req.session.user._id)
    ) {
      console.warn(
        `[DEPT] BLOCKED: Officer ${req.session.user.email} tried to re-resolve ` +
          `grievance ${req.params.id} (reopened by ${grievance.reopened_by})`,
      );
      return res.redirect(
        "/department?error=" +
          encodeURIComponent(
            "This grievance was auto-reopened by " +
              (grievance.reopened_by === "CITIZEN_IVR"
                ? "citizen IVR dispute"
                : "ML verification failure") +
              ". A different officer or the Collector must handle it — self-certification is not allowed.",
          ),
      );
    }

    // Step 1 — Update status and set resolved_by
    await Complaint.findByIdAndUpdate(req.params.id, {
      status: "RESOLVED_PENDING_VERIFICATION",
      resolved_by: req.session.user._id,
      resolved_at: new Date(),
      reopened_by: null,
      "evidence.ivr_call_status": "PENDING",
    });

    // Step 2 — Assign to an APPROVED field officer in the same district
    const officer = await User.findOne({
      role: "field_officer",
      status: "APPROVED",
      district: grievance.district || "Ahmedabad",
    });

    if (officer) {
      await Complaint.findByIdAndUpdate(req.params.id, {
        assigned_officer: officer._id,
      });
      console.log(
        `[DEPT] Assigned grievance ${req.params.id} to officer ${officer.name}`,
      );
    } else {
      console.warn(
        `[DEPT] No approved field officer found in district ${grievance.district}`,
      );
    }

    // Step 3 — Trigger IVR call NOW (per problem statement)
    const ivrResult = await ivrService.triggerCall(
      grievance.phoneNumber,
      String(grievance._id),
    );

    let redirectMsg;
    if (ivrResult.success) {
      redirectMsg = `Grievance marked resolved. IVR call initiated to ${grievance.phoneNumber}. Awaiting citizen response.`;
    } else if (ivrResult.reason && ivrResult.reason.includes("unverified")) {
      redirectMsg = `Grievance resolved. WARNING: Could not call ${grievance.phoneNumber} — Twilio trial accounts can only call verified numbers.`;
      await Complaint.findByIdAndUpdate(grievance._id, {
        "evidence.ivr_call_status": "FAILED",
      });
    } else if (ivrResult.reason === "TWILIO_NOT_CONFIGURED") {
      redirectMsg =
        "Grievance resolved. IVR not configured — add Twilio credentials to .env";
    } else {
      redirectMsg = `Grievance resolved. IVR skipped: ${ivrResult.reason || "unknown error"}`;
    }

    res.redirect(`/department?message=${encodeURIComponent(redirectMsg)}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
