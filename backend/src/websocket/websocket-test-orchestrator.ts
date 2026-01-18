/**
 * WebSocket Test Orchestrator - Simplified orchestrator for WebSocket sessions
 */
import { llmManager } from '../llm/index.js';
import { TestGeneratorService } from '../services/test-generator.service.js';
import { StepExecutorService } from '../services/step-executor.service.js';
import { PageInspectionService } from '../services/page-inspection.service.js';
import { mcpManager } from '../mcp/index.js';
import { TestStep, TestStepResult, DynamicTestRunRequest, DynamicTestRunResponse, PageSnapshot, IterativeStepRequest } from '../types/index.js';

class WebSocketTestOrchestrator {
  private testGenerator: TestGeneratorService;
  private stepExecutor: StepExecutorService;
  private pageInspection: PageInspectionService;
  private sessionExecutors: Map<string, StepExecutorService> = new Map();

  constructor() {
    this.testGenerator = new TestGeneratorService(llmManager);
    this.stepExecutor = new StepExecutorService();
    this.pageInspection = new PageInspectionService();
  }

  /**
   * Create a persistent executor for a session (keeps browser open)
   */
  createSessionExecutor(sessionId: string): StepExecutorService {
    const executor = new StepExecutorService();
    executor.enablePersistentBrowser();
    this.sessionExecutors.set(sessionId, executor);
    return executor;
  }

  /**
   * Get or create session executor
   */
  getSessionExecutor(sessionId: string): StepExecutorService {
    let executor = this.sessionExecutors.get(sessionId);
    if (!executor) {
      executor = this.createSessionExecutor(sessionId);
    }
    return executor;
  }

  /**
   * Close session executor and cleanup
   */
  async closeSessionExecutor(sessionId: string): Promise<void> {
    const executor = this.sessionExecutors.get(sessionId);
    if (executor) {
      await executor.closeBrowser();
      this.sessionExecutors.delete(sessionId);
    }
  }

  /**
   * Generate test steps from a scenario
   */
  async generateSteps(scenario: string, llmProvider?: string): Promise<TestStep[]> {
    // Set active provider if specified
    if (llmProvider) {
      llmManager.setActiveProvider(llmProvider as any);
    }
    
    const response = await this.testGenerator.generateSteps({ scenario });
    return response.steps;
  }

  /**
   * Execute a single step
   * For human-in-loop mode with sessionId, uses persistent browser
   */
  async executeStep(
    step: TestStep,
    mcpClient?: string,
    options?: { browser?: string; headless?: boolean; sessionId?: string }
  ): Promise<TestStepResult> {
    // For human-in-loop with sessionId, always use direct execution with persistent browser
    if (options?.sessionId) {
      const executor = this.getSessionExecutor(options.sessionId);
      const result = await executor.execute({
        steps: [step],
        browser: options?.browser as any,
        options: {
          headless: options?.headless ?? false,
        },
      });
      if (!result.steps || result.steps.length === 0) {
        throw new Error('No results returned from step executor');
      }
      return result.steps[0];
    }
    
    // For non-human-in-loop mode, use MCP if specified
    if (mcpClient) {
      // Use MCP client
      const client = mcpManager.getClient(mcpClient as any);
      if (!client) {
        throw new Error(`MCP client not found: ${mcpClient}`);
      }

      const response = await client.executeSteps({ steps: [step] });
      if (!response.steps || response.steps.length === 0) {
        throw new Error('No results returned from MCP client');
      }
      return response.steps[0];
    } else {
      // Use direct Playwright execution
      const result = await this.stepExecutor.execute({
        steps: [step],
        browser: options?.browser as any,
        options: {
          headless: options?.headless,
        },
      });
      if (!result.steps || result.steps.length === 0) {
        throw new Error('No results returned from step executor');
      }
      return result.steps[0];
    }
  }

  /**
   * Run full test (generation + execution)
   */
  async runTest(scenario: string, llmProvider?: string, executeImmediately?: boolean, mcpClient?: string): Promise<any> {
    const steps = await this.generateSteps(scenario, llmProvider);

    const activeProvider = llmManager.getActiveProvider();
    const providerName = activeProvider ? (activeProvider as any).name || 'unknown' : 'unknown';

    if (!executeImmediately) {
      return {
        sessionId: `session_${Date.now()}`,
        generatedSteps: steps,
        llmProvider: llmProvider || providerName,
      };
    }

    // Execute all steps
    let executionResult;
    if (mcpClient) {
      const client = mcpManager.getClient(mcpClient as any);
      if (!client) {
        throw new Error(`MCP client not found: ${mcpClient}`);
      }
      executionResult = await client.executeSteps({ steps });
    } else {
      executionResult = await this.stepExecutor.execute({ steps });
    }

    return {
      sessionId: `session_${Date.now()}`,
      generatedSteps: steps,
      executionResult,
      llmProvider: llmProvider || providerName,
      mcpClient,
    };
  }

  /**
   * Run iterative test with page-aware generation
   * 
   * This method generates steps one at a time based on the actual page state,
   * eliminating hallucinations and improving selector accuracy.
   * 
   * @param scenario - Natural language test scenario
   * @param options - Configuration options
   * @returns Test results with all executed steps
   */
  async runIterativeTest(
    scenario: string,
    options: {
      sessionId: string;
      llmProvider?: string;
      browser?: string;
      headless?: boolean;
      onStepGenerated?: (step: TestStep, snapshot?: PageSnapshot) => Promise<boolean>;
      onStepExecuted?: (result: TestStepResult) => Promise<void>;
      onSnapshotCaptured?: (snapshot: PageSnapshot) => Promise<void>;
    }
  ): Promise<{
    sessionId: string;
    scenario: string;
    intentions: string[];
    steps: TestStep[];
    results: TestStepResult[];
    status: 'completed' | 'failed' | 'cancelled';
  }> {
    const { sessionId, llmProvider, browser = 'chromium', headless = false } = options;

    // Set active LLM provider if specified
    if (llmProvider) {
      llmManager.setActiveProvider(llmProvider as any);
    }

    console.log(`[IterativeTest] Starting for session ${sessionId}`);
    console.log(`[IterativeTest] Scenario: ${scenario}`);

    const startTime = Date.now();
    const executedSteps: TestStep[] = [];
    const results: TestStepResult[] = [];
    let currentPageSnapshot: PageSnapshot | undefined;
    let status: 'completed' | 'failed' | 'cancelled' = 'completed';

    try {
      // Step 1: Parse scenario into abstract intentions
      console.log('[IterativeTest] Parsing scenario into intentions...');
      const intentions = await this.testGenerator.parseScenarioIntent(scenario);
      console.log(`[IterativeTest] Found ${intentions.length} intentions:`, intentions);

      // Get or create session executor for persistent browser
      const executor = this.getSessionExecutor(sessionId);

      // Step 2: Process each intention iteratively
      for (let i = 0; i < intentions.length; i++) {
        const intention = intentions[i];
        console.log(`[IterativeTest] Processing intention ${i + 1}/${intentions.length}: ${intention}`);

        try {
          // Check if this intention requires navigation
          const needsNavigation = this.isNavigationIntention(intention) || i === 0;

          // If navigation is needed and we don't have a snapshot, generate and execute navigation step
          if (needsNavigation && !currentPageSnapshot) {
            console.log('[IterativeTest] Generating navigation step...');
            
            // Generate navigation step without page context
            // Include the full scenario to help LLM extract the correct URL
            const navRequest: IterativeStepRequest = {
              scenario: `${intention}. Full context: ${scenario}`,
              previousSteps: executedSteps,
              requiresPageContext: false,
            };

            const navStep = await this.testGenerator.generateNextStep(navRequest);
            console.log('[IterativeTest] Generated navigation step:', navStep);

            // Request approval if callback provided
            if (options.onStepGenerated) {
              const approved = await options.onStepGenerated(navStep, undefined);
              if (!approved) {
                console.log('[IterativeTest] Navigation step rejected by user');
                status = 'cancelled';
                break;
              }
            }

            // Execute navigation
            const navResult = await executor.execute({
              steps: [navStep],
              browser: browser as any,
              options: { headless },
            });

            const navStepResult = navResult.steps[0];
            executedSteps.push(navStep);
            results.push(navStepResult);

            if (options.onStepExecuted) {
              await options.onStepExecuted(navStepResult);
            }

            if (navStepResult.status === 'failed') {
              console.error('[IterativeTest] Navigation failed:', navStepResult.error);
              status = 'failed';
              break;
            }

            // Capture snapshot after navigation
            console.log('[IterativeTest] Capturing page snapshot...');
            currentPageSnapshot = await this.capturePageSnapshot(executor);
            console.log(`[IterativeTest] Captured snapshot: ${currentPageSnapshot.elements.length} elements`);

            if (options.onSnapshotCaptured) {
              await options.onSnapshotCaptured(currentPageSnapshot);
            }

            // If this was only navigation, continue to next intention
            if (this.isNavigationIntention(intention)) {
              continue;
            }
          }

          // Generate concrete step with page context
          console.log('[IterativeTest] Generating step with page context...');
          const stepRequest: IterativeStepRequest = {
            scenario: intention,
            previousSteps: executedSteps,
            currentPageSnapshot,
            requiresPageContext: true,
          };

          const step = await this.testGenerator.generateNextStep(stepRequest);
          console.log('[IterativeTest] Generated step:', step);

          // Request approval if callback provided
          if (options.onStepGenerated) {
            const approved = await options.onStepGenerated(step, currentPageSnapshot);
            if (!approved) {
              console.log('[IterativeTest] Step rejected by user');
              status = 'cancelled';
              break;
            }
          }

          // Execute the step
          console.log('[IterativeTest] Executing step...');
          const execResult = await executor.execute({
            steps: [step],
            browser: browser as any,
            options: { headless },
          });

          const stepResult = execResult.steps[0];
          executedSteps.push(step);
          results.push(stepResult);

          if (options.onStepExecuted) {
            await options.onStepExecuted(stepResult);
          }

          if (stepResult.status === 'failed') {
            console.error('[IterativeTest] Step execution failed:', stepResult.error);
            status = 'failed';
            break;
          }

          // Check if step changed the page (requires new snapshot)
          if (this.isPageChangingAction(step.action)) {
            console.log('[IterativeTest] Page-changing action detected, capturing new snapshot...');
            
            // Wait a bit for page to settle
            await new Promise(resolve => setTimeout(resolve, 500));
            
            currentPageSnapshot = await this.capturePageSnapshot(executor);
            console.log(`[IterativeTest] Captured new snapshot: ${currentPageSnapshot.elements.length} elements`);

            if (options.onSnapshotCaptured) {
              await options.onSnapshotCaptured(currentPageSnapshot);
            }
          }

        } catch (error) {
          console.error(`[IterativeTest] Error processing intention "${intention}":`, error);
          status = 'failed';
          
          // Add failed result for this intention
          results.push({
            step: {
              action: 'error',
              description: `Failed to process: ${intention}`,
            },
            status: 'failed',
            duration: 0,
            error: error instanceof Error ? error.message : String(error),
          });
          
          break;
        }
      }

      const totalDuration = Date.now() - startTime;
      console.log(`[IterativeTest] Completed in ${totalDuration}ms with status: ${status}`);
      console.log(`[IterativeTest] Total steps executed: ${executedSteps.length}`);
      console.log(`[IterativeTest] Passed: ${results.filter(r => r.status === 'passed').length}`);
      console.log(`[IterativeTest] Failed: ${results.filter(r => r.status === 'failed').length}`);

      return {
        sessionId,
        scenario,
        intentions,
        steps: executedSteps,
        results,
        status,
      };

    } catch (error) {
      console.error('[IterativeTest] Fatal error:', error);
      return {
        sessionId,
        scenario,
        intentions: [],
        steps: executedSteps,
        results,
        status: 'failed',
      };
    }
  }

  /**
   * Capture page snapshot using the current browser state
   * 
   * @param executor - Step executor with active browser
   * @returns Page snapshot
   */
  private async capturePageSnapshot(executor: StepExecutorService): Promise<PageSnapshot> {
    const page = executor.getCurrentPage();
    
    if (!page) {
      throw new Error('No active page available for snapshot');
    }

    try {
      // Get basic page info
      const url = page.url();
      const title = await page.title();

      // Capture interactive elements using Playwright locators
      const elements = await this.extractPageElements(page);

      const snapshot: PageSnapshot = {
        url,
        title,
        elements,
        timestamp: new Date(),
      };

      return snapshot;
    } catch (error) {
      console.error('[IterativeTest] Failed to capture page snapshot:', error);
      
      // Return minimal snapshot on error
      return {
        url: 'unknown',
        title: 'Error capturing snapshot',
        elements: [],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Extract interactive elements from the page
   * 
   * @param page - Playwright page instance
   * @returns Array of DOM elements
   */
  private async extractPageElements(page: any): Promise<any[]> {
    try {
      // Use Playwright's evaluate to extract element information from the page
      // Pass the extraction logic as a string to avoid TypeScript compilation issues
      const elements = await page.evaluate(`(() => {
        const results = [];
        
        // Helper to generate selector
        function generateSelector(el) {
          // Priority 1: data-testid
          if (el.hasAttribute('data-testid')) {
            return '[data-testid="' + el.getAttribute('data-testid') + '"]';
          }
          
          // Priority 2: id
          if (el.id) {
            return '#' + el.id;
          }
          
          // Priority 3: aria-label
          if (el.hasAttribute('aria-label')) {
            return '[aria-label="' + el.getAttribute('aria-label') + '"]';
          }
          
          // Priority 4: name attribute
          if (el.hasAttribute('name')) {
            return '[name="' + el.getAttribute('name') + '"]';
          }
          
          // Priority 5: class (first class only)
          if (el.className && typeof el.className === 'string') {
            const classes = el.className.split(' ').filter(function(c) { return c.length > 0; });
            if (classes.length > 0) {
              return '.' + classes[0];
            }
          }
          
          // Fallback: tag name
          return el.tagName.toLowerCase();
        }

        const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]');
        buttons.forEach(function(btn) {
          results.push({
            tag: btn.tagName.toLowerCase(),
            selector: generateSelector(btn),
            text: (btn.textContent || '').trim(),
            role: btn.getAttribute('role') || 'button',
            ariaLabel: btn.getAttribute('aria-label') || undefined,
            attributes: {
              id: btn.id || undefined,
              class: btn.className || undefined,
              type: btn.getAttribute('type') || undefined,
              name: btn.getAttribute('name') || undefined,
              'data-testid': btn.getAttribute('data-testid') || undefined,
            },
          });
        });

        const inputs = document.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea');
        inputs.forEach(function(input) {
          results.push({
            tag: input.tagName.toLowerCase(),
            selector: generateSelector(input),
            text: '',
            role: input.getAttribute('role') || 'textbox',
            ariaLabel: input.getAttribute('aria-label') || undefined,
            attributes: {
              id: input.id || undefined,
              class: input.className || undefined,
              type: input.getAttribute('type') || 'text',
              name: input.getAttribute('name') || undefined,
              placeholder: input.getAttribute('placeholder') || undefined,
              'data-testid': input.getAttribute('data-testid') || undefined,
            },
          });
        });

        const links = document.querySelectorAll('a[href]');
        links.forEach(function(link) {
          results.push({
            tag: 'a',
            selector: generateSelector(link),
            text: (link.textContent || '').trim(),
            role: 'link',
            ariaLabel: link.getAttribute('aria-label') || undefined,
            attributes: {
              id: link.id || undefined,
              class: link.className || undefined,
              href: link.getAttribute('href') || undefined,
              'data-testid': link.getAttribute('data-testid') || undefined,
            },
          });
        });

        const selects = document.querySelectorAll('select');
        selects.forEach(function(select) {
          results.push({
            tag: 'select',
            selector: generateSelector(select),
            text: '',
            role: 'combobox',
            ariaLabel: select.getAttribute('aria-label') || undefined,
            attributes: {
              id: select.id || undefined,
              class: select.className || undefined,
              name: select.getAttribute('name') || undefined,
              'data-testid': select.getAttribute('data-testid') || undefined,
            },
          });
        });

        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(function(checkbox) {
          results.push({
            tag: 'input',
            selector: generateSelector(checkbox),
            text: '',
            role: 'checkbox',
            ariaLabel: checkbox.getAttribute('aria-label') || undefined,
            attributes: {
              id: checkbox.id || undefined,
              class: checkbox.className || undefined,
              type: 'checkbox',
              name: checkbox.getAttribute('name') || undefined,
              'data-testid': checkbox.getAttribute('data-testid') || undefined,
            },
          });
        });

        return results;
      })()`);

      console.log(`[IterativeTest] Extracted ${elements.length} elements from page`);
      return elements;
    } catch (error) {
      console.error('[IterativeTest] Failed to extract page elements:', error);
      return [];
    }
  }

  /**
   * Check if an intention is a navigation action
   */
  private isNavigationIntention(intention: string): boolean {
    const navKeywords = [
      'navigate',
      'go to',
      'open',
      'visit',
      'load',
      'browse to',
    ];
    
    const lower = intention.toLowerCase();
    return navKeywords.some(keyword => lower.includes(keyword));
  }

  /**
   * Check if an action changes the page state (requiring a new snapshot)
   */
  private isPageChangingAction(action: string): boolean {
    const pageChangingActions = [
      'click',
      'submit',
      'goto',
      'select',
      'check',
      'uncheck',
    ];
    
    return pageChangingActions.includes(action.toLowerCase());
  }
}

export const testOrchestrator = new WebSocketTestOrchestrator();
