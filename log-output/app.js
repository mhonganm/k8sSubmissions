const crypto = require('crypto'); // Built-in Node.js module for cryptography

// Generate the UUID on application startup
const uniqueId = crypto.randomUUID();

console.log(`Application started. Unique ID generated: ${uniqueId}`);

// Function to print the ID with a formatted timestamp
function printIdWithTimestamp() {
    // Get current date and time
    const now = new Date();

    // Format the timestamp to YYYY-MM-DDTHH:mm:ss.sssZ
    // toISOString() provides a good starting point, we just need to remove the trailing 'Z'
    // and then add it back to match the example exactly, if needed.
    // The example uses Z for UTC, which toISOString() provides.
    const timestamp = now.toISOString(); 
    
    // Output in the exact format: 2020-03-30T12:15:17.705Z: 8523ecb1-c716-4cb6-a044-b9e83bb98e43
    console.log(`${timestamp}: ${uniqueId}`);
}

// Set an interval to call the function every 5 seconds (5000 milliseconds)
setInterval(printIdWithTimestamp, 5000);

