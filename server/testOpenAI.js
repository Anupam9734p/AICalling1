require('dotenv').config();
const openaiService = require('./services/openaiService');

openaiService.testProcessTranscript()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Test failed:', error);
        process.exit(1);
    });
