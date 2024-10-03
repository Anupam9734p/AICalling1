const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/userModal.js");
const router = express.Router();
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;
const authMiddleware = require("../middlewares/authMiddleware");

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
      { expiresIn: "1h" }
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

      console.log(user)
      if (!user) {
          return res.status(404).json({ message: "User not found" });
      }

      user[field] = value; 
      await user.save();

      res.status(200).json({ message: "Profile updated successfully", data: user });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error updating profile" });
  }
});


router.get("/home", authMiddleware, (req, res) => {
  res.status(200).json({
    message: "Welcome to the home page!",
    user: req.user,
  });
});

module.exports = router;
