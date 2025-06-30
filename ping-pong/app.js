const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

let counter = 0;

app.get('/pingpong', async (req, res) => {
  counter++;
  res.send(`pong ${counter}`);
  console.log(`[PING-PONG] Ping-pong counter: ${counter}`);
});

app.get('/pong-count', (req, res) => {
  res.json({ pongCount: counter });
  console.log(`[PING-PONG] Exposed pong count: ${counter}`);
});

app.listen(PORT, async () => {
  console.log(`Ping-pong server started in port ${PORT}`);
  console.log(`[PING-PONG] Ready with current counter value: ${counter}`);
});
