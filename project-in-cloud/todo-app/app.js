const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.TODO_APP_PORT || 3000;

const CURRENT_IMAGE_PATH = path.join(__dirname, 'image.jpg');
const CURRENT_IMAGE_METADATA_PATH = path.join(__dirname, 'image_metadata.json');

let currentImageMetadata = null;

const BACKEND_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:2345';

const IMAGE_BASE_URL = process.env.IMAGE_BASE_URL || 'https://placehold.co/';
const IMAGE_TEXT_PREFIX = process.env.IMAGE_TEXT_PREFIX || 'Image';
const IMAGE_FETCH_INTERVAL_MS = parseInt(process.env.IMAGE_FETCH_INTERVAL_MINUTES || '5', 10) * 60 * 1000;
const IMAGE_FETCH_TIMEOUT_MS = parseInt(process.env.IMAGE_FETCH_TIMEOUT_MS || '15000', 10);

const TODO_MAX_LENGTH = parseInt(process.env.TODO_MAX_LENGTH || '140', 10);
const APP_TITLE = process.env.APP_TITLE || 'Todo & Image App';

app.use(
    '/api',
    createProxyMiddleware({
        target: process.env.REACT_APP_BACKEND_URL || 'http://localhost:2345',
        changeOrigin: true,
        pathRewrite: {
            '^/api': '',
        },
        onProxyReq: (proxyReq, req, res) => {
            console.log(`[TODO-APP] Proxying request from ${req.originalUrl} to ${proxyReq.path}`);
        },
        onProxyRes: (proxyRes, req, res) => {
            console.log(`[TODO-APP] Proxy response for ${req.originalUrl} status: ${proxyRes.statusCode}`);
        },
        onError: (err, req, res) => {
            console.error(`[TODO-APP] Proxy error for ${req.originalUrl}:`, err);
        }
    })
);


async function loadMetadata() {
    try {
        const data = await fs.readFile(CURRENT_IMAGE_METADATA_PATH, 'utf8');
        currentImageMetadata = JSON.parse(data);
        console.log(`[TODO-APP] Loaded image metadata:`, currentImageMetadata);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[TODO-APP] No existing image metadata found. Will fetch new image.');
        } else {
            console.error(`[TODO-APP] Error loading image metadata: ${error.message}`);
        }
        currentImageMetadata = null;
    }
}

async function saveMetadata() {
    try {
        await fs.writeFile(CURRENT_IMAGE_METADATA_PATH, JSON.stringify(currentImageMetadata), 'utf8');
    } catch (error) {
        console.error(`[TODO-APP] Error saving image metadata: ${error.message}`);
    }
}

const agent = new https.Agent({
    rejectUnauthorized: false
});

async function fetchAndCacheImage() {
    console.log('[TODO-APP] Fetching new image...');
    try {
        const imageUrl = `${IMAGE_BASE_URL}1200x800.png?text=${encodeURIComponent(IMAGE_TEXT_PREFIX)}+${Date.now()}`;
        const response = await fetch(imageUrl, {
            agent: agent,
            timeout: IMAGE_FETCH_TIMEOUT_MS
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        const buffer = await response.buffer();
        await fs.writeFile(CURRENT_IMAGE_PATH, buffer);

        currentImageMetadata = {
            url: imageUrl,
            timestamp: Date.now(),
            gracePeriodUsed: false
        };
        await saveMetadata();
        console.log(`[TODO-APP] New image fetched and cached: ${currentImageMetadata.url}`);
        return true;
    } catch (error) {
        console.error(`[TODO-APP] Error fetching or caching image: ${error.message}`);
        console.error(`[TODO-APP] Full error object:`, error);
        return false;
    }
}


app.use('/image', async (req, res, next) => {
    try {
        if (!currentImageMetadata) {
            await loadMetadata();
        }
        if (!currentImageMetadata || !(await fs.access(CURRENT_IMAGE_PATH).then(() => true).catch(() => false))) {
            console.log("[TODO-APP] Image not yet cached. Attempting to fetch...");
            res.status(503).send('Image not yet available. Please try again shortly.');
            return;
        }
        res.sendFile(CURRENT_IMAGE_PATH);
    } catch (error) {
        console.error(`[TODO-APP] Error serving image: ${error.message}`);
        res.status(500).send('Error serving image.');
    }
});

function showMessage(message, type = 'info') {
    console.log(`[TODO-APP Message] Type: ${type}, Message: ${message}`);
}


app.get('/', (req, res) => {
    res.send(
        "<!DOCTYPE html>" +
        "<html lang=\"en\">" +
        "<head>" +
        "    <meta charset=\"UTF-8\">" +
        "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">" +
        "    <title>" + APP_TITLE + "</title>" +
        "    <style>" +
        "        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #f0f0f0; }" +
        "        img { max-width: 90%; height: auto; border: 2px solid #333; margin-bottom: 20px; }" +
        "        button { padding: 10px 20px; font-size: 16px; cursor: pointer; background-color: #007bff; color: white; border: none; border-radius: 5px; margin: 5px; }" +
        "        button:hover { background-color: #0056b3; }" +
        "        .status { margin-top: 10px; font-size: 0.9em; color: #555; }" +
        "        .todo-section { margin-top: 40px; text-align: center; }" +
        "        .todo-input { width: 300px; padding: 8px; margin-bottom: 10px; font-size: 1em; border: 1px solid #ccc; border-radius: 4px; }" +
        "        .todo-list { list-style: none; padding: 0; text-align: left; width: 350px; }" + // Adjusted width and list-style
        "        .todo-list li { " +
        "            background-color: #fff; border: 1px solid #eee; margin-bottom: 5px; padding: 10px; border-radius: 4px; " +
        "            display: flex; align-items: center; justify-content: space-between; " + // Added flexbox for layout
        "        }" +
        "        .todo-list li.todo-done .todo-text { text-decoration: line-through; color: #888; }" + // Style for done todos
        "        .todo-item-content { display: flex; align-items: center; flex-grow: 1; }" + // Container for checkbox and text
        "        .todo-checkbox { margin-right: 10px; transform: scale(1.2); width: 20px; height: 20px; background-color: #eee; border: 1px solid #ccc; vertical-align: middle; cursor: pointer; }" + // Style for checkbox + FIXES
        "        .todo-text { flex-grow: 1; word-break: break-word; }" + // Text span for strikethrough
        "        .delete-btn { " + // Style for delete button
        "            background-color: #dc3545; color: white; border: none; border-radius: 4px; " +
        "            padding: 5px 10px; margin-left: 10px; cursor: pointer; font-size: 0.9em;" +
        "        }" +
        "        .delete-btn:hover { background-color: #c82333; }" +
        "        /* Message Box Styles */" +
        "        .message-box {" +
        "            display: none; /* Hidden by default */" +
        "            position: fixed;" +
        "            top: 20px;" +
        "            left: 50%;" +
        "            transform: translateX(-50%);" +
        "            padding: 15px 25px;" +
        "            border-radius: 8px;" +
        "            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);" +
        "            z-index: 1000;" +
        "            font-size: 1.1em;" +
        "            color: white;" +
        "            background-color: #4CAF50; /* Default info color */" +
        "            opacity: 0.95;" +
        "            transition: opacity 0.3s ease-in-out;" +
        "        }" +
        "        .message-box.error { background-color: #f44336; }" +
        "        .message-box.warning { background-color: #ff9800; }" +
        "    </style>" +
        "</head>" +
        "<body>" +
        "    <div id=\"messageBox\" class=\"message-box\">" +
        "        <span id=\"messageText\"></span>" +
        "    </div>" +

        "    <h1>" + APP_TITLE + "</h1>" + // Use env var for H1
        "    <img id=\"randomImage\" src=\"/image\" alt=\"Random Image\">" +
        "    <button onclick=\"refreshImage()\">New Image</button>" +
        "    <p class=\"status\">Last fetched: <span id=\"lastFetched\">N/A</span></p>" +

        "    <div class=\"todo-section\">" +
        "        <h2>Your Todos</h2>" +
        "        <input type=\"text\" id=\"todoInput\" class=\"todo-input\" maxlength=\"" + TODO_MAX_LENGTH + "\" placeholder=\"Add a new todo (max " + TODO_MAX_LENGTH + " chars)\">" + // Use env var for maxlength
        "        <button id=\"addTodoButton\">Add Todo</button>" +
        "        <ul id=\"todoList\" class=\"todo-list\">" +
        "        </ul>" +
        "    </div>" +

        "    <script>" +
        "            console.log('[TODO-APP-CLIENT] Script block started!');" +        
        "        // Client-side JavaScript will use this URL to talk to the backend via proxy" +
        "        const TODO_BACKEND_JS_URL = '/api/todos';" + // Corrected to use proxy path
        "        const JS_TODO_MAX_LENGTH = " + TODO_MAX_LENGTH + ";" + // Pass max length to client-side JS

        "        function showMessage(message, type = 'info') {" +
        "            const messageBox = document.getElementById('messageBox');" +
        "            const messageText = document.getElementById('messageText');" +
        "            messageText.textContent = message;" +
        "            messageBox.className = 'message-box ' + type;" +
        "            messageBox.style.display = 'block';" +
        "            setTimeout(() => {" +
        "                messageBox.style.display = 'none';" +
        "            }, 3000);" +
        "        }" +

        "        function updateStatus() {" +
        "            if (window.currentImageMetadata && window.currentImageMetadata.timestamp) {" +
        "                const date = new Date(window.currentImageMetadata.timestamp);" +
        "                document.getElementById('lastFetched').textContent = date.toLocaleString();" +
        "            } else {" +
        "                document.getElementById('lastFetched').textContent = 'N/A';" +
        "            }" +
        "        }" +

        "        async function fetchMetadata() {" +
        "            try {" +
        "                const response = await fetch('/metadata');" +
        "                if (response.ok) {" +
        "                    window.currentImageMetadata = await response.json();" +
        "                    updateStatus();" +
        "                }" +
        "            } catch (error) {" +
        "                console.error('Error fetching metadata:', error);" +
        "            }" +
        "        }" +

        "        function refreshImage() {" +
        "            const img = document.getElementById('randomImage');" +
        "            img.src = '/image?' + new Date().getTime();" +
        "            setTimeout(fetchMetadata, 1000);" +
        "        }" +

        "        async function toggleTodoDone(todoId, currentDoneStatus) {" +
        "            try {" +
        "                const response = await fetch(TODO_BACKEND_JS_URL + '/' + todoId, {" +
        "                    method: 'PUT'," +
        "                    headers: {" +
        "                        'Content-Type': 'application/json'" +
        "                    }," +
        "                    body: JSON.stringify({ done: !currentDoneStatus })" +
        "                });" +

        "                if (!response.ok) {" +
        "                    const errorData = await response.json();" +
        "                    throw new Error(errorData.error || 'Failed to update todo status');" +
        "                }" +

        "                showMessage('Todo status updated!', 'info');" +
        "                await fetchAndRenderTodos();" +
        "            } catch (error) {" +
        "                console.error('Error updating todo status:', error);" +
        "                showMessage('Error updating todo status. Please check console.', 'error');" +
        "            }" +
        "        }" +

        "        async function deleteTodo(todoId) {" +
        "            if (!confirm('Are you sure you want to delete this todo?')) {" +
        "                return;" +
        "            }" +
        "            try {" +
        "                const response = await fetch(TODO_BACKEND_JS_URL + '/' + todoId, {" +
        "                    method: 'DELETE'" +
        "                });" +

        "                if (!response.ok) {" +
        "                    const errorData = await response.json();" +
        "                    throw new Error(errorData.error || 'Failed to delete todo');" +
        "                }" +

        "                showMessage('Todo deleted successfully!', 'info');" +
        "                await fetchAndRenderTodos();" +
        "            } catch (error) {" +
        "                console.error('Error deleting todo:', error);" +
        "                showMessage('Error deleting todo. Please check console.', 'error');" +
        "            }" +
        "        }" +

        "        async function fetchAndRenderTodos() {" +
        "            console.log('[TODO-APP-CLIENT] fetchAndRenderTodos() called.');" + // ADD THIS LINE
        "            try {" +
        "                const response = await fetch(TODO_BACKEND_JS_URL);" +
        "                if (!response.ok) {" +
        "                    throw new Error('Failed to fetch todos from backend');" +
        "                }" +
        "                const todos = await response.json();" +
        "                const todoListUl = document.getElementById('todoList');" +
        "                todoListUl.innerHTML = '';" + // Clear existing list

        "                todos.forEach(todo => {" +
        "                    const li = document.createElement('li');" +
        "                    li.setAttribute('data-id', todo.id);" + // Store todo ID on the li element

        "                    // Create checkbox" +
        "                    const checkbox = document.createElement('input');" +
        "                    checkbox.type = 'checkbox';" +
        "                    checkbox.className = 'todo-checkbox';" +
        "                    checkbox.checked = todo.done;" + // Set checked state based on todo.done
        "                    checkbox.addEventListener('change', () => toggleTodoDone(todo.id, todo.done));" + // Attach event listener

        "                    // Create span for todo text" +
        "                    const textSpan = document.createElement('span');" +
        "                    textSpan.className = 'todo-text';" +
        "                    textSpan.textContent = todo.text;" +

        "                    // Create delete button" +
        "                    const deleteButton = document.createElement('button');" +
        "                    deleteButton.textContent = 'Delete';" +
        "                    deleteButton.className = 'delete-btn';" +
        "                    deleteButton.addEventListener('click', () => deleteTodo(todo.id));" + // Attach event listener

        "                    // Append elements to li" +
        "                    const contentDiv = document.createElement('div');" +
        "                    contentDiv.className = 'todo-item-content';" +
        "                    contentDiv.appendChild(checkbox);" +
        "                    contentDiv.appendChild(textSpan);" +
        "                    li.appendChild(contentDiv);" +
        "                    li.appendChild(deleteButton);" +

        "                    // Apply 'todo-done' class if done" +
        "                    if (todo.done) {" +
        "                        li.classList.add('todo-done');" +
        "                    }" +

        "                    todoListUl.appendChild(li);" +
        "                });" +
        "            } catch (error) {" +
        "                console.error('Error fetching and rendering todos from backend:', error);" +
        "                showMessage('Error fetching todos. Please check console.', 'error');" +
        "            }" +
        "        }" +

        "        async function addTodo() {" +
        "            const todoInput = document.getElementById('todoInput');" +
        "            const todoText = todoInput.value.trim();" +

        "            if (todoText.length === 0) {" +
        "                showMessage('Todo cannot be empty!', 'warning');" +
        "                return;" +
        "            }" +
        "            if (todoText.length > JS_TODO_MAX_LENGTH) {" +
        "                showMessage('Todo is too long! Max ' + JS_TODO_MAX_LENGTH + ' characters.', 'warning');" +
        "                return;" +
        "            }" +

        "            try {" +
        "                const response = await fetch(TODO_BACKEND_JS_URL, {" +
        "                    method: 'POST'," +
        "                    headers: {" +
        "                        'Content-Type': 'application/json'" +
        "                    }," +
        "                    body: JSON.stringify({ text: todoText })" +
        "                });" +

        "                if (!response.ok) {" +
        "                    const errorData = await response.json();" +
        "                    throw new Error(errorData.error || 'Failed to add todo to backend');" +
        "                }" +

        "                todoInput.value = '';" +
        "                await fetchAndRenderTodos();" +
        "                console.log('Todo added successfully!');" +
        "                showMessage('Todo added successfully!', 'info');" +
        "            } catch (error) {" +
        "                console.error('Error adding todo to backend:', error);" +
        "                showMessage('Error adding todo to backend. Please check console.', 'error');" +
        "            }" +
        "        }" +

        "        document.addEventListener('DOMContentLoaded', () => {" +
        "            console.log('[TODO-APP-CLIENT] DOMContentLoaded event fired. Initiating fetches...');" + // ADD THIS LINE
        "            fetchMetadata();" +
        "            fetchAndRenderTodos();" +

        "            document.getElementById('addTodoButton').addEventListener('click', addTodo);" +

        "            document.getElementById('todoInput').addEventListener('keypress', (event) => {" +
        "                if (event.key === 'Enter') {" +
        "                    event.preventDefault();" +
        "                    addTodo();" +
        "                }" +
        "            });" +
        "        });" +

        "        setInterval(fetchMetadata, 30000);" +
        "    </script>" +
        "</body>" +
        "</html>"
    );
});

app.get('/metadata', (req, res) => {
    if (currentImageMetadata) {
        res.json(currentImageMetadata);
    } else {
        res.status(404).send('Metadata not available');
    }
});

async function checkAndFetchImage() {
    if (!currentImageMetadata || (Date.now() - currentImageMetadata.timestamp > IMAGE_FETCH_INTERVAL_MS)) {
        await fetchAndCacheImage();
    }
}

loadMetadata().then(() => {
    checkAndFetchImage();
    setInterval(checkAndFetchImage, IMAGE_FETCH_INTERVAL_MS);
});

app.listen(PORT, () => {
    console.log(`[TODO-APP] Server running on port ${PORT}`);
});