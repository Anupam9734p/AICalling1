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
const sgMail = require("@sendgrid/mail");

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

router.post("/send-emails", verifyToken, async (req, res) => {
  const { users, additionalInput } = req.body; // Extract users and additional input from request body
  const { userId, role } = req; // Extract userId and role from the request
  const totalEmails = users.length;
  const totalCost = totalEmails;
  let user;
  let fromEmail; // Declare the fromEmail variable

  try {
    // Fetch user details based on their role
    if (role === "admin") {
      user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.credits < totalCost) {
        return res
          .status(403)
          .json({ message: "Insufficient credits to send messages" });
      }
      fromEmail = user.sendGridEmail; // Assuming admin's email is stored in User model
      sgMail.setApiKey(user.sendGridApiKey); // Set API key for SendGrid
    } else if (role === "subuser") {
      user = await subUserSchema.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "Sub-user not found" });
      }
      if (user.credit < totalCost) {
        return res
          .status(403)
          .json({ message: "Insufficient credits to send messages" });
      }
      const adminUser = await User.findById(user.adminId); // Get admin details
      if (!adminUser) {
        return res.status(404).json({ message: "Admin user not found" });
      }
      fromEmail = adminUser.sendGridEmail; // Get admin's email
      sgMail.setApiKey(adminUser.sendGridApiKey); // Set API key for SendGrid
    }

    // Calculate total emails to be sent
    // Assuming each email costs 1 credit

    // Check if the user has enough credits to send the emails
    if (user.credits < totalCost) {
      return res
        .status(403)
        .json({ message: "Insufficient credits to send emails" });
    }

    // Validate email addresses and prepare email sending promises
    const emailPromises = users.map((user) => {
      const emailAddress = user[1]; // Assuming user is an array with [name, email]
      const name = user[0];

      // Simple regex to validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailAddress)) {
        return Promise.reject(
          new Error(`Invalid email address: ${emailAddress}`)
        );
      }

      const subject = additionalInput;
      const text = `Hello ${name}, this is an email from MAZER. ${additionalInput}`;

      // Send email using SendGrid
      return sendEmail(emailAddress, subject, text, fromEmail);
    });

    // Wait for all emails to be sent
    await Promise.all(emailPromises);

    const emailLogEntries = users.map(() => ({
      count: 1,
      date: new Date(), // Timestamp for each email sent
    }));
    user.mainCount.push(...emailLogEntries);

    // Deduct credits from the user and increment emailCount after sending all emails
    if (role === "admin") {
      user.credits -= totalCost;
    } else if (role === "subuser") {
      user.credit -= totalCost;
    }
    await user.save(); // Save the updated credits and emailCount

    res.status(200).json({ message: "Emails sent successfully!" });
  } catch (error) {
    console.error(`Failed to send emails: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

async function sendEmail(to, subject, text, fromEmail) {
  const msg = {
    to: to,
    from: fromEmail, // Use the admin's verified sender email address
    subject: subject,
    text: text,
  };

  try {
    await sgMail.send(msg);
    console.log(`Email sent to ${to}`);
    return `Email sent to ${to}`;
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    throw new Error(`Failed to send email to ${to}`);
  }
}

router.post("/send-sms", verifyToken, async (req, res) => {
  const { users, additionalInfo } = req.body; // Get users and message
  const message = additionalInfo;
  const smsCostPerMessage = 2; // Each SMS costs 2 credits

  try {
    const { userId, role } = req;
    let user, twilioSid, twilioToken, twilioNum;

    // Check if the user is an admin or subuser
    if (role === "admin") {
      user = await User.findById(userId);
      if (!user)
        return res.status(404).json({ message: "Admin user not found" });

      // Get Twilio credentials from admin user
      ({ twilioSid, twilioToken, twilioNum } = user);
    } else if (role === "subuser") {
      const subuser = await subUserSchema.findById(userId);
      if (!subuser)
        return res.status(404).json({ message: "Subuser not found" });

      // Fetch the admin for the subuser
      const admin = await User.findById(subuser.adminId);
      if (!admin)
        return res.status(404).json({ message: "Admin for subuser not found" });

      // Get Twilio credentials from admin user
      ({ twilioSid, twilioToken, twilioNum } = admin);
      user = subuser;
    }

    // Initialize Twilio client with the admin's Twilio credentials
    const twilioClient = require("twilio")(twilioSid, twilioToken);

    const successfulMessages = []; // To keep track of successfully sent messages

    for (let i = 0; i < users.length; i++) {
      const [name, phone] = users[i];
      const toNumber = phone.startsWith("+") ? phone : `+${phone}`;

      try {
        // Send the SMS
        const messageResult = await twilioClient.messages.create({
          body: `Hello ${name}, ${message}`,
          from: twilioNum,
          to: toNumber,
        });

        successfulMessages.push(messageResult.sid);

        // Deduct credits after each successful message send
        if (role === "admin") {
          user.credits -= smsCostPerMessage;
        } else if (role === "subuser") {
          user.credit -= smsCostPerMessage;
        }

        // Save the user with updated credits after each message
        await user.save();
      } catch (error) {
        console.error(
          `Failed to send message to ${toNumber}: ${error.message}`
        );
        // Continue with the next message if there's an error
      }
    }

    res.status(200).send({ success: true, messageSids: successfulMessages });
  } catch (error) {
    console.error(`Failed to send messages: ${error.message}`);
    res.status(500).send({ success: false, error: error.message });
  }
});

const verifyTokenSms = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Access denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.role = decoded.role; // Either 'admin' or 'subuser'

    if (req.role === "subuser") {
      // Find subuser and populate admin's credentials
      const subUser = await SubUser.findById(req.userId).populate("adminId");
      if (!subUser) {
        return res.status(404).json({ message: "Subuser not found" });
      }

      // Attach admin credentials to request
      req.credentials = {
        twilioToken: subUser.adminId.twilioToken,
        twilioSid: subUser.adminId.twilioSid,
        twilioNum: subUser.adminId.twilioNum,
      };
    } else {
      // For admin, attach admin's own credentials
      const adminUser = await User.findById(req.userId);
      req.credentials = {
        twilioToken: adminUser.twilioToken,
        twilioSid: adminUser.twilioSid,
        twilioNum: adminUser.twilioNum,
      };
    }
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    return res.status(400).json({ message: "Invalid or expired token" });
  }
};
router.post("/send-sms-property", verifyTokenSms, async (req, res) => {
  console.log("Comer")
  const { toNumber, message } = req.body;

  // Use Twilio credentials from req.credentials
  const { twilioSid, twilioToken, twilioNum } = req.credentials;
  const client = require("twilio")(twilioSid, twilioToken);

  try {
    const sms = await client.messages.create({
      body: message,
      from: twilioNum,
      to: toNumber,
    });

    res.status(200).json({ message: "SMS sent successfully", sms });
  } catch (error) {
    console.error("Error sending SMS:", error);
    res.status(500).json({ message: "Failed to send SMS" });
  }
});

const verifyTokenEmail = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Access denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.role = decoded.role; // Either 'admin' or 'subuser'

    if (req.role === "subuser") {
      // Find subuser and populate admin's credentials
      const subUser = await SubUser.findById(req.userId).populate("adminId");
      if (!subUser || !subUser.adminId) {
        return res.status(404).json({ message: "Subuser or admin not found" });
      }

      // Attach admin's SendGrid credentials to request
      req.sendGridApiKey = subUser.adminId.sendGridApiKey;
      req.sendGridEmail = subUser.adminId.sendGridEmail;
      req.recipientEmail = subUser.adminId.email; // Set the recipient as the admin's email
    } else {
      // For admin, attach admin's own credentials and email
      const adminUser = await User.findById(req.userId);
      if (!adminUser) {
        return res.status(404).json({ message: "Admin not found" });
      }
      req.sendGridApiKey = adminUser.sendGridApiKey;
      req.sendGridEmail = adminUser.sendGridEmail;
      req.recipientEmail = adminUser.email; // Set the recipient as the admin's email
    }
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    return res.status(400).json({ message: "Invalid or expired token" });
  }
};
const sendgridEmail1 = require("@sendgrid/mail");
// Route to send email
router.post("/send-email-property", verifyTokenEmail, async (req, res) => {
  const { subject, message } = req.body;

  console.log(req)
  console.log("Come")
  try {
    // Initialize SendGrid with the API key from the authenticated user
    sendgridEmail1.setApiKey(req.sendGridApiKey);

    // Define the email options
    const emailOptions = {
      to:  req.recipientEmail,            // Recipient email from middleware
      from: req.sendGridEmail,           // Sender's email (admin's SendGrid email)
      subject: subject || "Notification from Service",
      text: message || "This is a test email sent via SendGrid.",
    };

    // Send the email
    await sendgridEmail1.send(emailOptions);

    res.status(200).json({ message: "Email sent successfully." });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ message: "Failed to send email", error: error.message });
  }
});

module.exports = router;
