const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const SHARED_VOLUME_PATH = process.env.SHARED_VOLUME_PATH || '/mnt/shared-data';
const COUNTER_FILE_PATH = path.join(SHARED_VOLUME_PATH, 'ping-pong-counter.txt');

let counter = 0;


async function readCounterFromFile() {
    try {
        const data = await fs.readFile(COUNTER_FILE_PATH, 'utf8');
        const parsedCounter = parseInt(data.trim(), 10);
        if (!isNaN(parsedCounter)) {
            counter = parsedCounter;
            console.log(`[PING-PONG] Initialized counter from file: ${counter}`);
        } else {
            console.warn(`[PING-PONG] Invalid counter value in file, starting from 0. Content: "${data.trim()}"`);
            counter = 0;
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`[PING-PONG] Counter file not found at ${COUNTER_FILE_PATH}, starting from 0.`);
            counter = 0;
        } else {
            console.error(`[PING-PONG] Error reading counter file: ${error.message}, starting from 0.`);
            counter = 0;
        }
    }
}


async function writeCounterToFile() {
    try {
        await fs.mkdir(SHARED_VOLUME_PATH, { recursive: true });
        await fs.writeFile(COUNTER_FILE_PATH, counter.toString(), 'utf8');
        console.log(`[PING-PONG] Wrote counter ${counter} to ${COUNTER_FILE_PATH}`);
    } catch (error) {
        console.error(`[PING-PONG] Error writing counter to file: ${error.message}`);
    }
}


app.get('/pingpong', async (req, res) => {
  counter++;
  await writeCounterToFile();
  res.send(`pong ${counter}`);
  console.log(`[PING-PONG] Ping-pong counter: ${counter}`);
});


app.listen(PORT, async () => {
  console.log(`Ping-pong server started in port ${PORT}`);

  await readCounterFromFile();
  console.log(`[PING-PONG] Ready with current counter value: ${counter}`);
});
