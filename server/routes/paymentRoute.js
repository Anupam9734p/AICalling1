const { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY } = process.env;
const stripe = require("stripe")(STRIPE_SECRET_KEY);
const express = require("express");
const User = require("../models/userModal");
const transactionSchema = require("../models/transactionSchema");
const router = express.Router();

router.post("/payment", async (req, res) => {
  try {
    const { userEmail, plan, amount, currency } = req.body;

    if (!userEmail || !plan || !amount || !currency) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const conversionRates = {
      USD: 1,
      INR: 75,
      EUR: 0.9,
      GBP: 0.75,
      JPY: 110,
      AUD: 1.3,
    };
    const convertedAmount = amount * conversionRates[currency];
    const product = await stripe.products.create({
      name: `${plan} Membership`,
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: parseInt(convertedAmount * 100),
      currency: currency.toLowerCase(),
    });

    if (price && price.id) {
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price: price.id,
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `https://aicalling-demo.onrender.com/api/auth/success/${userEmail}/${plan}/${amount}`,
        cancel_url: "https://aicalling-demo.onrender.com/api/auth/failed",
        customer_email: userEmail,
      });

      res.json({ url: session.url });
    }
  } catch (error) {
    console.error("Error creating payment session:", error);
    res.status(500).send("Error creating payment session.");
  }
});


router.get("/success/:email/:payment/:amount", async (req, res) => {
  try {
    const { email, payment,amount } = req.params; 
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).send({
        message: "User doesn't exist",
        success: false,
      });
    }
    user.role = "admin";
    user.credits += parseInt(amount, 10);
    const newTransaction = await transactionSchema.create({
      userId: user._id,
      transactionType: "credit",
      amount: payment,
    });

    user.transactions.push(newTransaction._id);
    await user.save();
    res.redirect("https://ai-calling-demo-otyj.vercel.app/paymentSuccess.html");
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
    res.redirect("https://ai-calling-demo-otyj.vercel.app/paymentFailed.html");
  } catch (err) {
    console.log("failed Error" + err);
  }
});

module.exports = router;
