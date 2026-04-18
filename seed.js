require('dotenv').config();
const mongoose = require('mongoose');
const Complaint = require('./models/Complaint');
const DepartmentScore = require('./models/DepartmentScore');

const seedComplaints = [
    {
        subject: 'Pothole on MG Road Bridge',
        description: 'Large pothole causing traffic congestion and risks for two-wheelers. Near the main signal.',
        phoneNumber: '9876543210',
        district: 'Ahmedabad',
        department: 'Roads & Buildings',
        status: 'Pending',
        evidence: { photo_uploaded: 0, gps_match_flag: 0 }
    },
    {
        subject: 'Waste Accumulation in Public Park',
        description: 'Trash has not been collected for 5 days. Foul smell in the area.',
        phoneNumber: '9000011111',
        district: 'Gandhinagar',
        department: 'Urban Development',
        status: 'RESOLVED_PENDING_VERIFICATION',
        assigned_officer: 'Officer_GNR_01',
        evidence: { photo_uploaded: 0, gps_match_flag: 0 }
    },
    {
        subject: 'Bridge Structural Concerns',
        description: 'Cracks visible on the pillars of the subway bridge.',
        phoneNumber: '9111122222',
        district: 'Surat',
        department: 'Infrastructure',
        status: 'VERIFIED',
        evidence: {
            photo_uploaded: 1,
            photo_url: 'https://images.unsplash.com/photo-1545147418-4f1e62640246?auto=format&fit=crop&w=400&q=80',
            gps_lat: 21.1702,
            gps_lng: 72.8311,
            gps_match_flag: 1,
            gps_distance_meters: 120,
            ivr_call_status: 'SUCCESS',
            ivr_response: 1
        },
        verification: {
            risk_score: 12,
            confidence: 0.94,
            reason: 'High confidence match. GPS location verified within 150m. Citizen confirmed resolution via IVR.',
            status: 'VERIFIED'
        }
    }
];

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/grievance-verification');
        console.log('Connected to MongoDB for seeding...');

        // WIPE DATA
        await Complaint.deleteMany({});
        await DepartmentScore.deleteMany({});
        console.log('Cleared existing database records.');

        // SEED COMPLAINTS
        await Complaint.insertMany(seedComplaints);
        console.log('Successfully seeded 3 sample complaints.');

        // Initialize Department Scores
        const depts = [
            { department: 'Roads & Buildings', district: 'Ahmedabad', total_resolved: 5, verified_count: 4, quality_score: 80 },
            { department: 'Urban Development', district: 'Gandhinagar', total_resolved: 10, verified_count: 9, quality_score: 90 },
            { department: 'Infrastructure', district: 'Surat', total_resolved: 15, verified_count: 14, quality_score: 93 }
        ];
        await DepartmentScore.insertMany(depts);
        console.log('Initialized department performance scores.');

        await mongoose.disconnect();
        console.log('Seeding complete. Connection closed.');
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
};

seedData();
