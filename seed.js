require('dotenv').config();
const mongoose = require('mongoose');
const Complaint = require('./models/Complaint');
const DepartmentScore = require('./models/DepartmentScore');
const User = require('./models/User');

const seedComplaints = [
    {
        subject: 'Pothole on MG Road Bridge',
        description: 'Large pothole causing traffic congestion and risks for two-wheelers. Near the main signal.',
        phoneNumber: '9876543210',
        district: 'Ahmedabad',
        department: 'Roads & Buildings',
        status: 'PENDING',
        evidence: { photo_uploaded: 0, gps_match_flag: 0, ivr_call_status: 'NOT_CALLED' }
    },
    {
        subject: 'Waste Accumulation in Public Park',
        description: 'Trash has not been collected for 5 days. Foul smell in the area.',
        phoneNumber: '9000011111',
        district: 'Gandhinagar',
        department: 'Urban Development',
        status: 'RESOLVED_PENDING_VERIFICATION',
        evidence: { photo_uploaded: 0, gps_match_flag: 0, ivr_call_status: 'PENDING' }
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
            gps_match_flag: 1,
            gps_distance_meters: 120,
            ivr_call_status: 'SUCCESS',
            ivr_response: 1,
            ivr_called_at: new Date()
        },
        verification: {
            risk_score: 12,
            confidence: 0.94,
            reason: 'High confidence match. GPS location verified within 150m. Citizen confirmed resolution via IVR.',
            status: 'VERIFIED',
            verified_at: new Date()
        }
    },
    {
        subject: 'Street Light Failure — Sector 12',
        description: 'Multiple street lights non-functional for over 2 weeks. Safety hazard at night.',
        phoneNumber: '9988776655',
        district: 'Ahmedabad',
        department: 'Electricity',
        status: 'REOPENED',
        evidence: {
            photo_uploaded: 1,
            gps_match_flag: 0,
            ivr_call_status: 'DISPUTED',
            ivr_response: 2,
            ivr_called_at: new Date()
        },
        verification: {
            risk_score: 65,
            confidence: 0.35,
            reason: 'Citizen disputed resolution via IVR.',
            flags: ['Citizen disputed resolution', 'GPS location mismatch'],
            status: 'REOPENED',
            reopen_flag: 1,
            verified_at: new Date()
        },
        reopen_count: 1
    }
];

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/grievance-db');
        console.log('Connected to MongoDB for seeding...');

        // WIPE DATA
        await Complaint.deleteMany({});
        await DepartmentScore.deleteMany({});
        await User.deleteMany({});
        console.log('Cleared existing database records.');

        // SEED COMPLAINTS
        await Complaint.insertMany(seedComplaints);
        console.log(`Successfully seeded ${seedComplaints.length} sample complaints.`);

        // Initialize Department Scores
        const depts = [
            { department: 'Roads & Buildings', district: 'Ahmedabad', total_resolved: 5, verified_count: 4, quality_score: 80 },
            { department: 'Urban Development', district: 'Gandhinagar', total_resolved: 10, verified_count: 9, quality_score: 90 },
            { department: 'Infrastructure', district: 'Surat', total_resolved: 15, verified_count: 14, quality_score: 93 }
        ];
        await DepartmentScore.insertMany(depts);
        console.log('Initialized department performance scores.');

        // Seed demo users for all auth roles
        const demoUsers = [
            {
                name: 'Demo Citizen',
                email: 'citizen.demo@swagat.local',
                password: 'Citizen@123',
                role: 'citizen',
                status: 'APPROVED',
                district: 'Ahmedabad',
                department: 'Water Supply'
            },
            {
                name: 'Demo Field Officer',
                email: 'field.demo@swagat.local',
                password: 'Field@123',
                role: 'field_officer',
                status: 'APPROVED',
                district: 'Ahmedabad',
                department: 'Urban Development'
            },
            {
                name: 'Demo Department Officer',
                email: 'department.demo@swagat.local',
                password: 'Department@123',
                role: 'department_officer',
                status: 'APPROVED',
                district: 'Ahmedabad',
                department: 'Urban Development'
            },
            {
                name: 'Demo Collector',
                email: 'collector.demo@swagat.local',
                password: 'Collector@123',
                role: 'collector',
                status: 'APPROVED',
                district: 'Ahmedabad',
                department: 'District Administration'
            },
            {
                name: 'Pending Field Officer',
                email: 'field.pending@swagat.local',
                password: 'FieldPending@123',
                role: 'field_officer',
                status: 'PENDING',
                district: 'Ahmedabad',
                department: 'Urban Development'
            },
            {
                name: 'Pending Department Officer',
                email: 'department.pending@swagat.local',
                password: 'DeptPending@123',
                role: 'department_officer',
                status: 'PENDING',
                district: 'Ahmedabad',
                department: 'Urban Development'
            }
        ];

        for (const demoUser of demoUsers) {
            await User.create(demoUser);
        }
        console.log('Seeded demo users for role-based auth.');

        await mongoose.disconnect();
        console.log('Seeding complete. Connection closed.');
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
};

seedData();
