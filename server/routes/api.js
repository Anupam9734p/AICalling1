const express = require('express');
const router = express.Router();
const callService = require('../services/callService');
const openaiService = require('../services/openaiService');
const CallLog = require('../models/CallLog');
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const accountSid = process.env.TWILIO_ACCOUNT_SID.trim();
const authToken = process.env.TWILIO_AUTH_TOKEN.trim();
const client = twilio(accountSid, authToken);

// New demo transcript route
router.post('/demo-transcript', async (req, res) => {
    try {
        const demoTranscript = req.body.transcript;
        console.log(demoTranscript);
        
        

        const extractedInfo = await openaiService.processTranscript(demoTranscript);
        console.log('Extracted info from OpenAI:', extractedInfo);

        const newCallLog = new CallLog({
            createdAt: new Date(),
            endedAt: new Date(),
            status: 'completed',
            customerNumber: 'N/A',
            transcript: demoTranscript,
            extractedInfo: extractedInfo
        });

        await newCallLog.save();
        // console.log('Demo call info stored successfully:', newCallLog);

        res.json(extractedInfo);
    } catch (error) {
        // console.error('Error processing demo transcript:', error);
        res.status(500).json({ error: error.message });
    }
});


const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "arijitghosh1203@gmail.com",
      pass: "hryc yasr hlft mjsi",
    },
  });
  
  router.post("/send-emails", async (req, res) => {
    const users = req.body;
  
    console.log(users);
    users.forEach((user) => {
      const emailAddress = user[1];
      const name = user[0];
  
      const mailOptions = {
        from: "arijitghosh1203@gmail.com",
        to: emailAddress,
        subject: "Your Subject Here",
        text: `Hello ${name}, this is a test email!`,
      };
  
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log(`Error sending email to ${emailAddress}:`, error);
        } else {
          console.log(`Email sent to ${emailAddress}: ${info.response}`);
        }
      });
    });
  
    res.send({ message: "Emails sent successfully!" });
  });
  
  router.post("/send-sms", async (req, res) => {
    const users = req.body;
    const message = "Your custom message";
    console.log(users);
    try {
      const sendSmsPromises = users.map(async (user) => {
        const [name, phone] = user;
        const toNumber = phone.startsWith("+") ? phone : `+${phone}`;
        console.log(toNumber);
        return client.messages.create({
          body: `Hello ${name}, ${message}`,
          from: "+18552974391",
          to: "+917439120030",
        });
      });
      const results = await Promise.all(sendSmsPromises);
      const messageSids = results.map((msg) => msg.sid);
      res.status(200).send({ success: true, messageSids });
    } catch (error) {
      console.log("Error" + error);
      console.error(`Failed to send messages: ${error.message}`);
      res.status(500).send({ success: false, error: error.message });
    }
  });


module.exports = router;
