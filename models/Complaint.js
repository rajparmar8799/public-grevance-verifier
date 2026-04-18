const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Resolved', 'Reopened', 'Verification Failed'],
        default: 'Pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);
