const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const csv = require('csv-parser');
const sgMail = require('@sendgrid/mail');

// Initialize Express app
const app = express();
app.use(bodyParser.json());

// Set SendGrid API Key
sgMail.setApiKey('YOUR_SENDGRID_API_KEY');

// Function to send email
function sendEmail(to, subject, text) {
  const msg = {
    to: to,
    from: 'your-email@example.com', // Your verified sender email address
    subject: subject,
    text: text,
  };

  sgMail
    .send(msg)
    .then(() => {
      console.log(`Email sent to ${to}`);
    })
    .catch((error) => {
      console.error(`Error sending email to ${to}:`, error);
    });
}

// Endpoint to handle bulk email sending from CSV
app.post('/send-bulk-emails', (req, res) => {
  const results = [];

  fs.createReadStream('path_to_your_csv_file.csv')
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      results.forEach((row) => {
        sendEmail(row.email, 'Your Subject Here', 'Your email content here');
      });
      res.status(200).send({ success: true, message: 'Emails sent successfully.' });
    })
    .on('error', (error) => {
      res.status(500).send({ success: false, message: error.message });
    });
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
