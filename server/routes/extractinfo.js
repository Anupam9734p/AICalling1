const express = require('express');
const router = express.Router();
const CallLog = require('../models/CallLog');

router.get('/all', async (req, res) => {
    try {
        const callLogs = await CallLog.find({});
        console.log(callLogs); // Debug: Log the callLogs to the console
        res.json(callLogs);
    } catch (error) {
        console.error('Error fetching call logs:', error);
        res.status(500).json({ error: 'Failed to fetch call logs' });
    }
});


module.exports = router;