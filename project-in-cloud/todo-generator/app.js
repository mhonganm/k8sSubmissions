const axios = require('axios');
const fetch = require('node-fetch');
const TODO_BACKEND_URL = process.env.TODO_BACKEND_URL || 'http://todo-backend-service:3002/api/todos';
const RANDOM_FACT_API_URL = process.env.RANDOM_FACT_API_URL || 'http://numbersapi.com/random/trivia';

async function generateRandomTodo() {
    console.log(`[TODO-GENERATOR] Starting to generate a new random todo...`);
    let todoContent = '';

    try {
        console.log(`[TODO-GENERATOR] Fetching random fact from API: ${RANDOM_FACT_API_URL}`);
        const apiResponse = await axios.get(RANDOM_FACT_API_URL, {

            timeout: 10000
        });

        if (apiResponse.status !== 200) {
            throw new Error(`Failed to fetch random fact from API: ${apiResponse.status} - ${apiResponse.statusText}`);
        }

        todoContent = apiResponse.data;

        if (!todoContent) {
            throw new Error('No content received from random fact API.');
        }

        const todoText = `Fact: ${todoContent}`;
        console.log(`[TODO-GENERATOR] Generated todo text: "${todoText}"`);

        const postResponse = await fetch(TODO_BACKEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: todoText }),
        });

        if (!postResponse.ok) {
            const errorData = await postResponse.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(`Failed to add todo to backend: ${postResponse.status} - ${errorData.error || postResponse.statusText}`);
        }

        const newTodo = await postResponse.json();
        console.log(`[TODO-GENERATOR] Successfully added new todo:`, newTodo);

    } catch (error) {
        console.error(`[TODO-GENERATOR] Error generating or adding todo: ${error.message}`);
        if (error.response) {
            console.error(`[TODO-GENERATOR] Axios response error: Status=${error.response.status}, Data=${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            console.error(`[TODO-GENERATOR] Axios request error: No response received.`, error.request);
        } else {
            console.error(`[TODO-GENERATOR] Axios config error:`, error.config);
        }
        process.exit(1);
    }
}
generateRandomTodo();