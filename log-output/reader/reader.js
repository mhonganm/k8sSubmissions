const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const LOG_FILE_DIR = process.env.LOG_FILE_DIR || '/shared-logs';
const LOG_FILE_PATH = path.join(LOG_FILE_DIR, 'log.txt');

const PINGPONG_SHARED_VOLUME_PATH = process.env.PINGPONG_SHARED_VOLUME_PATH || '/mnt/shared-data';
const PINGPONG_COUNTER_FILE_PATH = path.join(PINGPONG_SHARED_VOLUME_PATH, 'ping-pong-counter.txt');

app.get('/status', async (req, res) => {
  let logFileContent = "Log file content not available.";
  let pingPongCounter = "0";

  try {
    logFileContent = await fs.readFile(LOG_FILE_PATH, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`[READER] Log file not found: ${LOG_FILE_PATH}`);
      logFileContent = "UUID log not yet generated.";
    } else {
      console.error(`[READER] Error reading log file: ${error.message}`);
      logFileContent = `Error reading UUID log: ${error.message}`;
    }
  }

  try {
    const counterData = await fs.readFile(PINGPONG_COUNTER_FILE_PATH, 'utf8');
    const parsedCounter = parseInt(counterData.trim(), 10);
    if (!isNaN(parsedCounter)) {
        pingPongCounter = parsedCounter;
    } else {
        console.warn(`[READER] Invalid ping-pong counter value in file. Content: "${counterData.trim()}"`);
        pingPongCounter = "Corrupted";
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`[READER] Ping-pong counter file not found: ${PINGPONG_COUNTER_FILE_PATH}`);
      pingPongCounter = "0 (ping-pong app not yet started/written)";
    } else {
      console.error(`[READER] Error reading ping-pong counter file: ${error.message}`);
      pingPongCounter = `Error (${error.message})`;
    }
  }


  const formattedLogLine = logFileContent.trim().split('\n').filter(line => line.length > 0).pop();

  const finalOutput = `${formattedLogLine}.Ping / Pongs: ${pingPongCounter}`;

  res.type('text/plain').send(finalOutput);
});


app.get('/', (req, res) => {
    res.send('Log-output Reader application is running. Try /status for combined info.');
});

app.listen(PORT, () => {
  console.log(`[READER] Server started in port ${PORT}`);
  console.log(`[READER] Reading log-output logs from: ${LOG_FILE_PATH}`);
  console.log(`[READER] Reading ping-pong counter from: ${PINGPONG_COUNTER_FILE_PATH}`);
});
