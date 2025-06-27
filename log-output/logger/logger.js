const fs = require('fs').promises;
const crypto = require('crypto');
const path = require('path');


const LOG_FILE_DIR = process.env.LOG_FILE_DIR || '/shared-logs';
const LOG_FILE_PATH = path.join(LOG_FILE_DIR, 'log.txt');


const uniqueAppInstanceId = crypto.randomUUID();

async function ensureLogDirectory() {
    try {
        await fs.mkdir(LOG_FILE_DIR, { recursive: true });
        console.log(`Ensured log directory: ${LOG_FILE_DIR}`);
    } catch (error) {
        console.error(`Error ensuring log directory: ${error.message}`);
        process.exit(1);
    }
}


async function writeLogEntry() {
    const now = new Date();
    const timestamp = now.toISOString();
    const logEntry = `${timestamp}: ${uniqueAppInstanceId}\n`;

    try {
        await fs.appendFile(LOG_FILE_PATH, logEntry);
        console.log(`[LOGGER] Wrote: ${logEntry.trim()} to ${LOG_FILE_PATH}`);
    } catch (error) {
        console.error(`[LOGGER] Error writing to log file: ${error.message}`);
    }
}


async function startLogger() {
    await ensureLogDirectory();

    await writeLogEntry();

    setInterval(writeLogEntry, 5000);
    console.log(`[LOGGER] Started with unique ID: ${uniqueAppInstanceId}`);
    console.log(`[LOGGER] Logging to file: ${LOG_FILE_PATH} every 5 seconds.`);
}

startLogger();
