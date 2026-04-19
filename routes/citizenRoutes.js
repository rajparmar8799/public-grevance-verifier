const express = require("express");
const router = express.Router();
const Complaint = require("../models/Complaint");
const { requireRoleAndApproved } = require("../middleware/authMiddleware");

router.use(requireRoleAndApproved(["citizen"]));

router.get("/", async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ createdAt: -1 });
    res.render("citizen/dashboard", { complaints });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

router.get("/new", (req, res) => {
  res.render("citizen/new");
});

router.post("/new", async (req, res) => {
  try {
    const {
      subject,
      description,
      phoneNumber,
      district,
      department,
      complaint_lat,
      complaint_lng,
    } = req.body;

    if (!subject || !description || !phoneNumber) {
      return res.redirect(
        "/citizen/new?error=Subject, description, and phone are required",
      );
    }

    const parsedLat = parseFloat(complaint_lat);
    const parsedLng = parseFloat(complaint_lng);

    const newComplaint = new Complaint({
      subject: subject.trim(),
      description: description.trim(),
      phoneNumber: (phoneNumber || "").replace(/\D/g, ""),
      district: district || "Ahmedabad",
      department: department || "Water Supply",
      complaint_lat: Number.isFinite(parsedLat) ? parsedLat : null,
      complaint_lng: Number.isFinite(parsedLng) ? parsedLng : null,
      status: "PENDING",
    });

    await newComplaint.save();
    console.log(
      `[CITIZEN] New complaint ${newComplaint._id} | GPS: ${parsedLat},${parsedLng}`,
    );
    res.redirect("/citizen");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
