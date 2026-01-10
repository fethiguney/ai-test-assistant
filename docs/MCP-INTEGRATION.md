# MCP Integration Guide

## Overview

The AI Test Assistant now supports **MCP (Model Context Protocol)** for test execution, providing a standardized way to interact with different test automation frameworks.

## Architecture

### MCP Layer Structure

```
backend/src/mcp/
├── clients/
│   ├── base-mcp-client.ts       # Abstract base class
│   ├── playwright-mcp-client.ts # Playwright implementation
│   └── index.ts
├── mcp-manager.ts                # Client lifecycle management
└── index.ts
```

### Key Components

#### 1. IMCPClient Interface
Defines the contract for all MCP clients:
- `connect()` - Establish connection to MCP server
- `disconnect()` - Close connection
- `executeSteps()` - Execute test steps via MCP
- `healthCheck()` - Verify client availability

#### 2. BaseMCPClient
Abstract class providing common functionality:
- Connection state management
- Execution time measurement
- ID generation utilities

#### 3. PlaywrightMCPClient
Concrete implementation for Playwright:
- Currently wraps `StepExecutorService`
- Ready for actual MCP SDK integration
- Supports all Playwright actions

#### 4. MCPManager
Singleton service managing MCP clients:
- Client registration/unregistration
- Active client selection
- Health monitoring
- Execution delegation

## Usage

### API Endpoints

#### List MCP Clients
```bash
GET /api/test/mcp/clients

Response:
{
  "activeClient": "playwright",
  "clients": [
    {
      "type": "playwright",
      "name": "Playwright MCP",
      "isConnected": true
    }
  ]
}
```

#### Check MCP Health
```bash
GET /api/test/mcp/clients/health

Response:
{
  "clients": [
    {
      "type": "playwright",
      "name": "Playwright MCP",
      "isAvailable": true,
      "isConnected": true,
      "lastChecked": "2026-01-10T..."
    }
  ]
}
```

#### Set Active MCP Client
```bash
POST /api/test/mcp/clients/active
{
  "client": "playwright"
}
```

### Dynamic Test Execution

#### With MCP (Recommended)
```bash
POST /api/test/run
{
  "prompt": "Go to login page, enter credentials, verify success",
  "llmProvider": "groq",
  "mcpClient": "playwright",
  "executeImmediately": true
}

Response:
{
  "id": "run_...",
  "generatedSteps": [...],
  "executionMethod": "mcp",
  "mcpClient": "playwright",
  "execution": {
    "status": "passed",
    "totalDuration": 3086
  }
}
```

#### Direct Execution (Fallback)
```bash
POST /api/test/run
{
  "prompt": "Visit example.com",
  "mcpClient": "direct",
  "executeImmediately": true
}

Response:
{
  "executionMethod": "direct",
  "execution": {...}
}
```

## Frontend Integration

### MCP Client Selector

The UI now includes an "Test Executor" dropdown:
- **MCP - Playwright**: Execute via MCP protocol
- **Direct - Playwright**: Execute without MCP
- **MCP - Appium**: Coming soon for mobile

### Execution Info Display

Results show:
- Execution Method (MCP / Direct)
- MCP Client used (if applicable)
- All existing metrics (duration, status, etc.)

## Implementation Status

### ✅ Completed
- [x] MCP type definitions
- [x] Base MCP client architecture
- [x] Playwright MCP client (wrapper)
- [x] MCP manager with lifecycle management
- [x] API endpoints for MCP management
- [x] Integration with test orchestrator
- [x] Frontend MCP client selection
- [x] Execution method tracking

### 🚧 In Progress
- [ ] Actual MCP SDK integration
- [ ] MCP protocol communication

### 📋 Future
- [ ] Appium MCP client (mobile testing)
- [ ] API testing MCP client
- [ ] Custom MCP client support
- [ ] MCP server configuration UI

## Benefits of MCP Integration

1. **Standardization**: Consistent interface across different test frameworks
2. **Extensibility**: Easy to add new test executors (Appium, API, etc.)
3. **Flexibility**: Choose execution method per test run
4. **Future-Proof**: Ready for MCP SDK when integrated
5. **Fallback Support**: Direct execution still available

## Testing

Run MCP integration tests:
```bash
cd backend
npm run test:mcp
```

Expected output:
```
🧪 Testing MCP Integration

1️⃣ MCP Clients
   Active: playwright
   Clients: Playwright MCP

2️⃣ MCP Health Check
   ✅ Playwright MCP - Connected: true

3️⃣ Run test with MCP (Playwright)
   ✅ Generated 5 steps
   Execution Method: mcp
   Status: PASSED

4️⃣ Run test with direct execution
   Execution Method: direct
   Status: passed
```

## Adding New MCP Clients

### Step 1: Create Client Class
```typescript
export class AppiumMCPClient extends BaseMCPClient {
  constructor(config?: Partial<MCPClientConfig>) {
    super({
      type: 'appium',
      name: 'Appium MCP',
      isAvailable: true,
      ...config
    });
  }

  async connect(): Promise<boolean> {
    // Implement MCP connection
  }

  async executeSteps(request: MCPExecutionRequest): Promise<MCPExecutionResponse> {
    // Implement step execution
  }
}
```

### Step 2: Register with Manager
```typescript
// In mcp-manager.ts initializeDefaultClients()
this.registerClient(new AppiumMCPClient());
```

### Step 3: Update Types
```typescript
// In mcp.types.ts
export type MCPClientType = 'playwright' | 'appium' | 'api' | 'custom';
```

### Step 4: Update Frontend
```typescript
// In TestPromptInput.tsx
<option value="appium">MCP - Appium</option>
```

## SOLID Principles Applied

- **SRP**: Each client handles one framework
- **OCP**: Add new clients without modifying existing code
- **LSP**: All MCP clients are interchangeable
- **ISP**: Clean, focused IMCPClient interface
- **DIP**: Orchestrator depends on IMCPClient abstraction

## Next Steps

1. Integrate actual MCP SDK
2. Implement Appium MCP client
3. Add API testing MCP client
4. Create MCP configuration UI
5. Add MCP server health monitoring
6. Implement MCP protocol communication layer
