const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/userModal.js");
const router = express.Router();
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;
const authMiddleware = require("../middlewares/authMiddleware");
const SubUser = require("../models/subUserSchema.js");

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
        return res
          .status(401)
          .json({ message: "Invalid username or password" });
      }
    }

    // Check if the password matches
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("come");
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role || role }, // Check if user has role, otherwise default to 'subuser'
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
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ valid: false, message: "No token provided" });
  }

  jwt.verify(token, JWT_SECRET, async (err, data) => {
    if (err) {
      return res.status(401).json({ valid: false, message: "Invalid token" });
    }

    let user = await User.findById(data.userId);
    if (!user) {
      user = await SubUser.findById(data.userId);
    }

    if (!user) {
      return res.status(404).json({ valid: false, message: "User not found" });
    }

    return res.status(200).json({ valid: true, role: user.role });
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

    let userData = await User.findById(data.userId);
    if (!userData) {
      userData = await SubUser.findById(data.userId);
    }

    if (!userData) {
      return res.status(404).json({ valid: false, message: "User not found" });
    }

    return res.status(200).json({ valid: true, data: userData });
  });
});

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
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
      return res.status(403).json({ message: "Access denied" });
    }
    const users = await User.findOne({email:user.email}).populate("subUsers");
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

router.post("/update-profile", verifyToken, async (req, res) => {
  const { field, value } = req.body;

  try {
    let user = await User.findById(req.userId);
    if (!user) {
      user = await SubUser.findById(req.userId);
    }

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
    const checkUser = await SubUser.findOne({ email });
    if (checkUser) {
      return res
        .status(401)
        .json({ message: "Sub-user with this email already exists" });
    }

    // Get token and verify it
    const token = req.headers.authorization?.split(" ")[1];
    console.log(token);
    if (!token) {
      return res.status(403).json({ message: "Authorization token missing" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    console.log(decoded);
    // Find admin user from decoded token
    const adminData = await User.findById(decoded.userId);
    if (!adminData || adminData.role !== "admin") {
      return res.status(401).json({ message: "No permission to add sub-user" });
    }

    // Create new sub-user
    const user = new SubUser({
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
