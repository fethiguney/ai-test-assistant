# AI Test Assistant - Backend

## Architecture

### Modular Structure (SOLID Principles)

```
backend/src/
├── api/              # HTTP layer
│   ├── routes/       # Express routes
│   └── middleware/   # Validation, error handling
├── config/           # Configuration management
├── llm/              # LLM abstraction layer
│   ├── providers/    # Ollama, Groq implementations
│   └── llm-manager.ts
├── mcp/              # MCP (Model Context Protocol) layer
│   ├── clients/      # Playwright, Appium implementations
│   └── mcp-manager.ts
├── services/         # Business logic
│   ├── test-generator.service.ts
│   ├── step-executor.service.ts
│   └── test-orchestrator.service.ts
└── types/            # TypeScript types
```

## Key Features

### 1. LLM Abstraction
- **Multiple Providers**: Ollama (local), Groq (cloud)
- **Dynamic Switching**: Change LLM at runtime
- **Unified Interface**: `ILLMProvider` for all implementations

### 2. MCP Integration
- **Protocol-Based**: Execute tests via MCP clients
- **Multiple Executors**: Playwright (web), Appium (mobile - future)
- **Fallback Support**: Direct execution without MCP

### 3. Test Orchestration
- **Dynamic Flow**: Prompt → LLM → Steps → Execution
- **Flexible Execution**: Choose LLM + MCP client per request
- **Human-in-Loop Ready**: Structure supports manual approval (future)

## API Endpoints

### Health
- `GET /health` - Health check
- `GET /api/status` - Full system status

### LLM Management
- `GET /api/llm/providers` - List LLM providers
- `GET /api/llm/providers/health` - Check provider health
- `POST /api/llm/providers/active` - Set active provider

### Test Operations
- `POST /api/test/run` - **Main endpoint**: Generate + execute tests
- `POST /api/test/generate-steps` - Generate steps only
- `POST /api/test/execute-steps` - Execute existing steps

### MCP Management
- `GET /api/test/mcp/clients` - List MCP clients
- `GET /api/test/mcp/clients/health` - Check MCP client health
- `POST /api/test/mcp/clients/active` - Set active MCP client

## Usage Examples

### Dynamic Test Run (with MCP)
```bash
curl -X POST http://localhost:3001/api/test/run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Go to login page, enter credentials, verify success",
    "llmProvider": "groq",
    "mcpClient": "playwright",
    "executeImmediately": true
  }'
```

### Direct Execution (no MCP)
```bash
curl -X POST http://localhost:3001/api/test/run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Visit example.com",
    "mcpClient": "direct",
    "executeImmediately": true
  }'
```

## Development

### Scripts
```bash
npm run dev          # Development mode (watch)
npm run build        # Build for production
npm run test:llm     # Test LLM providers
npm run test:mcp     # Test MCP integration
npm run test:dynamic # Test dynamic flow
```

### Environment Variables
```bash
# Groq (cloud LLM)
GROQ_API_KEY=your_key

# Ollama (local LLM)
OLLAMA_BASE_URL=http://localhost:11434

# Server
PORT=3001
```

## SOLID Principles Applied

1. **Single Responsibility**: Each service has one job
   - `LLMManager`: Provider management
   - `TestGeneratorService`: Step generation
   - `StepExecutorService`: Direct execution
   - `MCPManager`: MCP client management
   - `TestOrchestratorService`: Flow orchestration

2. **Open/Closed**: Extend without modifying
   - Add new LLM providers by extending `BaseLLMProvider`
   - Add new MCP clients by extending `BaseMCPClient`

3. **Liskov Substitution**: All providers interchangeable
   - Any `ILLMProvider` works with `LLMManager`
   - Any `IMCPClient` works with `MCPManager`

4. **Interface Segregation**: Small, focused interfaces
   - Separate types for LLM, MCP, Test

5. **Dependency Inversion**: Depend on abstractions
   - Services receive dependencies via constructor
   - Factory functions for service creation

## Next Steps

- [ ] Integrate actual MCP SDK (currently using wrapper)
- [ ] Add Appium MCP client for mobile testing
- [ ] Add API testing MCP client
- [ ] Implement human-in-the-loop approval flow
- [ ] Add test result persistence
- [ ] Add test scenario library
