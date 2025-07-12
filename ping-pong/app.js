const express = require('express');
const { Pool } = require('pg');
const app = express();

const PORT = process.env.PORT || 3001;

const PG_HOST = process.env.PG_HOST || 'postgres-db-service';
const PG_USER = process.env.PG_USER || 'postgres';
const PG_PASSWORD = process.env.PG_PASSWORD || 'your_default_pg_password';
const PG_DATABASE = process.env.PG_DATABASE || 'pingpongdb';
const PG_PORT = process.env.PG_PORT || 5432;

const pool = new Pool({
  user: PG_USER,
  host: PG_HOST,
  database: PG_DATABASE,
  password: PG_PASSWORD,
  port: PG_PORT,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function initializeDatabase() {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS ping_pong_counter (
        id SERIAL PRIMARY KEY,
        count INTEGER DEFAULT 0
      );
    `);
    console.log('[PING-PONG] Database table "ping_pong_counter" ensured.');

    const result = await client.query('SELECT count FROM ping_pong_counter WHERE id = 1;');
    if (result.rows.length === 0) {
      await client.query('INSERT INTO ping_pong_counter (id, count) VALUES (1, 0);');
      console.log('[PING-PONG] Initial counter row inserted.');
    } else {
      console.log(`[PING-PONG] Existing counter found: ${result.rows[0].count}`);
    }
    client.release();
  } catch (err) {
    console.error('[PING-PONG] Error initializing database:', err.message);
    process.exit(1);
  }
}

app.get('/pingpong', async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query('BEGIN');
    const result = await client.query('SELECT count FROM ping_pong_counter WHERE id = 1 FOR UPDATE;');
    let currentCount = result.rows[0].count;
    currentCount++;
    await client.query('UPDATE ping_pong_counter SET count = $1 WHERE id = 1;', [currentCount]);
    await client.query('COMMIT');
    client.release();

    res.send(`pong ${currentCount}`);
    console.log(`[PING-PONG] Ping-pong counter incremented to: ${currentCount}`);
  } catch (err) {
    console.error('[PING-PONG] Error processing /pingpong:', err.message);
    res.status(500).send('Error processing pingpong request.');
  }
});

app.get('/pong-count', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT count FROM ping_pong_counter WHERE id = 1;');
    const currentCount = result.rows.length > 0 ? result.rows[0].count : 0;
    client.release();

    res.json({ pongCount: currentCount });
    console.log(`[PING-PONG] Exposed pong count: ${currentCount}`);
  } catch (err) {
    console.error('[PING-PONG] Error fetching /pong-count:', err.message);
    res.status(500).json({ error: 'Error fetching pong count.' });
  }
});


app.get('/', (req, res) => {
  res.status(200).send('OK - Ping-Pong Health Check');
  console.log('[PING-PONG] Responded to root path health check.');
});


app.listen(PORT, async () => {
  console.log(`Ping-pong server started in port ${PORT}`);
  await initializeDatabase();
  console.log(`[PING-PONG] Ready to serve requests.`);
});

process.on('SIGTERM', async () => {
  console.log('[PING-PONG] SIGTERM received, closing database pool.');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[PING-PONG] SIGINT received, closing database pool.');
  await pool.end();
  process.exit(0);
});