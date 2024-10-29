const express = require('express');
const router = express.Router();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

router.post('/send-sms', (req, res) => {
  const { toNumber, message } = req.body;

  console.log(toNumber)
  client.messages
    .create({
      body: message,
      from: '+18064194064', // Your Twilio phone number
      to: toNumber,
    })
    .then((message) => {
      console.log(`Message sent successfully. Message SID: ${message.sid}`);
      res.status(200).send({ success: true, sid: message.sid });
    })
    .catch((error) => {
      console.log("Error" + error)
      console.error(`Failed to send message: ${error.message}`);
      res.status(500).send({ success: false, error: error.message });
    });
});

module.exports = router;
