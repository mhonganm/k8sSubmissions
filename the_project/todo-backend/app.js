const express = require('express');
const cors = require('cors');
const app = express();

const PORT = process.env.TODO_BACKEND_PORT || 3002;

const TODO_MAX_LENGTH = parseInt(process.env.TODO_MAX_LENGTH || '140', 10);

app.use(cors());
app.use(express.json());

let todos = [
    { id: '1', text: 'Prepare presentation for demo' },
    { id: '2', text: 'Review Kubernetes manifests' }
];

app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

app.get('/api/todos', (req, res) => {
    console.log('[TODO-BACKEND] GET /api/todos request received');
    res.json(todos);
});

app.post('/api/todos', (req, res) => {
    const { text } = req.body;
    if (!text || text.trim() === '') {
        console.log('[TODO-BACKEND] POST /api/todos - Error: Text cannot be empty');
        return res.status(400).json({ error: 'Todo text cannot be empty' });
    }
    if (text.length > TODO_MAX_LENGTH) {
        console.log(`[TODO-BACKEND] POST /api/todos - Error: Text too long (max ${TODO_MAX_LENGTH} chars)`); // Updated log
        return res.status(400).json({ error: `Todo text too long, max ${TODO_MAX_LENGTH} characters` });
    }

    const newTodo = { id: String(todos.length + 1), text: text.trim() };
    todos.push(newTodo);
    console.log('[TODO-BACKEND] POST /api/todos - Added:', newTodo);
    res.status(201).json(newTodo);
});


app.delete('/api/todos/:id', (req, res) => {
    const { id } = req.params;
    const initialLength = todos.length;
    todos = todos.filter(todo => todo.id !== id);

    if (todos.length < initialLength) {
        console.log(`[TODO-BACKEND] DELETE /api/todos/${id} - Deleted successfully`);
        res.status(204).send();
    } else {
        console.log(`[TODO-BACKEND] DELETE /api/todos/${id} - Error: Todo not found`);
        res.status(404).json({ error: 'Todo not found' });
    }
});

app.listen(PORT, () => {
    console.log(`[TODO-BACKEND] Server running on port ${PORT}`);
    console.log(`[TODO-BACKEND] Initial todos:`, todos);
    console.log(`[TODO-BACKEND] Max todo length: ${TODO_MAX_LENGTH}`);
});
