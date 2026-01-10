# Official Microsoft Playwright-MCP Integration Guide

## Overview

This project now integrates the **official Microsoft playwright-mcp package** to provide standardized browser automation through the Model Context Protocol (MCP).

## What Was Integrated

### Packages Installed

```json
{
  "@playwright/mcp": "^0.0.55",
  "@modelcontextprotocol/sdk": "^1.25.2"
}
```

### New Components Created

1. **MCPToolExecutorService** (`backend/src/services/mcp-tool-executor.service.ts`)
   - Maps AI Test Assistant test steps to official Playwright MCP tools
   - Handles tool execution and result conversion
   - Provides comprehensive error handling

2. **MCP Configuration** (`backend/src/config/mcp.config.ts`)
   - Centralized MCP server configuration
   - Browser settings (headless, viewport, timeouts)
   - Capabilities and output settings

3. **Updated PlaywrightMCPClient** (`backend/src/mcp/clients/playwright-mcp-client.ts`)
   - Now uses official `@playwright/mcp` package
   - Creates in-process MCP connection
   - Automatic fallback to direct execution

## How It Works

### Connection Flow

1. **Initialization**: When PlaywrightMCPClient connects, it calls `createConnection()` from `@playwright/mcp`
2. **Configuration**: The connection is configured with browser settings from `mcp.config.ts`
3. **Tool Mapping**: Test steps are mapped to MCP tools via MCPToolExecutorService
4. **Execution**: MCP tools are called to perform browser automation
5. **Fallback**: If MCP fails, direct Playwright execution is used

### Test Step to MCP Tool Mapping

| Test Step Action | MCP Tool | Description |
|-----------------|----------|-------------|
| `navigate` | `browser_navigate` | Navigate to URL |
| `click` | `browser_click` | Click on element |
| `type` / `fill` | `browser_type` | Type text into input |
| `select` | `browser_select_option` | Select dropdown option |
| `check` / `uncheck` | `browser_click` | Toggle checkbox |
| `press` | `browser_press_key` | Press keyboard key |
| `wait` | `browser_wait_for` | Wait for condition |
| `verify` | `browser_snapshot` | Capture page state |
| `screenshot` | `browser_take_screenshot` | Take screenshot |

## Testing the Integration

Run the MCP integration tests:

```bash
cd backend
npm run test:mcp
```

Expected output:
```
🧪 Testing MCP Integration

1️⃣ MCP Clients
   Active: playwright
   Clients: Playwright MCP (Official)

2️⃣ MCP Health Check
   ✅ Playwright MCP (Official) - Connected: true

3️⃣ Run test with MCP (Playwright)
   ✅ Generated steps
   Execution Method: mcp
   MCP Client: playwright
   Status: PASSED/ERROR (with fallback working)

4️⃣ Run test with direct execution
   Execution Method: direct
   Status: passed

✅ MCP integration tests completed!
```

## Configuration

### Basic Configuration

Edit `backend/src/config/mcp.config.ts`:

```typescript
export const defaultMCPConfig: MCPServerConfig = {
  browser: {
    browserName: 'chromium', // or 'firefox', 'webkit'
    launchOptions: {
      headless: true,
      timeout: 30000,
    },
    contextOptions: {
      viewport: { width: 1280, height: 720 },
    },
  },
  capabilities: ['core'], // Available: core, pdf, vision, testing, tracing
  timeouts: {
    action: 5000,      // 5 seconds for actions
    navigation: 60000, // 60 seconds for navigation
  },
};
```

### Environment Variables

Set `MCP_HEADLESS` to control browser visibility:

```bash
# Run in headed mode (see browser)
MCP_HEADLESS=false npm run test:mcp

# Run in headless mode (default)
MCP_HEADLESS=true npm run test:mcp
```

## API Usage

### Using MCP in Test Execution

```bash
POST /api/test/run
Content-Type: application/json

{
  "prompt": "Go to example.com and click the login button",
  "llmProvider": "groq",
  "mcpClient": "playwright",  # Use MCP
  "executeImmediately": true
}
```

Response includes:
```json
{
  "executionMethod": "mcp",
  "mcpClient": "playwright",
  "execution": {
    "status": "passed",
    "totalDuration": 3000
  }
}
```

### Checking MCP Status

```bash
GET /api/test/mcp/clients/health
```

Response:
```json
{
  "clients": [
    {
      "type": "playwright",
      "name": "Playwright MCP (Official)",
      "isAvailable": true,
      "isConnected": true
    }
  ]
}
```

## Architecture Details

### Component Hierarchy

```
┌─────────────────────────────────────┐
│   TestOrchestratorService           │
│   (Coordinates test execution)      │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   MCPManager                        │
│   (Manages MCP clients)             │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   PlaywrightMCPClient               │
│   (Official MCP integration)        │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   MCPToolExecutorService            │
│   (Maps steps to MCP tools)         │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   @playwright/mcp                   │
│   (Official Microsoft package)      │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   Playwright Browser                │
└─────────────────────────────────────┘
```

### SOLID Principles Applied

- **Single Responsibility**: Each service has one clear purpose
- **Open/Closed**: New MCP clients can be added without modifying existing code
- **Liskov Substitution**: All MCP clients are interchangeable via IMCPClient interface
- **Interface Segregation**: Clean, focused interfaces for each component
- **Dependency Inversion**: Components depend on abstractions, not concrete implementations

## Troubleshooting

### MCP Connection Fails

If you see:
```
[PlaywrightMCP] Official MCP not available, using fallback
```

**Solution**: The fallback mechanism ensures tests still run. This is expected in some environments.

### Browser Not Found

If you see:
```
Executable doesn't exist at ...
```

**Solution**: Install Playwright browsers:
```bash
npx playwright install chromium
```

### Timeout Errors

If steps are timing out:

**Solution**: Increase timeouts in `mcp.config.ts`:
```typescript
timeouts: {
  action: 10000,      // Increase to 10 seconds
  navigation: 120000, // Increase to 2 minutes
}
```

## Future Enhancements

### Planned Features

1. **Full MCP Tool Integration**: Complete implementation of all MCP tool calls
2. **Advanced Capabilities**: Enable PDF, vision, and testing capabilities
3. **Trace Recording**: Save Playwright traces for debugging
4. **Video Recording**: Capture video of test execution
5. **Multiple Browsers**: Support for Firefox and WebKit
6. **Remote Browser**: Connect to remote Playwright servers

### Adding New MCP Clients

To add support for other automation frameworks (Appium, API testing, etc.):

1. Create a new client extending `BaseMCPClient`
2. Implement the MCP protocol for that framework
3. Register in `MCPManager`
4. Update frontend to show the new client option

## References

- **Official Playwright MCP**: https://github.com/microsoft/playwright-mcp
- **MCP Protocol**: https://modelcontextprotocol.io
- **Playwright Documentation**: https://playwright.dev
- **Project MCP Integration Doc**: `../docs/MCP-INTEGRATION.md`

## Summary

✅ **What's Working:**
- Official Microsoft playwright-mcp package installed
- MCP client connects successfully
- Test step mapping to MCP tools
- Fallback mechanism for reliability
- Health checks and status monitoring
- API endpoints for MCP management

🚧 **What's Next:**
- Complete MCP tool call implementation
- Enable advanced capabilities (PDF, vision, tracing)
- Add more browser configurations
- Implement additional MCP clients (Appium, API)

The integration provides a solid foundation for standardized test automation through the MCP protocol while maintaining backward compatibility through the fallback mechanism.
