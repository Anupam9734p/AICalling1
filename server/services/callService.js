const axios = require('axios');

const API_URL = 'https://api.vapi.ai/call';
const API_KEY = process.env.VAPI_API_KEY;

exports.getCalls = async () => {
    const response = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${API_KEY}` }
    });
    return response.data;
};

exports.updateCall = async (callId, updateData) => {
    await axios.patch(`${API_URL}/${callId}`, updateData, {
        headers: { Authorization: `Bearer ${API_KEY}` }
    });
};