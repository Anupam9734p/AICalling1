const express = require("express");
const router = express.Router();
const callService = require("../services/callService");
const openaiService = require("../services/openaiService");
const CallLog = require("../models/CallLog");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const User = require("../models/userModal");
const subUserSchema = require("../models/subUserSchema");
const accountSid = process.env.TWILIO_ACCOUNT_SID.trim();
const authToken = process.env.TWILIO_AUTH_TOKEN.trim();
const client = twilio(accountSid, authToken);
const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  console.log(token);
  if (!token) {
    return res.status(401).json({ message: "Access denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded);
    req.userId = decoded.userId;
    req.role = decoded.role; // Attach the role (admin/subuser) if needed
    next();
  } catch (error) {
    console.log("Error" + error);
    return res.status(400).json({ message: "Invalid or expired token" });
  }
};
// New demo transcript route
router.post("/demo-transcript", async (req, res) => {
  try {
    const demoTranscript = req.body.transcript;
    console.log(demoTranscript);

    const extractedInfo = await openaiService.processTranscript(demoTranscript);
    console.log("Extracted info from OpenAI:", extractedInfo);

    const newCallLog = new CallLog({
      createdAt: new Date(),
      endedAt: new Date(),
      status: "completed",
      customerNumber: "N/A",
      transcript: demoTranscript,
      extractedInfo: extractedInfo,
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

router.post("/send-emails", verifyToken, async (req, res) => {
  const { users, additionalInput } = req.body;
  const { userId, role } = req;

  let user;
  try {
    // Fetch user details based on their role
    if (role === "admin") {
      user = await User.findById(userId);
    } else if (role === "subuser") {
      user = await subUserSchema.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Calculate total emails to be sent
    const totalEmails = users.length;
    const totalCost = totalEmails; // Assuming each email costs 1 credit

    // Check if the user has enough credits to send the emails
    if (user.credits < totalCost) {
      return res
        .status(403)
        .json({ message: "Insufficient credits to send emails" });
    }

    // Validate email addresses and prepare mail options
    const emailPromises = users.map((user) => {
      const emailAddress = user[1];
      const name = user[0];

      // Simple regex to validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailAddress)) {
        return Promise.reject(
          new Error(`Invalid email address: ${emailAddress}`)
        );
      }

      const mailOptions = {
        from: "arijitghosh1203@gmail.com",
        to: emailAddress,
        subject: additionalInput,
        text: `Hello ${name}, this is a email from MAZER ${additionalInput}`,
      };

      // Return a promise for sending the email
      return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log(`Error sending email to ${emailAddress}:`, error);
            reject(new Error(`Failed to send email to ${emailAddress}`));
          } else {
            console.log(`Email sent to ${emailAddress}: ${info.response}`);
            resolve(info.response);
          }
        });
      });
    });

    // Wait for all emails to be sent
    await Promise.all(emailPromises);

    // Deduct credits from the user after successfully sending all emails
    user.credits -= totalCost;
    await user.save(); // Save the updated credits

    res.status(200).json({ message: "Emails sent successfully!" });
  } catch (error) {
    console.error(`Failed to send emails: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

router.post("/send-sms", verifyToken, async (req, res) => {
  const { users, additionalInfo } = req.body; // Get users and message
  const message = additionalInfo;
  const smsCostPerMessage = 2; // Each SMS costs 2 credits
  const totalSMS = users.length;
  const totalCost = totalSMS * smsCostPerMessage;

  try {
    const { userId, role } = req;
    let user, twilioSid, twilioToken, twilioNum;

    // Check if the user is an admin or subuser
    if (role === "admin") {
      // Fetch admin user
      user = await User.findById(userId);
      if (!user)
        return res.status(404).json({ message: "Admin user not found" });

      // Get Twilio credentials from admin user
      ({ twilioSid, twilioToken, twilioNum } = user);
    } else if (role === "subuser") {
      // Fetch subuser
      const subuser = await subUserSchema.findById(userId);
      if (!subuser)
        return res.status(404).json({ message: "Subuser not found" });

      // Fetch the admin for the subuser
      const admin = await User.findById(subuser.adminId);
      if (!admin)
        return res.status(404).json({ message: "Admin for subuser not found" });

      // Get Twilio credentials from admin user
      ({ twilioSid, twilioToken, twilioNum } = admin);

      // Use the subuser's credits
      user = subuser;
    }

    // Check if the user (admin or subuser) has enough credits to send all SMS
    if (user.credits < totalCost) {
      return res
        .status(403)
        .json({ message: "Insufficient credits to send messages" });
    }

    // Initialize Twilio client with the admin's Twilio credentials
    const twilioClient = require("twilio")(twilioSid, twilioToken);

    console.log(twilioSid);
    // Send the SMS messages
    const sendSmsPromises = users.map(async (user) => {
      const [name, phone] = user;
      const toNumber = phone.startsWith("+") ? phone : `+${phone}`;

      // Send the SMS
      const messageResult = await twilioClient.messages.create({
        body: `Hello ${name}, ${message}`,
        from: twilioNum,
        to: toNumber,
      });

      return messageResult.sid;
    });

    // Wait for all SMS to be sent
    const messageSids = await Promise.all(sendSmsPromises);

    // Deduct credits from the user after successfully sending all SMS
    user.credits -= totalCost;
    await user.save(); // Save the updated credits

    res.status(200).send({ success: true, messageSids });
  } catch (error) {
    console.error(`Failed to send messages: ${error.message}`);
    res.status(500).send({ success: false, error: error.message });
  }
});

module.exports = router;
