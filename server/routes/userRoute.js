const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/userModal.js");
const router = express.Router();
require("dotenv").config();
const nodemailer = require("nodemailer");
const otpStore = {};
const JWT_SECRET = process.env.JWT_SECRET;
const authMiddleware = require("../middlewares/authMiddleware");
const SubUser = require("../models/subUserSchema.js");
const crypto = require("crypto");
const CallLog = require("../models/CallLog.js");
const multer = require("multer");
const subUserSchema = require("../models/subUserSchema.js");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const twilio = require("twilio");
const accountSid = process.env.TWILIO_ACCOUNT_SID.trim();
const authToken = process.env.TWILIO_AUTH_TOKEN.trim();
const client = twilio(accountSid, authToken);

const axios = require("axios");
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const API_URL = "https://api.vapi.ai/call";
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "arijitghosh1203@gmail.com",
    pass: "hryc yasr hlft mjsi",
  },
});
router.post("/signup", async (req, res) => {
  const { name, email, password, phone } = req.body;

  try {
    // Check if the user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = otp; // Store the OTP for later verification

    // Send OTP to the user's email
    await transporter.sendMail({
      from: "arijitghosh1203@gmail.com",
      to: email,
      subject: "Your OTP for Signup - OTP Mazer",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9;">
          <h2 style="text-align: center; color: #007BFF;">OTP Mazer</h2>
          <p style="font-size: 16px; color: #333;">Hi there,</p>
          <p style="font-size: 16px; color: #333;">Thank you for signing up with <strong>OTP Mazer</strong>! To complete your registration, please use the OTP below:</p>
          <div style="text-align: center; margin: 20px 0;">
            <p style="font-size: 24px; font-weight: bold; background-color: #007BFF; color: white; padding: 10px; border-radius: 4px; display: inline-block;">${otp}</p>
          </div>
          <p style="font-size: 16px; color: #333;">Please enter this OTP within the next 10 minutes to complete your signup process. If you did not request this, please ignore this email.</p>
          <p style="font-size: 16px; color: #333;">Best regards,<br>OTP Mazer Team</p>
          <footer style="text-align: center; margin-top: 20px; font-size: 12px; color: #888;">
            © 2024 OTP Mazer. All rights reserved.
          </footer>
        </div>
      `,
    });

    res.status(200).json({ message: "OTP sent to email. Please verify." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server Error" });
  }
});

// Route to verify OTP and complete the registration
router.post("/verify-otp", async (req, res) => {
  const { name, email, password, phone, otp } = req.body;

  try {
    // Verify OTP
    if (otpStore[email] !== otp) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // OTP is valid, remove it from store
    delete otpStore[email];

    // Register the new user
    const newUser = new User({ name, email, password, phone });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server Error" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  console.log(email);
  console.log(password);
  try {
    // First check in User collection
    let user = await User.findOne({ email });
    let role = "user";

    if (!user) {
      // If not found, check in SubUser collection
      user = await SubUser.findOne({ email });
      console.log(user);
      role = "subuser";

      if (!user) {
        res.flash("error", "Invalid username or password");
        return res
          .status(401)
          .json({ message: "Invalid username or password" });
      }
    }

    console.log(user);

    console.log(password + "Login");

    // Check if the password matches
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("come");
      res.flash("error", "Invalid username or password");
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role || role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.flash("success", "Login successful");
    return res.status(200).json({
      message: "Login successful",
      success: true,
      token,
    });
  } catch (err) {
    console.error(err);
    res.flash("error", "Server Error");
    return res.status(500).json({ message: "Server Error" + err });
  }
});

router.get("/validate", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.flash("No token provided");
    return res.status(401).json({ valid: false, message: "No token provided" });
  }

  jwt.verify(token, JWT_SECRET, async (err, data) => {
    if (err) {
      res.flash("Invalid token");
      return res.status(401).json({ valid: false, message: "Invalid token" });
    }

    let user = await User.findById(data.userId);
    if (!user) {
      user = await SubUser.findById(data.userId);
    }

    if (!user) {
      res.flash("User not found");
      return res.status(404).json({ valid: false, message: "User not found" });
    }

    return res.status(200).json({ valid: true, role: user.role, data: user });
  });
});

router.get("/validate-profile", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.flash("No token provided");
    return res.status(401).json({ valid: false, message: "No token provided" });
  }

  jwt.verify(token, JWT_SECRET, async (err, data) => {
    if (err) {
      res.flash("error", "Invalid token");
      return res.status(401).json({ valid: false, message: "Invalid token" });
    }

    let userData = await User.findById(data.userId);
    if (!userData) {
      userData = await SubUser.findById(data.userId);
    }

    if (!userData) {
      res.flash("User not found");
      return res.status(404).json({ valid: false, message: "User not found" });
    }

    return res.status(200).json({ valid: true, data: userData });
  });
});

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    res.flash("Access denied");
    return res.status(401).json({ message: "Access denied" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.role = decoded.role; // You can access role if needed
    next();
  } catch (error) {
    return res.status(400).json;
  }
};

router.get("/users", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.role !== "admin") {
      res.flash("Access denied");
      return res.status(403).json({ message: "Access denied" });
    }
    const users = await User.findOne({ email: user.email }).populate(
      "subUsers"
    );
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.flash("error", "Server Error");
    res.status(500).json({ message: "Server Error" });
  }
});

router.post("/update-profile", verifyToken, async (req, res) => {
  const { field, value } = req.body;

  console.log(field);
  console.log(value);
  try {
    let user = await User.findById(req.userId);
    if (!user) {
      user = await SubUser.findById(req.userId);
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // If the field to update is 'password', hash it first
    // if (field === "password") {
    //   console.log("Come");
    //   const salt = await bcrypt.genSalt(10);
    //   user.password = await bcrypt.hash(value, salt);
    // } else {
    //   user[field] = value;
    // }

    user[field] = value;
    await user.save();
    res
      .status(200)
      .json({ message: "Profile updated successfully", data: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating profile" });
  }
});

router.get("/twilio/messages", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const today = new Date();
    const startDate = new Date();

    startDate.setDate(today.getDate() - days);

    const formattedStartDate = startDate.toISOString().split("T")[0];
    const formattedEndDate = today.toISOString().split("T")[0];

    const messages = await client.messages.list({
      dateSentAfter: new Date(formattedStartDate),
      dateSentBefore: new Date(formattedEndDate),
      limit: 100,
    });
    res.json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Error fetching message details" });
  }
});

router.post("/add-subUser", async (req, res) => {
  try {
    console.log(req.body);
    const { name, email, password, phone, credit } = req.body;

    // Check if sub-user with the same email already exists in SubUser
    const checkSubUser = await SubUser.findOne({ email });
    if (checkSubUser) {
      res.flash("Sub-user with this email already exists");
      return res
        .status(401)
        .json({ message: "Sub-user with this email already exists" });
    }

    // Check if the email exists in the User model
    const checkUser = await User.findOne({ email });
    if (checkUser) {
      res.flash("User with this email already exists");
      return res
        .status(401)
        .json({ message: "User with this email already exists" });
    }

    // Get token and verify it
    const token = req.headers.authorization?.split(" ")[1];
    console.log(token);
    if (!token) {
      res.flash("Authorization token missing");
      return res.status(403).json({ message: "Authorization token missing" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      res.flash("Invalid or expired token");
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    console.log(decoded);
    // Find admin user from decoded token
    const adminData = await User.findById(decoded.userId);
    if (!adminData || adminData.role !== "admin") {
      res.flash("No permission to add sub-user");
      return res.status(401).json({ message: "No permission to add sub-user" });
    }

    if (adminData.credits < credit) {
      return res
        .status(403)
        .json({ message: "Insufficient credits to add a sub-user" });
    }

    adminData.credits -= credit;
    // Create new sub-user
    const newSubUser = new SubUser({
      name,
      email,
      password,
      phone,
      adminId: adminData._id,
      credit,
      totalCredit: credit,
    });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000;
    newSubUser.resetToken = resetToken;
    newSubUser.resetTokenExpiry = resetTokenExpiry;

    await newSubUser.save();

    adminData.subUsers.push(newSubUser._id);
    await adminData.save();

    const resetUrl = `https://ai-calling-demo.vercel.app/passwordreset.html?token=${resetToken}&email=${newSubUser.email}`;
    console.log(resetUrl);
    await sendPasswordResetEmail(newSubUser.email, resetUrl);

    res
      .status(201)
      .json({ message: "Sub-user added successfully", user: newSubUser });
  } catch (error) {
    console.error("Error adding sub-user:", error);
    res.status(500).json({ message: "Server error" });
  }
});
async function sendPasswordResetEmail(email, resetUrl) {
  console.log("Come");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "arijitghosh1203@gmail.com",
      pass: "hryc yasr hlft mjsi",
    },
  });
  const mailOptions = {
    from: "arijitghosh1203@gmail.com",
    to: email,
    subject: "Change Your Password",
    html: `<p>Please click the following link to change your password:</p><a href="${resetUrl}">Change Your Password</a>`,
  };

  await transporter.sendMail(mailOptions);
}

router.post("/reset-password", async (req, res) => {
  try {
    const { token, email, newPassword } = req.body;

    const subUser = await SubUser.findOne({
      email,
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!subUser) {
      return res
        .status(400)
        .json({ message: "Invalid or expired token. Please try again." });
    }

    // Update the password
    subUser.password = newPassword;
    subUser.resetToken = undefined;
    subUser.resetTokenExpiry = undefined;
    await subUser.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({
      message: "An unexpected server error occurred. Please try again later.",
    });
  }
});

router.get("/check-credit", verifyToken, async (req, res) => {
  try {
    const { userId, role } = req;
    let user;

    if (role === "admin") {
      user = await User.findById(userId);
    } else if (role === "subuser") {
      user = await SubUser.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the user has at least one credit
    if (user.credits < 1 || user.credit < 1) {
      return res.status(403).json({ message: "Insufficient credits" });
    }

    res.status(200).json({ message: "Sufficient credits available" });
  } catch (error) {
    console.error("Error checking credits: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/update-credit", verifyToken, async (req, res) => {
  try {
    const { userId, role } = req;
    let user;

    // Check if the role is 'admin' or 'subuser'
    if (role === "admin") {
      user = await User.findById(userId);
    } else if (role === "subuser") {
      user = await SubUser.findById(userId).populate("adminId");
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Initialize admin variable for clarity
    let admin;

    // If the role is 'subuser', also fetch the admin and deduct their credits
    if (role === "subuser") {
      admin = user.adminId; // This comes from the populated adminId field
      if (!admin) {
        return res
          .status(404)
          .json({ message: "Admin not found for this sub-user" });
      }
    }

    // Deduct credit for both sub-user and admin if necessary
    const deductCredit = (account) => {
      if (account.credits && account.credits > 0) {
        account.credits -= 1;
      } else if (account.credit && account.credit > 0) {
        account.credit -= 1;
      }
    };

    // Deduct credit for the current user (admin or subuser)
    deductCredit(user);

    // Save the updated user information
    await user.save();

    // Return the updated credits in the response (choosing the correct field)
    const remainingCredits = user.credits || user.credit;
    return res.json({
      message: "Credit updated successfully",
      credits: remainingCredits,
    });
  } catch (error) {
    console.error("Error updating credits:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/subuser/:id", async (req, res) => {
  try {
    const subUserId = req.params.id;

    // Find and delete the sub-user
    const deletedSubUser = await SubUser.findByIdAndDelete(subUserId);

    if (!deletedSubUser) {
      return res.status(404).json({ message: "Sub-user not found" });
    }

    // Remove the reference from the parent user
    await User.findOneAndUpdate(
      { subUsers: subUserId },
      { $pull: { subUsers: subUserId } }
    );

    res.status(200).json({ message: "Sub-user deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/check-bulk-credit", verifyToken, async (req, res) => {
  try {
    const { userId, role } = req;
    const { callCount } = req.body; // Number of calls to be made in bulk

    let user;

    if (role === "admin") {
      user = await User.findById(userId);
    } else if (role === "subuser") {
      user = await SubUser.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the user has enough credits for the bulk call
    const availableCredits = user.credits || user.credit;

    if (availableCredits >= callCount) {
      // Return success message without deducting credits
      return res.json({
        message: "Sufficient credits available",
        remainingCredits: availableCredits,
      });
    } else {
      return res
        .status(403)
        .json({ message: "Insufficient credits for bulk call" });
    }
  } catch (error) {
    console.error("Error checking credits for bulk call:", error);
    res.status(500).json({
      message: "An error occurred while checking credits for bulk call",
    });
  }
});

router.get("/admins", async (req, res) => {
  try {
    const admins = await User.find({ role: "admin" });
    res.status(200).json({ admins: admins });
  } catch (error) {
    console.error("Error fetching admin data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/get-graphData", async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 15;

    const currentDate = new Date();
    const startDate = new Date();
    startDate.setDate(currentDate.getDate() - days);
    const formattedStartDate = startDate.toISOString().split("T")[0];
    const formattedEndDate = currentDate.toISOString().split("T")[0];

    const response = await axios.get(API_URL, {
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
      },
      params: {
        createdAtGt: formattedStartDate,
        createdAtLt: formattedEndDate,
      },
    });

    if (response.status === 200) {
      const callData = response.data;

      return res.status(200).json({
        message: "Data sent successfully",
        success: true,
        callData: callData.length,
      });
    } else {
      return res.status(response.status).json({
        message: "Failed to fetch data from VAPI API",
        success: false,
      });
    }
  } catch (error) {
    console.error("Error fetching graph data:", error);
    return res.status(500).json({
      message: "An error occurred while fetching graph data",
      success: false,
    });
  }
});

router.post("/updateProfilePic", upload.single("image"), async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    const userRole = decoded.role;

    let updatedUser;
    if (
      userRole === "admin" ||
      userRole === "user" ||
      userRole === "super_admin"
    ) {
      updatedUser = await User.findById(userId);
    } else if (userRole === "subuser") {
      updatedUser = await SubUser.findById(userId);
    }

    if (!updatedUser) {
      return res
        .status(404)
        .json({ status: "error", message: "User or Subuser not found" });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ status: "error", message: "No file uploaded" });
    }

    updatedUser.profileImage = {
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      originalName: req.file.originalname,
    };

    await updatedUser.save();
    res.json({ status: "ok", user: updatedUser });
  } catch (error) {
    console.error("Profile Image error: " + error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/home", authMiddleware, (req, res) => {
  res.flash("Welcome to home page");
  res.status(200).json({
    message: "Welcome to the home page!",
    user: req.user,
  });
});

module.exports = router;
