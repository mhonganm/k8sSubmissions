const express = require('express');
const app = express();

// Use PORT environment variable, default to 3000 if not set
const PORT = process.env.PORT || 3000; 

// Basic route for the web server
app.get('/', (req, res) => {
  // Respond with a simple HTML page
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Todo App</title>
        <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f0f0; color: #333; }
            .container { text-align: center; padding: 20px; border-radius: 8px; background-color: #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #007bff; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Hello from the Todo App Web Server!</h1>
            <p>This is a simple HTML response.</p>
            <p>Server running on port ${PORT}.</p>
        </div>
    </body>
    </html>
  `);
});

// Start the Express web server
app.listen(PORT, () => {
  console.log(`Server started in port ${PORT}`); // Output as required
});
