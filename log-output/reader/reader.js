const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000; 

const LOG_FILE_DIR = process.env.LOG_FILE_DIR || '/shared-logs';
const LOG_FILE_PATH = path.join(LOG_FILE_DIR, 'log.txt');

app.get('/status', async (req, res) => {
  try {
    const fileContent = await fs.readFile(LOG_FILE_PATH, 'utf8');
    res.type('text/plain').send(fileContent);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).send(`Log file not found at ${LOG_FILE_PATH}. Logger might not have started yet or written anything.`);
    } else {
      console.error(`[READER] Error reading log file: ${error.message}`);
      res.status(500).send(`Error reading log file: ${error.message}`);
    }
  }
});


app.get('/', (req, res) => {
    res.send('Log-output Reader application is running. Try /status for log info.');
});

app.listen(PORT, () => {
  console.log(`[READER] Server started in port ${PORT}`);
  console.log(`[READER] Will read logs from: ${LOG_FILE_PATH}`);
});
