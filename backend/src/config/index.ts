/**
 * Centralized Configuration
 * All environment variables and app config in one place
 */

export interface AppConfig {
  server: {
    port: number;
    env: 'development' | 'production' | 'test';
  };
  llm: {
    ollama: {
      baseUrl: string;
      defaultModel: string;
      timeout: number;
    };
    groq: {
      apiKey: string | undefined;
      defaultModel: string;
      timeout: number;
    };
    defaultProvider: 'ollama' | 'groq';
  };
}

function loadConfig(): AppConfig {
  return {
    server: {
      port: parseInt(process.env.PORT || '3001', 10),
      env: (process.env.NODE_ENV as AppConfig['server']['env']) || 'development',
    },
    llm: {
      ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        defaultModel: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
        timeout: parseInt(process.env.OLLAMA_TIMEOUT || '120000', 10),
      },
      groq: {
        apiKey: process.env.GROQ_API_KEY,
        defaultModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        timeout: parseInt(process.env.GROQ_TIMEOUT || '30000', 10),
      },
      defaultProvider: (process.env.DEFAULT_LLM_PROVIDER as 'ollama' | 'groq') || 'ollama',
    },
  };
}

// Singleton config instance
export const config = loadConfig();

// Validate required config on startup
export function validateConfig(): void {
  const errors: string[] = [];

  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('Invalid PORT value');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}

// Export MCP configuration
export { getMCPConfig, defaultMCPConfig, validateMCPConfig } from './mcp.config.js';
export type { MCPServerConfig } from './mcp.config.js';