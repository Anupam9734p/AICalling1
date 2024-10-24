const express = require('express');
const router = express.Router();
const CallLog = require('../models/CallLog');
const bodyParser = require('body-parser');
// const readline = require('readline');

// const router = express.Router();
const cors = require('cors');

const app = express()

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Route to get all call logs
router.get('/call-logs', async (req, res) => {
    try {
        const callLogs = await CallLog.find({}, 'customerNumber transcript extractedInfo').exec();
        res.json(callLogs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch call logs' });
    }
});

router.get('/test', (req, res) => {
    res.send('Test route works!');
});


module.exports = router;
