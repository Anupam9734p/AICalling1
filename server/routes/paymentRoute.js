// const { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY } = process.env;
// const stripe = require("stripe")(STRIPE_SECRET_KEY);
// const express = require("express");
// const User = require("../models/userModal");
// const transactionSchema = require("../models/transactionSchema");
// const router = express.Router();

// router.post("/payment", async (req, res) => {
//   try {
//     const { userEmail, plan, amount, currency } = req.body;

//     if (!userEmail || !plan || !amount || !currency) {
//       return res.status(400).json({ message: "Missing required fields" });
//     }
//     const conversionRates = {
//       USD: 1,
//       INR: 75,
//       EUR: 0.9,
//       GBP: 0.75,
//       JPY: 110,
//       AUD: 1.3,
//     };
//     const convertedAmount = amount * conversionRates[currency];
//     const product = await stripe.products.create({
//       name: `${plan} Membership`,
//     });

//     const price = await stripe.prices.create({
//       product: product.id,
//       unit_amount: parseInt(convertedAmount * 100),
//       currency: currency.toLowerCase(),
//     });

//     if (price && price.id) {
//       const session = await stripe.checkout.sessions.create({
//         line_items: [
//           {
//             price: price.id,
//             quantity: 1,
//           },
//         ],
//         mode: "payment",
//         success_url: `https://aicalling-demo.onrender.com/api/auth/success/${userEmail}/${plan}/${amount}`,
//         cancel_url: "https://aicalling-demo.onrender.com/api/auth/failed",
//         customer_email: userEmail,
//       });

//       res.json({ url: session.url });
//     }
//   } catch (error) {
//     console.error("Error creating payment session:", error);
//     res.status(500).send("Error creating payment session.");
//   }
// });


// router.get("/success/:email/:payment/:amount", async (req, res) => {
//   try {
//     const { email, payment,amount } = req.params; 
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(401).send({
//         message: "User doesn't exist",
//         success: false,
//       });
//     }
//     user.role = "admin";
//     user.credits += parseInt(amount, 10);
//     const newTransaction = await transactionSchema.create({
//       userId: user._id,
//       transactionType: "credit",
//       amount: payment,
//     });

//     user.transactions.push(newTransaction._id);
//     await user.save();
//     res.redirect("https://ai-calling-demo-otyj.vercel.app/paymentSuccess.html");
//   } catch (err) {
//     console.log("Success Error: " + err);
//     return res.status(500).send({
//       message: "An error occurred during the process",
//       success: false,
//     });
//   }
// });

// router.get("/failed", async (req, res) => {
//   try {
//     res.redirect("https://ai-calling-demo-otyj.vercel.app/paymentFailed.html");
//   } catch (err) {
//     console.log("failed Error" + err);
//   }
// });

// module.exports = router;









const { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY, EMAIL_USER,EMAIL_PASSWORD} = process.env;
const stripe = require("stripe")(STRIPE_SECRET_KEY);
const express = require("express");
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const User = require("../models/userModal");
const transactionSchema = require("../models/transactionSchema");
const router = express.Router();

// Configure Nodemailer transport
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASSWORD,
  },
});

// Send email function
const sendEmail = async (to, subject, text) => {
  try {
    await transporter.sendMail({
      from: `"AI Calling Service" <${EMAIL_USER}>`,
      to,
      subject,
      text,
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
};

// Route for manual payment
// router.post("/payment", async (req, res) => {
//   try {
//     const { userEmail, plan, amount, currency } = req.body;

//     if (!userEmail || !plan || !amount || !currency) {
//       return res.status(400).json({ message: "Missing required fields" });
//     }

//     const conversionRates = {
//       USD: 1,
//       INR: 75,
//       EUR: 0.9,
//       GBP: 0.75,
//       JPY: 110,
//       AUD: 1.3,
//     };
//     const convertedAmount = amount * conversionRates[currency];
    
//     const product = await stripe.products.create({
//       name: `${plan} Membership`,
//     });

//     const price = await stripe.prices.create({
//       product: product.id,
//       unit_amount: parseInt(convertedAmount * 100),
//       currency: currency.toLowerCase(),
//     });

//     if (price && price.id) {
//       const session = await stripe.checkout.sessions.create({
//         line_items: [
//           {
//             price: price.id,
//             quantity: 1,
//           },
//         ],
//         mode: "payment",
//         success_url: `https://aicalling-demo.onrender.com/api/auth/success/${userEmail}/${plan}/${amount}`,
//         cancel_url: "https://aicalling-demo.onrender.com/api/auth/failed",
//         customer_email: userEmail,
//       });

//       res.json({ url: session.url });
//     }
//   } catch (error) {
//     console.error("Error creating payment session:", error);
//     res.status(500).send("Error creating payment session.");
//   }
// });

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

    // Create the product and recurring price
    const product = await stripe.products.create({
      name: `${plan} Membership`,
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: parseInt(convertedAmount * 100),
      currency: currency.toLowerCase(),
      recurring: { interval: "month", interval_count: 1 },
    });

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `https://aicalling-demo.onrender.com/api/auth/success/${userEmail}/${plan}/${amount}`,
      cancel_url: "https://aicalling-demo.onrender.com/api/auth/failed",
      customer_email: userEmail,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating payment session:", error);
    res.status(500).send("Error creating payment session.");
  }
});

// Route for successful payment
// Route for successful payment
router.get("/success/:email/:payment/:amount", async (req, res) => {
  try {
    const { email, payment, amount } = req.params;
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
      date: new Date(),
    });

    user.transactions.push(newTransaction._id);
    user.lastPlan = { plan: payment, amount: amount };
    await user.save();

    // Send payment success email
    await sendEmail(email, "Payment Successful", `Your ${payment} subscription was successful. You have been credited with ${amount} credits.`);

    res.redirect("https://ai-calling-demo-otyj.vercel.app/paymentSuccess.html");
  } catch (err) {
    console.log("Success Error: " + err);
    return res.status(500).send({
      message: "An error occurred during the process",
      success: false,
    });
  }
})


// Route for failed payment
router.get("/failed", async (req, res) => {
  try {
    res.redirect("https://ai-calling-demo-otyj.vercel.app/paymentFailed.html");
  } catch (err) {
    console.log("failed Error" + err);
  }
});
//"* * * * *" ->> to check the every minutes for testtion 
// Schedule cron job for monthly subscription renewal

cron.schedule("0 0 1 * *", async () => {
  console.log("Running monthly subscription check");

  try {
    const users = await User.find({ "lastPlan.plan": { $exists: true } });

    for (const user of users) {
      const { plan, amount } = user.lastPlan;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            name: `${plan} Membership`,
            amount: amount * 100,
            currency: "usd",
            quantity: 1,
          },
        ],
        mode: "payment",
        customer_email: user.email,
        success_url: `https://aicalling-demo.onrender.com/api/auth/success/${user.email}/${plan}/${amount}`,
        cancel_url: "https://aicalling-demo.onrender.com/api/auth/failed",
      });

      console.log(`Created session for user ${user.email}: ${session.id}`);

      // Send subscription renewal email
      await sendEmail(user.email, "Subscription Renewal", "Your subscription has been successfully renewed.");
      console.log(`Renewal email sent to ${user.email}`);
    }
  } catch (error) {
    console.error("Error with monthly subscription:", error);
  }
});

module.exports = router;
