/**
 * Page Inspection Service
 *
 * Single Responsibility: Capture and analyze page snapshots for test generation
 * 
 * This service uses browser_snapshot tool to extract DOM structure and
 * provide accurate selectors for test generation.
 */

import { PageSnapshot, DOMElement, SnapshotSummary } from '../types/index.js';

interface RawSnapshotElement {
  tag?: string;
  role?: string;
  name?: string;
  text?: string;
  attributes?: Record<string, any>;
  children?: RawSnapshotElement[];
  selector?: string;
}

interface RawSnapshotData {
  url?: string;
  title?: string;
  elements?: RawSnapshotElement[];
  accessibility_tree?: any;
  [key: string]: any;
}

export class PageInspectionService {
  /**
   * Capture a page snapshot using MCP browser_snapshot tool
   * 
   * @param mcpConnection - Active MCP connection
   * @returns Structured page snapshot with DOM elements
   */
  async captureSnapshot(mcpConnection: any): Promise<PageSnapshot> {
    try {
      // Call browser_snapshot MCP tool
      const rawSnapshot = await this.callBrowserSnapshot(mcpConnection);
      
      // Extract elements from raw snapshot
      const elements = this.extractElements(rawSnapshot);
      
      const snapshot: PageSnapshot = {
        url: rawSnapshot.url || 'unknown',
        title: rawSnapshot.title || 'Untitled',
        elements,
        timestamp: new Date(),
      };
      
      return snapshot;
    } catch (error) {
      console.error('[PageInspection] Failed to capture snapshot:', error);
      throw new Error(`Snapshot capture failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract DOM elements from raw snapshot data
   * 
   * Processes the accessibility tree or raw elements to create
   * structured DOMElement objects with proper selectors.
   * 
   * @param rawSnapshot - Raw snapshot data from MCP tool
   * @returns Array of structured DOM elements
   */
  extractElements(rawSnapshot: RawSnapshotData): DOMElement[] {
    const elements: DOMElement[] = [];
    
    try {
      // Try to extract from accessibility tree first (preferred)
      if (rawSnapshot.accessibility_tree) {
        this.extractFromAccessibilityTree(rawSnapshot.accessibility_tree, elements);
      }
      // Fallback to elements array if available
      else if (rawSnapshot.elements && Array.isArray(rawSnapshot.elements)) {
        this.extractFromElementsArray(rawSnapshot.elements, elements);
      }
      // Last resort: try to parse any structure
      else {
        console.warn('[PageInspection] Unknown snapshot format, attempting generic extraction');
        this.extractGeneric(rawSnapshot, elements);
      }
    } catch (error) {
      console.error('[PageInspection] Element extraction error:', error);
    }
    
    return elements;
  }

  /**
   * Format page snapshot for LLM consumption
   * 
   * Creates a concise, readable representation of the page structure
   * that helps the LLM generate accurate selectors.
   * 
   * @param snapshot - Page snapshot
   * @returns Formatted string for LLM prompt
   */
  formatForLLM(snapshot: PageSnapshot): string {
    const lines: string[] = [];
    
    lines.push(`Page: ${snapshot.title}`);
    lines.push(`URL: ${snapshot.url}`);
    lines.push(`Elements found: ${snapshot.elements.length}`);
    lines.push('');
    lines.push('Interactive Elements:');
    
    // Group elements by type
    const buttons = snapshot.elements.filter(el => 
      el.role === 'button' || el.tag === 'button'
    );
    const inputs = snapshot.elements.filter(el => 
      el.tag === 'input' || el.role === 'textbox'
    );
    const links = snapshot.elements.filter(el => 
      el.tag === 'a' || el.role === 'link'
    );
    const selects = snapshot.elements.filter(el => 
      el.tag === 'select' || el.role === 'combobox'
    );
    
    // Format each group
    if (buttons.length > 0) {
      lines.push('\nButtons:');
      buttons.slice(0, 10).forEach(el => {
        lines.push(this.formatElement(el));
      });
      if (buttons.length > 10) {
        lines.push(`  ... and ${buttons.length - 10} more buttons`);
      }
    }
    
    if (inputs.length > 0) {
      lines.push('\nInput Fields:');
      inputs.slice(0, 10).forEach(el => {
        lines.push(this.formatElement(el));
      });
      if (inputs.length > 10) {
        lines.push(`  ... and ${inputs.length - 10} more inputs`);
      }
    }
    
    if (links.length > 0) {
      lines.push('\nLinks:');
      links.slice(0, 10).forEach(el => {
        lines.push(this.formatElement(el));
      });
      if (links.length > 10) {
        lines.push(`  ... and ${links.length - 10} more links`);
      }
    }
    
    if (selects.length > 0) {
      lines.push('\nDropdowns:');
      selects.slice(0, 5).forEach(el => {
        lines.push(this.formatElement(el));
      });
      if (selects.length > 5) {
        lines.push(`  ... and ${selects.length - 5} more dropdowns`);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Create a summary of the page snapshot
   * 
   * @param snapshot - Page snapshot
   * @returns Snapshot summary with key metrics
   */
  createSummary(snapshot: PageSnapshot): SnapshotSummary {
    const buttons = snapshot.elements.filter(el => 
      el.role === 'button' || el.tag === 'button'
    );
    const inputs = snapshot.elements.filter(el => 
      el.tag === 'input' || el.role === 'textbox'
    );
    const links = snapshot.elements.filter(el => 
      el.tag === 'a' || el.role === 'link'
    );
    const selects = snapshot.elements.filter(el => 
      el.tag === 'select' || el.role === 'combobox'
    );
    
    // Get top 20 most relevant elements
    const topElements = this.getTopElements(snapshot.elements, 20);
    
    return {
      url: snapshot.url,
      title: snapshot.title,
      elementCount: snapshot.elements.length,
      interactiveElements: {
        buttons: buttons.length,
        inputs: inputs.length,
        links: links.length,
        selects: selects.length,
      },
      topElements,
    };
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Call the browser_snapshot MCP tool
   */
  private async callBrowserSnapshot(mcpConnection: any): Promise<RawSnapshotData> {
    // In a full implementation, this would call the actual MCP tool
    // For now, return a mock structure
    // TODO: Implement actual MCP tool call when MCP client is fully integrated
    
    if (!mcpConnection) {
      throw new Error('No active MCP connection');
    }
    
    // Mock implementation - replace with actual MCP call
    return {
      url: 'about:blank',
      title: 'New Page',
      elements: [],
    };
  }

  /**
   * Extract elements from accessibility tree structure
   */
  private extractFromAccessibilityTree(
    tree: any,
    elements: DOMElement[],
    path: string = ''
  ): void {
    if (!tree) return;
    
    // Process current node
    if (tree.role || tree.tag) {
      const element = this.createDOMElement(tree, path);
      if (element) {
        elements.push(element);
      }
    }
    
    // Process children recursively
    if (tree.children && Array.isArray(tree.children)) {
      tree.children.forEach((child: any, index: number) => {
        const childPath = path ? `${path} > ${tree.tag || tree.role}[${index}]` : `${tree.tag || tree.role}[${index}]`;
        this.extractFromAccessibilityTree(child, elements, childPath);
      });
    }
  }

  /**
   * Extract elements from simple elements array
   */
  private extractFromElementsArray(
    elementsArray: RawSnapshotElement[],
    elements: DOMElement[]
  ): void {
    elementsArray.forEach((rawEl, index) => {
      const element = this.createDOMElement(rawEl, `[${index}]`);
      if (element) {
        elements.push(element);
      }
      
      // Process children if any
      if (rawEl.children && Array.isArray(rawEl.children)) {
        this.extractFromElementsArray(rawEl.children, elements);
      }
    });
  }

  /**
   * Generic extraction for unknown formats
   */
  private extractGeneric(data: any, elements: DOMElement[]): void {
    // Try to find any object that looks like an element
    if (typeof data !== 'object' || data === null) return;
    
    if (data.tag || data.role || data.selector) {
      const element = this.createDOMElement(data, 'unknown');
      if (element) {
        elements.push(element);
      }
    }
    
    // Recursively search in object properties
    Object.values(data).forEach(value => {
      if (Array.isArray(value)) {
        value.forEach(item => this.extractGeneric(item, elements));
      } else if (typeof value === 'object' && value !== null) {
        this.extractGeneric(value, elements);
      }
    });
  }

  /**
   * Create a DOMElement from raw data
   */
  private createDOMElement(raw: any, fallbackPath: string): DOMElement | null {
    if (!raw) return null;
    
    const tag = raw.tag || raw.tagName || raw.role || 'div';
    const selector = this.generateSelector(raw, fallbackPath);
    
    // Skip non-interactive elements unless they have meaningful content
    if (!this.isRelevantElement(raw)) {
      return null;
    }
    
    const element: DOMElement = {
      tag,
      selector,
      text: raw.text || raw.name || raw.innerText || undefined,
      role: raw.role || undefined,
      ariaLabel: raw.ariaLabel || raw['aria-label'] || undefined,
      attributes: this.extractAttributes(raw),
    };
    
    return element;
  }

  /**
   * Generate an optimal selector for an element
   */
  private generateSelector(raw: any, fallbackPath: string): string {
    // Priority 1: data-testid
    if (raw.attributes?.['data-testid']) {
      return `[data-testid="${raw.attributes['data-testid']}"]`;
    }
    
    // Priority 2: id
    if (raw.attributes?.id) {
      return `#${raw.attributes.id}`;
    }
    
    // Priority 3: aria-label
    if (raw.ariaLabel || raw.attributes?.['aria-label']) {
      const label = raw.ariaLabel || raw.attributes['aria-label'];
      return `[aria-label="${label}"]`;
    }
    
    // Priority 4: role + name
    if (raw.role && (raw.name || raw.text)) {
      return `role=${raw.role}[name="${raw.name || raw.text}"]`;
    }
    
    // Priority 5: text content for buttons/links
    if ((raw.role === 'button' || raw.tag === 'button' || raw.tag === 'a') && raw.text) {
      return `text="${raw.text}"`;
    }
    
    // Priority 6: placeholder for inputs
    if ((raw.tag === 'input' || raw.role === 'textbox') && raw.attributes?.placeholder) {
      return `[placeholder="${raw.attributes.placeholder}"]`;
    }
    
    // Priority 7: class
    if (raw.attributes?.class) {
      const classes = raw.attributes.class.split(' ').filter((c: string) => c.length > 0);
      if (classes.length > 0) {
        return `.${classes[0]}`;
      }
    }
    
    // Fallback: use provided selector or path
    return raw.selector || fallbackPath || 'unknown';
  }

  /**
   * Check if element is relevant for test generation
   */
  private isRelevantElement(raw: any): boolean {
    // Interactive elements
    const interactiveTags = ['button', 'input', 'select', 'textarea', 'a'];
    const interactiveRoles = ['button', 'link', 'textbox', 'combobox', 'checkbox', 'radio'];
    
    if (interactiveTags.includes(raw.tag)) return true;
    if (interactiveRoles.includes(raw.role)) return true;
    
    // Elements with meaningful text
    if (raw.text && raw.text.trim().length > 0) return true;
    
    // Elements with aria labels
    if (raw.ariaLabel || raw.attributes?.['aria-label']) return true;
    
    // Headings
    if (raw.tag && /^h[1-6]$/.test(raw.tag)) return true;
    
    return false;
  }

  /**
   * Extract relevant attributes from raw element
   */
  private extractAttributes(raw: any): Record<string, string> {
    const attrs: Record<string, string> = {};
    
    if (raw.attributes) {
      // Copy relevant attributes
      const relevantAttrs = [
        'id', 'class', 'name', 'type', 'value', 
        'placeholder', 'href', 'src', 'alt',
        'data-testid', 'aria-label', 'aria-describedby'
      ];
      
      relevantAttrs.forEach(attr => {
        if (raw.attributes[attr] !== undefined) {
          attrs[attr] = String(raw.attributes[attr]);
        }
      });
    }
    
    return attrs;
  }

  /**
   * Format a single element for display
   */
  private formatElement(el: DOMElement): string {
    const parts: string[] = [];
    
    // Add selector
    parts.push(`  - ${el.selector}`);
    
    // Add text if available
    if (el.text) {
      parts.push(` "${el.text.substring(0, 50)}${el.text.length > 50 ? '...' : ''}"`);
    }
    
    // Add role if available
    if (el.role) {
      parts.push(` [${el.role}]`);
    }
    
    return parts.join('');
  }

  /**
   * Get the most relevant elements for display
   */
  private getTopElements(elements: DOMElement[], limit: number): DOMElement[] {
    // Prioritize interactive elements
    const scored = elements.map(el => ({
      element: el,
      score: this.calculateRelevanceScore(el),
    }));
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    return scored.slice(0, limit).map(s => s.element);
  }

  /**
   * Calculate relevance score for an element
   */
  private calculateRelevanceScore(el: DOMElement): number {
    let score = 0;
    
    // Higher score for interactive elements
    const interactiveTags = ['button', 'input', 'select', 'textarea', 'a'];
    if (interactiveTags.includes(el.tag)) score += 10;
    
    const interactiveRoles = ['button', 'link', 'textbox', 'combobox'];
    if (el.role && interactiveRoles.includes(el.role)) score += 10;
    
    // Higher score for elements with good selectors
    if (el.attributes['data-testid']) score += 8;
    if (el.attributes['id']) score += 5;
    if (el.ariaLabel) score += 5;
    
    // Higher score for elements with text
    if (el.text && el.text.length > 0) score += 3;
    
    return score;
  }
}

/**
 * Factory function to create PageInspectionService
 */
export function createPageInspectionService(): PageInspectionService {
  return new PageInspectionService();
}
