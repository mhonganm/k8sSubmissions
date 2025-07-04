const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.TODO_APP_PORT || 3000;

const CURRENT_IMAGE_PATH = path.join(__dirname, 'image.jpg');
const CURRENT_IMAGE_METADATA_PATH = path.join(__dirname, 'image_metadata.json');

let currentImageMetadata = null;

const TODO_BACKEND_SERVICE_URL = process.env.TODO_BACKEND_URL_PATH;

const IMAGE_BASE_URL = process.env.IMAGE_BASE_URL || 'https://placehold.co/';
const IMAGE_TEXT_PREFIX = process.env.IMAGE_TEXT_PREFIX || 'Image';
const IMAGE_FETCH_INTERVAL_MS = parseInt(process.env.IMAGE_FETCH_INTERVAL_MINUTES || '5', 10) * 60 * 1000;
const IMAGE_FETCH_TIMEOUT_MS = parseInt(process.env.IMAGE_FETCH_TIMEOUT_MS || '15000', 10);

const TODO_MAX_LENGTH = parseInt(process.env.TODO_MAX_LENGTH || '140', 10);
const APP_TITLE = process.env.APP_TITLE || 'Todo & Image App';


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
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${APP_TITLE}</title> <!-- Use env var for title -->
            <style>
                body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #f0f0f0; }
                img { max-width: 90%; height: auto; border: 2px solid #333; margin-bottom: 20px; }
                button { padding: 10px 20px; font-size: 16px; cursor: pointer; background-color: #007bff; color: white; border: none; border-radius: 5px; margin: 5px; }
                button:hover { background-color: #0056b3; }
                .status { margin-top: 10px; font-size: 0.9em; color: #555; }
                .todo-section { margin-top: 40px; text-align: center; }
                .todo-input { width: 300px; padding: 8px; margin-bottom: 10px; font-size: 1em; border: 1px solid #ccc; border-radius: 4px; }
                .todo-list { list-style: inside; padding: 0; text-align: left; }
                .todo-list li { background-color: #fff; border: 1px solid #eee; margin-bottom: 5px; padding: 10px; border-radius: 4px; }
                /* Message Box Styles */
                .message-box {
                    display: none; /* Hidden by default */
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    padding: 15px 25px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    z-index: 1000;
                    font-size: 1.1em;
                    color: white;
                    background-color: #4CAF50; /* Default info color */
                    opacity: 0.95;
                    transition: opacity 0.3s ease-in-out;
                }
                .message-box.error { background-color: #f44336; }
                .message-box.warning { background-color: #ff9800; }
            </style>
        </head>
        <body>
            <div id="messageBox" class="message-box">
                <span id="messageText"></span>
            </div>

            <h1>${APP_TITLE}</h1> <!-- Use env var for H1 -->
            <img id="randomImage" src="/image" alt="Random Image">
            <button onclick="refreshImage()">New Image</button>
            <p class="status">Last fetched: <span id="lastFetched">N/A</span></p>

            <div class="todo-section">
                <h2>Your Todos</h2>
                <input type="text" id="todoInput" class="todo-input" maxlength="${TODO_MAX_LENGTH}" placeholder="Add a new todo (max ${TODO_MAX_LENGTH} chars)"> <!-- Use env var for maxlength -->
                <button id="addTodoButton">Add Todo</button>
                <ul id="todoList" class="todo-list">
                </ul>
            </div>

            <script>
                // Node.js will inject the URL here
                const TODO_BACKEND_JS_URL = '${TODO_BACKEND_SERVICE_URL}';
                const JS_TODO_MAX_LENGTH = ${TODO_MAX_LENGTH}; // Pass max length to client-side JS

                // Custom message box functions (client-side implementation)
                function showMessage(message, type = 'info') {
                    const messageBox = document.getElementById('messageBox');
                    const messageText = document.getElementById('messageText');
                    messageText.textContent = message;
                    messageBox.className = 'message-box ' + type; // Using concatenation for VS Code
                    messageBox.style.display = 'block';
                    setTimeout(() => {
                        messageBox.style.display = 'none';
                    }, 3000);
                }

                function updateStatus() {
                    if (window.currentImageMetadata && window.currentImageMetadata.timestamp) {
                        const date = new Date(window.currentImageMetadata.timestamp);
                        document.getElementById('lastFetched').textContent = date.toLocaleString();
                    } else {
                        document.getElementById('lastFetched').textContent = 'N/A';
                    }
                }

                async function fetchMetadata() {
                    try {
                        const response = await fetch('/metadata');
                        if (response.ok) {
                            window.currentImageMetadata = await response.json();
                            updateStatus();
                        }
                    } catch (error) {
                        console.error("Error fetching metadata:", error);
                    }
                }

                function refreshImage() {
                    const img = document.getElementById('randomImage');
                    img.src = '/image?' + new Date().getTime();
                    setTimeout(fetchMetadata, 1000);
                }

                async function fetchAndRenderTodos() {
                    try {
                        const response = await fetch(TODO_BACKEND_JS_URL);
                        if (!response.ok) {
                            throw new Error('Failed to fetch todos from backend');
                        }
                        const todos = await response.json();
                        const todoListUl = document.getElementById('todoList');
                        todoListUl.innerHTML = '';
                        todos.forEach(todo => {
                            const li = document.createElement('li');
                            li.textContent = todo.text;
                            todoListUl.appendChild(li);
                        });
                    } catch (error) {
                        console.error('Error fetching and rendering todos from backend:', error);
                    }
                }

                async function addTodo() {
                    const todoInput = document.getElementById('todoInput');
                    const todoText = todoInput.value.trim();

                    if (todoText.length === 0) {
                        showMessage('Todo cannot be empty!', 'warning'); // Use custom message
                        return;
                    }
                    if (todoText.length > JS_TODO_MAX_LENGTH) { // Use client-side JS variable
                        showMessage('Todo is too long! Max ' + JS_TODO_MAX_LENGTH + ' characters.', 'warning'); // Use custom message
                        return;
                    }

                    try {
                        const response = await fetch(TODO_BACKEND_JS_URL, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ text: todoText })
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to add todo to backend');
                        }

                        todoInput.value = '';
                        await fetchAndRenderTodos();
                        console.log('Todo added successfully!');
                        showMessage('Todo added successfully!', 'info'); // Success message
                    } catch (error) {
                        console.error('Error adding todo to backend:', error);
                        showMessage('Error adding todo to backend. Please check console.', 'error'); // Error message
                    }
                }

                document.addEventListener('DOMContentLoaded', () => {
                    fetchMetadata();
                    fetchAndRenderTodos();

                    document.getElementById('addTodoButton').addEventListener('click', addTodo);

                    document.getElementById('todoInput').addEventListener('keypress', (event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            addTodo();
                        }
                    });
                });

                setInterval(fetchMetadata, 30000);
            </script>
        </body>
        </html>
    `);
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