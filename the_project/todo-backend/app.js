const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();

const PORT = process.env.TODO_BACKEND_PORT || 3002;
const TODO_MAX_LENGTH = parseInt(process.env.TODO_MAX_LENGTH || '140', 10);

const PG_HOST = process.env.TODO_PG_HOST || 'todo-postgres-db-service';
const PG_USER = process.env.TODO_PG_USER || 'todouser';
const PG_PASSWORD = process.env.TODO_PG_PASSWORD || 'your_default_todo_pg_password';
const PG_DATABASE = process.env.TODO_PG_DATABASE || 'tododb';
const PG_PORT = process.env.TODO_PG_PORT || 5432;


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
      CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        text VARCHAR(${TODO_MAX_LENGTH}) NOT NULL
      );
    `);
    console.log('[TODO-BACKEND] Database table "todos" ensured.');
    client.release();
  } catch (err) {
    console.error('[TODO-BACKEND] Error initializing database:', err.message);
    process.exit(1);
  }
}

app.use(cors());
app.use(express.json());

app.get('/healthz', async (req, res) => {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        res.status(200).send('OK');
    } catch (error) {
        console.error('[TODO-BACKEND] Health check failed:', error.message);
        res.status(500).send('Database connection failed');
    }
});

app.get('/api/todos', async (req, res) => {
    console.log('[TODO-BACKEND] GET /api/todos request received');
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT id, text FROM todos ORDER BY id ASC;');
        client.release();
        res.json(result.rows);
    } catch (err) {
        console.error('[TODO-BACKEND] Error fetching todos:', err.message);
        res.status(500).json({ error: 'Error fetching todos.' });
    }
});

app.post('/api/todos', async (req, res) => {
    const { text } = req.body;
    if (!text || text.trim() === '') {
        console.log('[TODO-BACKEND] POST /api/todos - Error: Text cannot be empty');
        return res.status(400).json({ error: 'Todo text cannot be empty' });
    }
    if (text.length > TODO_MAX_LENGTH) {
        console.log(`[TODO-BACKEND] POST /api/todos - Error: Text too long (max ${TODO_MAX_LENGTH} chars)`);
        return res.status(400).json({ error: `Todo text too long, max ${TODO_MAX_LENGTH} characters` });
    }

    try {
        const client = await pool.connect();
        const result = await client.query('INSERT INTO todos (text) VALUES ($1) RETURNING id, text;', [text.trim()]);
        client.release();
        const newTodo = result.rows[0];
        console.log('[TODO-BACKEND] POST /api/todos - Added:', newTodo);
        res.status(201).json(newTodo);
    } catch (err) {
        console.error('[TODO-BACKEND] Error adding todo:', err.message);
        res.status(500).json({ error: 'Error adding todo.' });
    }
});


app.delete('/api/todos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const client = await pool.connect();
        const result = await client.query('DELETE FROM todos WHERE id = $1;', [id]);
        client.release();

        if (result.rowCount > 0) {
            console.log(`[TODO-BACKEND] DELETE /api/todos/${id} - Deleted successfully`);
            res.status(204).send();
        } else {
            console.log(`[TODO-BACKEND] DELETE /api/todos/${id} - Error: Todo not found`);
            res.status(404).json({ error: 'Todo not found' });
        }
    } catch (err) {
        console.error('[TODO-BACKEND] Error deleting todo:', err.message);
        res.status(500).json({ error: 'Error deleting todo.' });
    }
});

app.listen(PORT, async () => {
    console.log(`[TODO-BACKEND] Server running on port ${PORT}`);
    console.log(`[TODO-BACKEND] Max todo length: ${TODO_MAX_LENGTH}`);
    await initializeDatabase();
    console.log(`[TODO-BACKEND] Ready to serve requests.`);
});

process.on('SIGTERM', async () => {
  console.log('[TODO-BACKEND] SIGTERM received, closing database pool.');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[TODO-BACKEND] SIGINT received, closing database pool.');
  await pool.end();
  process.exit(0);
});
