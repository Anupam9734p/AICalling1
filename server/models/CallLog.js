const mongoose = require('mongoose');

const callLogSchema = new mongoose.Schema({
    createdAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    status: { type: String, required: true },
    customerNumber: { type: String },
    transcript: { type: String, required: true },
    extractedInfo: { type: mongoose.Schema.Types.Mixed, required: true } // Using Mixed to store dynamic data
});

const CallLog = mongoose.model('CallLog', callLogSchema);

module.exports = CallLog;