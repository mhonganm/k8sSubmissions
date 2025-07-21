console.log('[TODO-APP-CLIENT] Script block started!');

// Client-side JavaScript will use this URL to talk to the backend via proxy
const TODO_BACKEND_JS_URL = '/api/todos'; // Corrected to use proxy path
const JS_TODO_MAX_LENGTH = 140; // This will be set by the server-side environment variable

function showMessage(message, type = 'info') {
    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');
    messageText.textContent = message;
    messageBox.className = 'message-box ' + type;
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
        console.error('Error fetching metadata:', error);
    }
}

function refreshImage() {
    const img = document.getElementById('randomImage');
    img.src = '/image?' + new Date().getTime();
    setTimeout(fetchMetadata, 1000);
}

async function toggleTodoDone(todoId, currentDoneStatus) {
    try {
        const response = await fetch(TODO_BACKEND_JS_URL + '/' + todoId, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ done: !currentDoneStatus })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update todo status');
        }

        showMessage('Todo status updated!', 'info');
        await fetchAndRenderTodos();
    } catch (error) {
        console.error('Error updating todo status:', error);
        showMessage('Error updating todo status. Please check console.', 'error');
    }
}

async function deleteTodo(todoId) {
    if (!confirm('Are you sure you want to delete this todo?')) {
        return;
    }
    try {
        const response = await fetch(TODO_BACKEND_JS_URL + '/' + todoId, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete todo');
        }

        showMessage('Todo deleted successfully!', 'info');
        await fetchAndRenderTodos();
    } catch (error) {
        console.error('Error deleting todo:', error);
        showMessage('Error deleting todo. Please check console.', 'error');
    }
}

async function fetchAndRenderTodos() {
    console.log('[TODO-APP-CLIENT] fetchAndRenderTodos() called.');
    try {
        const response = await fetch(TODO_BACKEND_JS_URL);
        if (!response.ok) {
            throw new Error('Failed to fetch todos from backend');
        }
        const todos = await response.json();
        const todoListUl = document.getElementById('todoList');
        todoListUl.innerHTML = ''; // Clear existing list

        todos.forEach(todo => {
            const li = document.createElement('li');
            li.setAttribute('data-id', todo.id); // Store todo ID on the li element

            // Create checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'todo-checkbox';
            checkbox.checked = todo.done; // Set checked state based on todo.done
            checkbox.addEventListener('change', () => toggleTodoDone(todo.id, todo.done)); // Attach event listener

            // Create span for todo text
            const textSpan = document.createElement('span');
            textSpan.className = 'todo-text';
            textSpan.textContent = todo.text;

            // Create delete button
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.className = 'delete-btn';
            deleteButton.addEventListener('click', () => deleteTodo(todo.id)); // Attach event listener

            // Append elements to li
            const contentDiv = document.createElement('div');
            contentDiv.className = 'todo-item-content';
            contentDiv.appendChild(checkbox);
            contentDiv.appendChild(textSpan);
            li.appendChild(contentDiv);
            li.appendChild(deleteButton);

            // Apply 'todo-done' class if done
            if (todo.done) {
                li.classList.add('todo-done');
            }

            todoListUl.appendChild(li);
        });
    } catch (error) {
        console.error('Error fetching and rendering todos from backend:', error);
        showMessage('Error fetching todos. Please check console.', 'error');
    }
}

async function addTodo() {
    const todoInput = document.getElementById('todoInput');
    const todoText = todoInput.value.trim();

    if (todoText.length === 0) {
        showMessage('Todo cannot be empty!', 'warning');
        return;
    }
    // IMPORTANT: The JS_TODO_MAX_LENGTH in client.js is a placeholder.
    // It will be replaced with the actual value from the environment variable
    // by a build step or injected by the server, but for now, it's a hardcoded value here.
    // If you need it to be dynamic based on the server's env, we'd need a slight adjustment
    // (e.g., expose it via a meta tag or a dedicated endpoint).
    if (todoText.length > JS_TODO_MAX_LENGTH) {
        showMessage('Todo is too long! Max ' + JS_TODO_MAX_LENGTH + ' characters.', 'warning');
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
        showMessage('Todo added successfully!', 'info');
    } catch (error) {
        console.error('Error adding todo to backend:', error);
        showMessage('Error adding todo to backend. Please check console.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('[TODO-APP-CLIENT] DOMContentLoaded event fired. Initiating fetches...');
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
