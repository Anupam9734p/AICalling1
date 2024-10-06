const { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY } = process.env;
const stripe = require("stripe")(STRIPE_SECRET_KEY);
const express = require("express");
const User = require("../models/userModal");
const transactionSchema = require("../models/transactionSchema");
const router = express.Router();

router.post("/payment", async (req, res) => {
  try {
    const { userEmail, amount, currency } = req.body;

    if (!userEmail || !amount || !currency) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const conversionRates = {
      USD: 100,
      INR: 7500,
      EUR: 90,
      GBP: 75,
      JPY: 11000,
      AUD: 130,
    };

    const convertedAmount = conversionRates[currency];

    const product = await stripe.products.create({
      name: "Premium Membership",
    });

    // console.log(product);
    if (product) {
      var price = await stripe.prices.create({
        product: `${product.id}`,
        unit_amount: parseInt(convertedAmount) * 100,
        currency: currency,
      });
    }

    if (price && price.id) {
      var session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price: `${price.id}`,
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `http://localhost:3000/api/auth/success/${userEmail}/${amount}`,
        cancel_url: "http://localhost:3000/api/auth/failed",
        customer_email: userEmail,
      });
    }

    res.json(session);
  } catch (error) {
    console.error("Error creating payment session:", error);
    res.status(500).send("Error creating payment session.");
  }
});

router.get("/success/:email/:payment", async (req, res) => {
  try {
    const { email, payment } = req.params; // Extract email and payment from request params
    const paymentAmount = parseFloat(payment); // Convert payment to a number
    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).send({
        message: "User doesn't exist",
        success: false,
      });
    }
    // Step 1: Update user role to 'admin'
    user.role = "admin";
    // Step 2: Update user's credits by adding the payment amount
    user.credits += paymentAmount;
    // Step 3: Create a new transaction and associate it with the user
    const newTransaction = await transactionSchema.create({
      userId: user._id,
      transactionType: "credit", // Assuming this is a credit transaction
      amount: paymentAmount,
    });
    // Add the transaction to the user's transactions array
    user.transactions.push(newTransaction._id);
    // Save the updated user
    await user.save();
    // Redirect to the payment success page
    res.redirect("https://ai-calling-demo.vercel.app/paymentSuccess.html");
  } catch (err) {
    console.log("Success Error: " + err);
    return res.status(500).send({
      message: "An error occurred during the process",
      success: false,
    });
  }
});

router.get("/failed", async (req, res) => {
  try {
    res.redirect("https://ai-calling-demo.vercel.app/paymentFailed.html");
  } catch (err) {
    console.log("failed Error" + err);
  }
});

module.exports = router;
