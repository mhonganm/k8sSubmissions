const express = require('express');
const crypto = require('crypto'); // Built-in Node.js module for cryptography

const app = express();
const PORT = process.env.PORT || 3000; // Use PORT environment variable, default to 3000

// Generate a unique ID on application startup and store it in memory
const uniqueAppInstanceId = crypto.randomUUID();

// Function to log the unique ID with a timestamp (as per original requirement)
function logUniqueIdWithTimestamp() {
    const now = new Date();
    const timestamp = now.toISOString(); // e.g., 2025-06-26T12:15:17.705Z
    console.log(`${timestamp}: ${uniqueAppInstanceId}`);
}

// Start the periodic logging (every 5 seconds)
setInterval(logUniqueIdWithTimestamp, 5000);

// NEW: Endpoint to provide the current status
app.get('/status', (req, res) => {
  const now = new Date();
  const currentTimestamp = now.toISOString();
  res.json({
    uniqueId: uniqueAppInstanceId,
    timestamp: currentTimestamp,
    message: "This is the current status of the log-output application."
  });
});

// Optional: Basic root endpoint to confirm server is alive
app.get('/', (req, res) => {
    res.send('Log-output application is running. Try /status for current info.');
});

// Start the Express web server
app.listen(PORT, () => {
  console.log(`Server started in port ${PORT}`);
  console.log(`Application started. Unique ID generated: ${uniqueAppInstanceId}`);
});
