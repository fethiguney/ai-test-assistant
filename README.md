# 🤖 AI Test Assistant

AI-powered test automation assistant that converts natural language test scenarios into executable test steps.

## 🎯 Features

- **Natural Language to Test Steps**: Convert manual test scenarios to structured test steps
- **Multi-LLM Support**: Ollama (local), Groq (cloud/free), and more
- **Human-in-the-Loop**: Step-by-step execution with manual intervention
- **Modular Architecture**: Clean, extensible, SOLID-compliant codebase

## 📁 Project Structure

```
ai-test-assistant-poc/
├── backend/                 # Backend API server
│   └── src/
│       ├── api/             # HTTP layer (routes, middleware)
│       ├── config/          # Centralized configuration
│       ├── llm/             # LLM providers (Ollama, Groq)
│       ├── services/        # Business logic
│       └── types/           # TypeScript type definitions
├── docs/                    # Documentation
│   └── development/         # Development guidelines
├── _legacy/                 # Old POC code (reference only)
├── .cursorrules             # Development guidelines for Cursor AI
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js v18+
- One of the following LLM providers:
  - **Ollama** (local): [Install Ollama](https://ollama.com)
  - **Groq** (cloud, free): [Get API Key](https://console.groq.com)

### Installation

```bash
cd backend
npm install
```

### Configuration

Create a `.env` file in the `backend/` directory:

```env
# Groq (recommended - faster)
GROQ_API_KEY=your_groq_api_key

# Or use Ollama (local)
OLLAMA_BASE_URL=http://localhost:11434

# Server
PORT=3001
```

### Running

```bash
cd backend

# Development mode (with hot reload)
npm run dev

# Or run tests
npm run test:llm
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/status` | Full system status |
| GET | `/api/llm/providers` | List LLM providers |
| GET | `/api/llm/providers/health` | Check provider health |
| POST | `/api/llm/providers/active` | Set active provider |
| POST | `/api/llm/generate` | Text generation |
| POST | `/api/llm/chat` | Chat completion |
| POST | `/api/test/generate-steps` | **Generate test steps** |

## 🧪 Example: Generate Test Steps

```bash
curl -X POST http://localhost:3001/api/test/generate-steps \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "User goes to login page, enters username tomsmith and password SuperSecretPassword!, clicks login button, and should see success message"
  }'
```

**Response:**
```json
{
  "steps": [
    { "action": "goto", "target": "https://example.com/login" },
    { "action": "fill", "target": "#username", "value": "tomsmith" },
    { "action": "fill", "target": "#password", "value": "SuperSecretPassword!" },
    { "action": "click", "target": "button[type=submit]" },
    { "action": "expectVisible", "target": "#flash" }
  ],
  "model": "llama-3.3-70b-versatile",
  "provider": "groq",
  "latencyMs": 350
}
```

## 🏗️ Architecture

### SOLID Principles

- **S**ingle Responsibility: Each module has one job
- **O**pen/Closed: Extend via interfaces, don't modify
- **L**iskov Substitution: Providers are interchangeable
- **I**nterface Segregation: Small, focused interfaces
- **D**ependency Inversion: Depend on abstractions

### Adding a New LLM Provider

```typescript
// 1. Create provider in llm/providers/
class NewProvider extends BaseLLMProvider {
  async healthCheck(): Promise<boolean> { /* ... */ }
  async chat(messages, options): Promise<LLMResponse> { /* ... */ }
}

// 2. Register in llm-manager.ts
llmManager.registerProvider(new NewProvider());
```

## 📚 Documentation

- [Feature Development Guide](docs/development/feature-development.md)
- [Refactoring Guide](docs/development/refactoring-guide.md)
- [Architecture Decisions](docs/development/architecture-decisions.md)

## 🗺️ Roadmap

- [x] LLM abstraction layer (Ollama, Groq)
- [x] Test step generation from natural language
- [x] REST API
- [ ] Step Executor (Playwright integration)
- [ ] Frontend UI
- [ ] Test scenario storage
- [ ] Human-in-the-loop execution
- [ ] Mobile test support (Appium)
- [ ] API test support

## 📄 License

ISC
