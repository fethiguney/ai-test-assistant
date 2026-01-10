# AI Test Assistant - Frontend

React + TypeScript frontend for the AI Test Assistant.

## Features

- 📝 Natural language test prompt input
- 🔄 LLM provider selection (Ollama, Groq)
- ⚡ Real-time test generation
- 🚀 Optional immediate execution
- 📊 Beautiful results display with step-by-step breakdown
- 🎨 Modern dark theme UI

## Development

```bash
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`

## Usage

1. Enter your test scenario in natural language
2. Select LLM provider (or use auto for current active)
3. Choose whether to execute immediately
4. Click "Generate Steps" or "Generate & Execute"
5. View generated steps and execution results

## Example Prompts

- "Go to login page, enter username tomsmith, password SuperSecretPassword!, click login, verify success"
- "Navigate to Google, search for Playwright testing, click first result"
- "Visit example.com and verify the page title"

## Backend Connection

Frontend proxies API requests to backend running on port 3001 via Vite proxy configuration.
