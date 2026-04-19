const express = require("express");
const router = express.Router();
const DepartmentScore = require("../models/DepartmentScore");
const Complaint = require("../models/Complaint");

router.get("/scores", async (req, res) => {
  try {
    const scores = await DepartmentScore.find().sort({ quality_score: -1 });

    // Aggregate overall stats
    const totalComplaints = await Complaint.countDocuments();
    const totalVerified = await Complaint.countDocuments({
      status: "VERIFIED",
    });
    const totalFailed = await Complaint.countDocuments({
      status: { $in: ["FAILED", "REOPENED"] },
    });
    const totalPending = await Complaint.countDocuments({
      status: {
        $in: ["PENDING", "IN_PROGRESS", "RESOLVED_PENDING_VERIFICATION"],
      },
    });

    res.render("public/scores", {
      scores,
      stats: {
        totalComplaints,
        totalVerified,
        totalFailed,
        totalPending,
        overallRate:
          totalComplaints > 0
            ? Math.round(
                (totalVerified / (totalVerified + totalFailed || 1)) * 100,
              )
            : 0,
      },
    });
  } catch (err) {
    console.error("[PUBLIC] Error loading scores:", err.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
