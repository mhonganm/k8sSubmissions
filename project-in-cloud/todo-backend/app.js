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

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todos' AND column_name='done') THEN
          ALTER TABLE todos ADD COLUMN done BOOLEAN DEFAULT FALSE;
          -- You might want to update existing rows to set 'done' to false,
          -- or leave them as default if that's acceptable.
          -- For new installations, DEFAULT FALSE ensures consistency.
          -- If you have existing data and want 'done' to be true for some,
          -- you'd need a separate migration script or manual update.
          UPDATE todos SET done = FALSE WHERE done IS NULL;
        END IF;
      END
      $$;
    `);
    console.log('[TODO-BACKEND] Database column "done" ensured in "todos" table.');
    client.release();
  } catch (err) {
    console.error('[TODO-BACKEND] Error initializing database:', err.message);
    process.exit(1);
  }
}

app.use(cors());
app.use(express.json());


app.use((req, res, next) => {
    const start = process.hrtime();
    res.on('finish', () => {
        const duration = process.hrtime(start);
        const durationMs = (duration[0] * 1000 + duration[1] / 1e6).toFixed(2);
        const logEntry = {
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: parseFloat(durationMs),
            ip: req.ip,
            userAgent: req.get('User-Agent') || 'unknown'
        };

        if (req.originalUrl.startsWith('/api/todos')) {
            if (req.method === 'POST') {
                logEntry.body = req.body.text ? req.body.text.substring(0, 200) + (req.body.text.length > 200 ? '...' : '') : ''; // Log first 200 chars of todo text
            }
            if (req.method === 'PUT') {
                logEntry.body = JSON.stringify(req.body).substring(0, 200) + (JSON.stringify(req.body).length > 200 ? '...' : '');
            }
            console.log(`[TODO-BACKEND] Request Log: ${JSON.stringify(logEntry)}`);
        } else {
            console.log(`[TODO-BACKEND] Access Log: ${JSON.stringify({
                timestamp: logEntry.timestamp,
                method: logEntry.method,
                url: logEntry.url,
                statusCode: logEntry.statusCode,
                durationMs: logEntry.durationMs
            })}`);
        }
    });
    next();
});


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
        const result = await client.query('SELECT id, text, done FROM todos ORDER BY id ASC;');
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
        console.error(`[TODO-BACKEND] Validation Error: Empty todo text from IP: ${req.ip}`);
        return res.status(400).json({ error: 'Todo text cannot be empty' });
    }
    if (text.length > TODO_MAX_LENGTH) {
        console.log(`[TODO-BACKEND] POST /api/todos - Error: Text too long (max ${TODO_MAX_LENGTH} chars)`);
        console.error(`[TODO-BACKEND] Validation Error: Todo text too long from IP: ${req.ip}, Length: ${text.length}, Max: ${TODO_MAX_LENGTH}`);
        return res.status(400).json({ error: `Todo text too long, max ${TODO_MAX_LENGTH} characters` });
    }

    try {
        const client = await pool.connect();
        const result = await client.query('INSERT INTO todos (text) VALUES ($1) RETURNING id, text, done;', [text.trim()]);
        client.release();
        const newTodo = result.rows[0];
        console.log('[TODO-BACKEND] POST /api/todos - Added:', newTodo);
        console.log(`[TODO-BACKEND] Todo Added Successfully: id=${newTodo.id}, text="${newTodo.text}"`);
        res.status(201).json(newTodo);
    } catch (err) {
        console.error('[TODO-BACKEND] Error adding todo to database:', err.message);
        res.status(500).json({ error: 'Error adding todo.' });
    }
});


app.put('/api/todos/:id', async (req, res) => {
    const { id } = req.params;
    const { text, done } = req.body; 

    if (text === undefined && done === undefined) {
        return res.status(400).json({ error: 'At least "text" or "done" field must be provided for update.' });
    }


    const updateClauses = [];
    const queryParams = [];
    let paramIndex = 1;

    if (text !== undefined) {
        if (text === null || text.trim() === '') {
            return res.status(400).json({ error: 'Todo text cannot be empty.' });
        }
        if (text.length > TODO_MAX_LENGTH) {
            return res.status(400).json({ error: `Todo text too long, max ${TODO_MAX_LENGTH} characters.` });
        }
        updateClauses.push(`text = $${paramIndex++}`);
        queryParams.push(text.trim());
    }

    if (done !== undefined) {
        if (typeof done !== 'boolean') {
            return res.status(400).json({ error: '"done" field must be a boolean.' });
        }
        updateClauses.push(`done = $${paramIndex++}`);
        queryParams.push(done);
    }

    if (updateClauses.length === 0) {
        return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

  
    queryParams.push(id);

    try {
        const client = await pool.connect();
        const updateQuery = `UPDATE todos SET ${updateClauses.join(', ')} WHERE id = $${paramIndex} RETURNING id, text, done;`;
        console.log(`[TODO-BACKEND] PUT /api/todos/${id} - Executing query: ${updateQuery}`);
        console.log(`[TODO-BACKEND] PUT /api/todos/${id} - Query params: ${JSON.stringify(queryParams)}`);

        const result = await client.query(updateQuery, queryParams);
        client.release();

        if (result.rowCount > 0) {
            const updatedTodo = result.rows[0];
            console.log(`[TODO-BACKEND] PUT /api/todos/${id} - Updated successfully:`, updatedTodo);
            console.log(`[TODO-BACKEND] Todo Updated Successfully: id=${updatedTodo.id}`);
            res.json(updatedTodo);
        } else {
            console.log(`[TODO-BACKEND] PUT /api/todos/${id} - Error: Todo not found`);
            console.error(`[TODO-BACKEND] Update Error: Todo id=${id} not found.`);
            res.status(404).json({ error: 'Todo not found' });
        }
    } catch (err) {
        console.error(`[TODO-BACKEND] Error updating todo id=${id} in database:`, err.message);
        res.status(500).json({ error: 'Error updating todo.' });
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
            console.log(`[TODO-BACKEND] Todo Deleted Successfully: id=${id}`);
            res.status(204).send();
        } else {
            console.log(`[TODO-BACKEND] DELETE /api/todos/${id} - Error: Todo not found`);
            console.error(`[TODO-BACKEND] Deletion Error: Todo id=${id} not found.`);
            res.status(404).json({ error: 'Todo not found' });
        }
    } catch (err) {
        console.error('[TODO-BACKEND] Error deleting todo from database:', err.message);
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