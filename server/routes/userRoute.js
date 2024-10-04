const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/userModal.js");
const router = express.Router();
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;
const authMiddleware = require("../middlewares/authMiddleware");
const subUserSchema = require("../models/subUserSchema.js");

router.post("/signup", async (req, res) => {
  const { name, email, password, phone } = req.body;
  console.log(req.body);
  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const newUser = new User({ name, email, password, phone });
    await newUser.save();

    return res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server Error" });
  }
});
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: "1d" }
    );
    return res.status(200).json({
      message: "Login successful",
      success: true,
      token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server Error" + err });
  }
});

router.get("/validate", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1]; // Get the token from the Authorization header

  if (!token) {
    return res.status(401).json({ valid: false, message: "No token provided" });
  }

  jwt.verify(token, JWT_SECRET, (err) => {
    if (err) {
      return res.status(401).json({ valid: false, message: "Invalid token" });
    }

    return res.status(200).json({ valid: true });
  });
});

router.get("/validate-profile", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ valid: false, message: "No token provided" });
  }

  jwt.verify(token, JWT_SECRET, async (err, data) => {
    if (err) {
      return res.status(401).json({ valid: false, message: "Invalid token" });
    }

    const userData = await User.findById(data.userId);

    return res.status(200).json({ valid: true, data: userData });
  });
});

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Access denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(400).json({ message: "Invalid token" });
  }
};

router.post("/update-profile", verifyToken, async (req, res) => {
  const { field, value } = req.body;
  try {
    const user = await User.findById(req.userId);

    console.log(user);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

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

router.post("/add-subUser", async (req, res) => {
  try {
    console.log(req.body);
    const { name, email, password, phone } = req.body;

    // Check if sub-user with the same email already exists
    const checkUser = await subUserSchema.findOne({ email });
    if (checkUser) {
      return res
        .status(401)
        .json({ message: "Sub-user with this email already exists" });
    }

    // Get token and verify it
    const token = req.headers.authorization?.split(" ")[1];
    console.log(token)
    if (!token) {
      return res.status(403).json({ message: "Authorization token missing" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    console.log(decoded)
    // Find admin user from decoded token
    const adminData = await User.findById(decoded.userId);
    if (!adminData || adminData.role !== "admin") {
      return res.status(401).json({ message: "No permission to add sub-user" });
    }

    // Create new sub-user
    const user = new subUserSchema({
      adminId: adminData._id, // Adding reference to admin
      name,
      email,
      password, // Password will be hashed by subUserSchema pre-save hook
      phone,
    });

    // Save the new sub-user
    await user.save();
    const subUserId = user._id;

    // Add sub-user to the admin's subUsers list
    adminData.subUsers.push(subUserId);
    await adminData.save();

    console.log(adminData);
    res.status(201).json({ message: "Sub-user added successfully" });
  } catch (error) {
    console.error("Error occurred while adding sub-user: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/home", authMiddleware, (req, res) => {
  res.status(200).json({
    message: "Welcome to the home page!",
    user: req.user,
  });
});

module.exports = router;
