require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const apiRoutes = require('./routes/api');
const sendMessageRoutes = require('./routes/send-message');
const googleCalendar = require('./routes/calendar');


const callLogsRoutes = require('./routes/callLogs'); 
const connectDb=require("./utils/db");
const router=require("./routes/userRoute.js");
const authMiddleware = require('./middlewares/authMiddleware');
const paymentRoute=require("./routes/paymentRoute.js");
const flashMiddleWare=require("./middlewares/flashMiddleware.js");


const app = express();
 const PORT = process.env.PORT || 3000;

// MongoDB connection

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(cors());


//flash message 
app.use(flashMiddleWare);


// Routes
app.use('/api/auth',router);
app.use('/api', apiRoutes);
app.use('/api/messages', sendMessageRoutes); 
app.use('/calendar', googleCalendar);
app.use('/imf', callLogsRoutes); // Add this line
app.use('/api/auth',paymentRoute);





// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

connectDb().then(()=>{
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
})
