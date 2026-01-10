/**
 * MCP Configuration
 * 
 * Configuration for Playwright MCP server integration
 */

export interface MCPServerConfig {
  browser?: {
    browserName?: 'chromium' | 'firefox' | 'webkit';
    isolated?: boolean;
    userDataDir?: string;
    launchOptions?: {
      headless?: boolean;
      timeout?: number;
      channel?: string;
      executablePath?: string;
    };
    contextOptions?: {
      viewport?: { width: number; height: number };
      userAgent?: string;
      locale?: string;
      timezoneId?: string;
    };
  };
  server?: {
    port?: number;
    host?: string;
    allowedHosts?: string[];
  };
  capabilities?: string[];
  saveSession?: boolean;
  saveTrace?: boolean;
  saveVideo?: {
    width: number;
    height: number;
  };
  outputDir?: string;
  console?: {
    level?: 'error' | 'warning' | 'info' | 'debug';
  };
  network?: {
    allowedOrigins?: string[];
    blockedOrigins?: string[];
  };
  testIdAttribute?: string;
  timeouts?: {
    action?: number;
    navigation?: number;
  };
}

/**
 * Default MCP configuration for AI Test Assistant
 */
export const defaultMCPConfig: MCPServerConfig = {
  browser: {
    browserName: 'chromium',
    isolated: false,
    launchOptions: {
      headless: false, // Set to false to see the browser
      timeout: 30000,
    },
    contextOptions: {
      viewport: { width: 1280, height: 720 },
    },
  },
  capabilities: ['core'],
  outputDir: './mcp-output',
  console: {
    level: 'info',
  },
  timeouts: {
    action: 5000,
    navigation: 60000,
  },
  testIdAttribute: 'data-testid',
};

/**
 * Get MCP configuration from environment or defaults
 */
export function getMCPConfig(): MCPServerConfig {
  return {
    ...defaultMCPConfig,
    browser: {
      ...defaultMCPConfig.browser,
      launchOptions: {
        ...defaultMCPConfig.browser?.launchOptions,
        headless: process.env.MCP_HEADLESS !== 'false',
      },
    },
  };
}

/**
 * Validate MCP configuration
 */
export function validateMCPConfig(config: MCPServerConfig): boolean {
  // Basic validation
  if (config.browser?.launchOptions?.timeout && config.browser.launchOptions.timeout < 0) {
    console.error('[MCP Config] Invalid timeout value');
    return false;
  }

  if (config.timeouts?.action && config.timeouts.action < 0) {
    console.error('[MCP Config] Invalid action timeout');
    return false;
  }

  return true;
}
