const NATS = require('nats');
const fetch = require('node-fetch');
const express = require('express'); // ADDED: Express for health checks

const app = express(); // ADDED: Initialize Express app

// Environment variables for NATS connection and external chat service
const NATS_SERVER_URL = process.env.NATS_SERVER_URL || 'nats://my-nats.default:4222'; // Corrected NATS URL
const EXTERNAL_CHAT_WEBHOOK_URL = process.env.EXTERNAL_CHAT_WEBHOOK_URL;
const BROADCASTER_QUEUE_GROUP = process.env.BROADCASTER_QUEUE_GROUP || 'todo-broadcaster-group';

const HEALTH_PORT = process.env.HEALTH_PORT || 3000; // Port for health checks

let nc; // NATS Connection instance

/**
 * Establishes a connection to the NATS server and sets up event listeners.
 * Includes a retry mechanism for connection failures.
 */
async function connectToNATS() {
    try {
        nc = await NATS.connect({ servers: [NATS_SERVER_URL] });
        console.log(`[BROADCASTER] Connected to NATS at ${NATS_SERVER_URL}`);

        // Subscribe to the 'todos.status' topic with a queue group
        nc.subscribe('todos.status', { queue: BROADCASTER_QUEUE_GROUP }, (msg, reply, subject) => {
            console.log(`[BROADCASTER] Received message on '${subject}' (Queue Group: ${BROADCASTER_QUEUE_GROUP}): ${msg}`);
            processNATSMessage(msg);
        });

        console.log(`[BROADCASTER] Subscribed to 'todos.status' with queue group '${BROADCASTER_QUEUE_GROUP}'`);

        // NATS connection event listeners for robustness and logging
        nc.on('error', (err) => {
            console.error(`[BROADCASTER] NATS connection error:`, err);
        });
        nc.on('disconnect', () => {
            console.warn('[BROADCASTER] NATS disconnected. Attempting to reconnect...');
        });
        nc.on('reconnecting', () => {
            console.info('[BROADCASTER] NATS reconnecting...');
        });
        nc.on('reconnected', () => {
            console.info('[BROADCASTER] NATS reconnected!');
        });
        nc.on('close', () => {
            console.log('[BROADCASTER] NATS connection closed.');
        });

    } catch (err) {
        console.error(`[BROADCASTER] Error connecting to NATS:`, err.message);
        setTimeout(connectToNATS, 5000); // Retry after 5 seconds
    }
}

/**
 * Processes a received NATS message, parses it, and formats it for the chat service.
 * @param {string} messageString The raw message string received from NATS.
 */
async function processNATSMessage(messageString) {
    try {
        const message = JSON.parse(messageString);
        let chatMessage = '';

        // Format the message based on the action type
        switch (message.action) {
            case 'created':
                chatMessage = `📝 New todo created: "${message.todo.text}" (ID: ${message.todo.id})`;
                break;
            case 'updated':
                chatMessage = `✏️ Todo updated: "${message.todo.text}" (ID: ${message.todo.id}). Status: ${message.todo.done ? 'Done' : 'Pending'}`;
                break;
            case 'deleted':
                chatMessage = `🗑️ Todo deleted: (ID: ${message.todoId})`;
                break;
            default:
                chatMessage = `Unhandled todo action: ${JSON.stringify(message)}`;
        }

        // Send the formatted message to the external chat service
        await sendToExternalChat(chatMessage);

    } catch (error) {
        console.error('[BROADCASTER] Error processing NATS message:', error);
    }
}

/**
 * Sends a message to the configured external chat webhook URL.
 * Uses a generic JSON payload as specified in instructions.
 * @param {string} message The message string to send.
 */
async function sendToExternalChat(message) {
    if (!EXTERNAL_CHAT_WEBHOOK_URL) {
        console.warn('[BROADCASTER] EXTERNAL_CHAT_WEBHOOK_URL is not set. Skipping sending message.');
        return;
    }

    // Generic webhook payload as specified in instructions
    const payload = {
        user: 'TodoBot',
        message: message
    };

    try {
        const response = await fetch(EXTERNAL_CHAT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to send message to external chat (Generic Webhook): ${response.status} - ${errorText}`);
        }
        console.log(`[BROADCASTER] Message sent to Generic Webhook successfully.`);
    } catch (error) {
        console.error(`[BROADCASTER] Error sending message to external chat (Generic Webhook):`, error);
    }
}

// ADDED: Health check endpoint for Kubernetes probes
app.get('/healthz', (req, res) => {
    // You could add more sophisticated checks here, e.g., NATS connection status
    if (nc && nc.connected) { // NATS 1.x has a 'connected' property
        res.status(200).send('OK');
    } else {
        res.status(500).send('NATS not connected');
    }
});

// ADDED: Start the Express server for health checks
app.listen(HEALTH_PORT, () => {
    console.log(`[BROADCASTER] Health check server listening on port ${HEALTH_PORT}`);
});

// Start the NATS connection when the broadcaster application initializes
connectToNATS();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[BROADCASTER] SIGTERM received, closing NATS connection.');
    if (nc) {
        await nc.close();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[BROADCASTER] SIGINT received, closing NATS connection.');
    if (nc) {
        await nc.close();
    }
    process.exit(0);
});