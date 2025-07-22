// broadcaster/app.js
const NATS = require('nats');
const fetch = require('node-fetch'); // For sending to external chat service

// Environment variables for NATS connection and external chat service
const NATS_SERVER_URL = process.env.NATS_SERVER_URL || 'nats://nats:4222';
const EXTERNAL_CHAT_WEBHOOK_URL = process.env.EXTERNAL_CHAT_WEBHOOK_URL;
const BROADCASTER_QUEUE_GROUP = process.env.BROADCASTER_QUEUE_GROUP || 'todo-broadcaster-group'; // Crucial for deduplication

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
        // Using a queue group ensures that when multiple broadcaster replicas are running,
        // each message is delivered to only one instance, preventing duplicate notifications.
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
        // Retry connection after a delay
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
 * Uses a generic JSON payload as requested.
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

// Start the NATS connection when the broadcaster application initializes
connectToNATS();

// Graceful shutdown handling
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
