# 🤖 AI Test Assistant

AI-powered test automation assistant that converts natural language test scenarios into executable test steps.

## 🎯 Features

- **Natural Language to Test Steps**: Convert manual test scenarios to structured test steps
- **Multi-LLM Support**: Ollama (local), Groq (cloud/free), and more
- **Human-in-the-Loop**: WebSocket-based step-by-step approval with real-time updates
- **Dual Execution Modes**: API (automatic) or WebSocket (manual approval)
- **Official MCP Integration**: Uses Microsoft's @playwright/mcp package for standardized browser automation
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
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Configuration

Set environment variable for Groq (or use Ollama locally):

```bash
# Windows PowerShell
$env:GROQ_API_KEY="your_groq_api_key"

# Linux/Mac
export GROQ_API_KEY="your_groq_api_key"
```

### Running

**Backend (Terminal 1):**

```bash
cd backend
npm run dev
# Runs on http://localhost:3001
```

**Frontend (Terminal 2):**

```bash
cd frontend
npm run dev
# Runs on http://localhost:3000
```

Open `http://localhost:3000` in your browser!

## 🎨 Frontend UI

Access the web interface at `http://localhost:3000`

Features:

- Natural language test prompt input
- LLM provider selection (Groq, Ollama)
- MCP client selection (Playwright)
- **Execution Mode Switcher**:
  - **API Mode**: Automatic test generation and execution
  - **WebSocket Mode**: Human-in-Loop with step-by-step approval
- Real-time test generation & execution
- Interactive step approval UI (WebSocket mode)
- Beautiful results display with execution details
- Dark theme

### Human-in-Loop Mode

Switch to WebSocket mode for step-by-step control:

1. Toggle to "WebSocket (Human-in-Loop)" mode
2. Enter your test scenario and submit
3. Review each generated step before execution
4. Approve, reject, or modify steps individually
5. Monitor real-time execution progress
6. See detailed results for each step

See [Human-in-Loop Documentation](./docs/HUMAN-IN-LOOP.md) for more details.

## 📡 API Endpoints

### HTTP REST API

| Method | Endpoint                       | Description                               |
| ------ | ------------------------------ | ----------------------------------------- |
| GET    | `/health`                      | Health check                              |
| GET    | `/api/status`                  | Full system status                        |
| POST   | `/api/test/run`                | **Dynamic test run** (generate + execute) |
| GET    | `/api/llm/providers`           | List LLM providers                        |
| POST   | `/api/llm/providers/active`    | Set active provider                       |
| POST   | `/api/test/generate-steps`     | Generate test steps                       |
| POST   | `/api/test/execute-steps`      | Execute test steps                        |
| GET    | `/api/test/mcp/clients`        | List MCP clients                          |
| POST   | `/api/test/mcp/clients/active` | Set active MCP client                     |

### WebSocket Events

**Server → Client:**

- `session:created` - New test session started
- `steps:generated` - Test steps generated from scenario
- `step:approval_request` - Requesting approval for next step
- `step:execution_update` - Real-time execution progress
- `session:status` - Session state changes
- `session:completed` - All steps completed
- `error` - Error occurred

**Client → Server:**

- `test:start` - Start new test session
- `step:approval` - Approve/reject step
- `session:cancel` - Cancel active session

Connection: `ws://localhost:3001`

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
    {
      "action": "fill",
      "target": "#password",
      "value": "SuperSecretPassword!"
    },
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
  async healthCheck(): Promise<boolean> {
    /* ... */
  }
  async chat(messages, options): Promise<LLMResponse> {
    /* ... */
  }
}

// 2. Register in llm-manager.ts
llmManager.registerProvider(new NewProvider());
```

## 📚 Documentation

- [MCP Integration Guide](backend/MCP-INTEGRATION-GUIDE.md) - Official Microsoft Playwright-MCP integration
- [MCP Documentation](docs/MCP-INTEGRATION.md) - Detailed MCP architecture and usage
- [Human-in-the-Loop](docs/HUMAN-IN-LOOP.md) - WebSocket-based approval system
- [Feature Development Guide](docs/development/feature-development.md)
- [Refactoring Guide](docs/development/refactoring-guide.md)
- [Architecture Decisions](docs/development/architecture-decisions.md)

## 🗺️ Roadmap

- [x] LLM abstraction layer (Ollama, Groq)
- [x] Test step generation from natural language
- [x] REST API with WebSocket support
- [x] Step Executor (Playwright integration)
- [x] Frontend UI with real-time updates
- [x] Human-in-the-loop execution
- [x] MCP Integration (Official Microsoft playwright-mcp)
- [ ] Advanced MCP features (PDF, vision, tracing)
- [ ] Test scenario storage and history
- [ ] Mobile test support (Appium MCP)
- [ ] API test support

## 📄 License

ISC
