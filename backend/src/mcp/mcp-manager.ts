/**
 * MCP Manager
 * 
 * Single Responsibility: Manage MCP client lifecycle
 * - Register/unregister clients
 * - Client selection
 * - Health checks
 */

import {
  IMCPClient,
  MCPClientType,
  MCPClientStatus,
  MCPExecutionRequest,
  MCPExecutionResponse,
} from '../types/index.js';
import { PlaywrightMCPClient } from './clients/index.js';

export class MCPManager {
  private clients: Map<MCPClientType, IMCPClient> = new Map();
  private activeClientType: MCPClientType | null = null;

  constructor() {
    // Don't auto-initialize - let caller decide
  }

  /**
   * Initialize default MCP clients
   */
  initializeDefaultClients(): void {
    this.registerClient(new PlaywrightMCPClient());
    
    // Set default
    this.activeClientType = 'playwright';
    
    console.log('[MCPManager] Initialized with clients:', this.getClientTypes());
  }

  // ============================================
  // Client Registration
  // ============================================

  registerClient(client: IMCPClient): void {
    this.clients.set(client.config.type, client);
  }

  unregisterClient(type: MCPClientType): boolean {
    return this.clients.delete(type);
  }

  // ============================================
  // Client Access
  // ============================================

  getClient(type: MCPClientType): IMCPClient | undefined {
    return this.clients.get(type);
  }

  getActiveClient(): IMCPClient | null {
    if (!this.activeClientType) return null;
    return this.clients.get(this.activeClientType) || null;
  }

  getClientTypes(): MCPClientType[] {
    return Array.from(this.clients.keys());
  }

  // ============================================
  // Client Selection
  // ============================================

  setActiveClient(type: MCPClientType): boolean {
    if (!this.clients.has(type)) {
      console.error(`[MCPManager] Client ${type} not registered`);
      return false;
    }
    
    this.activeClientType = type;
    console.log(`[MCPManager] Active client: ${type}`);
    return true;
  }

  getActiveClientType(): MCPClientType | null {
    return this.activeClientType;
  }

  // ============================================
  // Health Checks
  // ============================================

  async checkClientHealth(type: MCPClientType): Promise<MCPClientStatus> {
    const client = this.clients.get(type);
    
    if (!client) {
      return {
        type,
        name: 'Unknown',
        isAvailable: false,
        isConnected: false,
        error: 'Client not registered',
      };
    }

    try {
      const isAvailable = await client.healthCheck();
      return {
        type,
        name: client.config.name,
        isAvailable,
        isConnected: client.isConnected(),
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        type,
        name: client.config.name,
        isAvailable: false,
        isConnected: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkAllClients(): Promise<MCPClientStatus[]> {
    const checks = Array.from(this.clients.keys()).map(
      (type) => this.checkClientHealth(type)
    );
    return Promise.all(checks);
  }

  // ============================================
  // Execution
  // ============================================

  async executeSteps(request: MCPExecutionRequest): Promise<MCPExecutionResponse> {
    const client = this.getActiveClient();
    
    if (!client) {
      throw new Error('No active MCP client configured');
    }

    if (!client.isConnected()) {
      await client.connect();
    }

    return client.executeSteps(request);
  }

  // ============================================
  // Summary
  // ============================================

  getSummary(): {
    activeClient: MCPClientType | null;
    clients: {
      type: MCPClientType;
      name: string;
      isConnected: boolean;
    }[];
  } {
    const clients = Array.from(this.clients.entries()).map(([type, c]) => ({
      type,
      name: c.config.name,
      isConnected: c.isConnected(),
    }));

    return {
      activeClient: this.activeClientType,
      clients,
    };
  }

  // ============================================
  // Cleanup
  // ============================================

  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.clients.values()).map(
      (client) => client.disconnect()
    );
    await Promise.all(promises);
  }
}

// Singleton instance
export const mcpManager = new MCPManager();

// Initialize on module load
mcpManager.initializeDefaultClients();
