const { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY } = process.env;
const stripe = require('stripe')(STRIPE_SECRET_KEY)
const express = require("express");
const router = express.Router();


router.post("/payment", async (req, res) => {
    try {

      const { userEmail, amount, currency } = req.body;

      if (!userEmail || !amount || !currency) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const product = await stripe.products.create({ name: "Premium" });
  
      // console.log(product);
      if (product) {
        var price = await stripe.prices.create({
          product: `${product.id}`,
          unit_amount: parseInt(amount) * 100,
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
          mode: 'payment',
          success_url: "http://localhost:3000/api/auth/success",
          cancel_url: "http://localhost:3000/api/auth/failed",
          customer_email:  userEmail,
        });
      }
  
      res.json(session);
    } catch (error) {
      console.error("Error creating payment session:", error);
      res.status(500).send("Error creating payment session.");
    }
  });
  
  router.get("/success",async(req,res)=>{
    try {
        res.redirect('http://127.0.0.1:5501/client/dist/paymentSuccess.html');
    } catch (err) {
        console.log("Success Error"+ err);
    }
  })


  router.get("/failed",async(req,res)=>{
    try {
        res.redirect('http://127.0.0.1:5501/client/dist/paymentSuccess.html');
    } catch (err) {
        console.log("failed Error"+ err);
    }
  })



module.exports = router;