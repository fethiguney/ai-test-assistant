/**
 * AI Test Assistant Backend
 * Clean Entry Point
 *
 * This file only handles:
 * - Express app setup
 * - Middleware registration
 * - Route mounting
 * - Server startup
 * - WebSocket server initialization
 */

import express from "express";
import cors from "cors";
import { createServer } from "http";

import { config, validateConfig } from "./config/index.js";
import {
  healthRoutes,
  llmRoutes,
  testRoutes,
  errorHandler,
} from "./api/index.js";
import { WebSocketServer } from "./websocket/index.js";

// ============================================
// Validate Configuration
// ============================================

validateConfig();

// ============================================
// Create Express App
// ============================================

const app = express();

// ============================================
// Global Middleware
// ============================================

app.use(cors());
app.use(express.json());

// ============================================
// Mount Routes
// ============================================

// Health & Status (no prefix)
app.use(healthRoutes);

// LLM endpoints
app.use("/api/llm", llmRoutes);

// Test endpoints
app.use("/api/test", testRoutes);

// ============================================
// Error Handler (must be last)
// ============================================

app.use(errorHandler);

// ============================================
// Start Server with WebSocket Support
// ============================================

const PORT = config.server.port;

// Create HTTP server
const httpServer = createServer(app);

// Initialize WebSocket server
const wsServer = new WebSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           AI Test Assistant Backend v1.0                   ║
║           Running on http://localhost:${PORT}                ║
║           WebSocket: ws://localhost:${PORT}                  ║
╠════════════════════════════════════════════════════════════╣
║  Health:                                                   ║
║    GET  /health                   Health check             ║
║    GET  /api/status               Full status              ║
╠════════════════════════════════════════════════════════════╣
║  LLM:                                                      ║
║    GET  /api/llm/providers        List providers           ║
║    GET  /api/llm/providers/health Check provider health    ║
║    POST /api/llm/providers/active Set active provider      ║
║    POST /api/llm/generate         Text generation          ║
║    POST /api/llm/chat             Chat completion          ║
╠════════════════════════════════════════════════════════════╣
║  Test:                                                     ║
║    POST /api/test/run             Dynamic prompt → test    ║
║    POST /api/test/generate-steps  Generate test steps      ║
║    POST /api/test/execute-steps   Execute with Playwright  ║
║    GET  /api/test/mcp/clients     List MCP clients         ║
║    POST /api/test/mcp/clients/active Set active MCP client║
║    POST /api/test/validate-steps  Validate steps format    ║
╠════════════════════════════════════════════════════════════╣
║  WebSocket Events (Human-in-Loop):                         ║
║    test:start                     Start test session       ║
║    step:approval                  Approve/reject step      ║
║    session:cancel                 Cancel active session    ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  wsServer.close();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, httpServer, wsServer };
