const express = require('express');
const app = express();

const PORT = process.env.PORT || 3002;
const GREETING_VERSION = process.env.GREETING_VERSION || 'v1';
const GREETING_MESSAGE = process.env.GREETING_MESSAGE || 'Hello from Greeter';

app.get('/', (req, res) => {
    const greeting = `${GREETING_MESSAGE} (version: ${GREETING_VERSION})`;
    console.log(`[GREETER-${GREETING_VERSION}] Sending greeting: "${greeting}"`);
    res.send(greeting);
});

app.listen(PORT, () => {
    console.log(`[GREETER-${GREETING_VERSION}] Server started on port ${PORT}`);
});