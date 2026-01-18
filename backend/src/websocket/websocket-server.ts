/**
 * WebSocket Server - Real-time communication for human-in-loop testing
 */
import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import {
  ServerEvents,
  ClientEvents,
  StartTestRequest,
  StepApprovalResponse,
  TestSession,
  StepApprovalRequest,
  SnapshotCapturedNotification,
  SnapshotApprovalRequest,
  SnapshotApprovalResponse,
} from '../types/index.js';
import { approvalManager } from '../services/approval-manager.service.js';
import { testOrchestrator } from './websocket-test-orchestrator.js';

export class WebSocketServer {
  private io: SocketIOServer;
  private activeSessions: Map<string, TestSession> = new Map();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*', // Configure appropriately for production
        methods: ['GET', 'POST'],
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`[WebSocket] Client connected: ${socket.id}`);

      // Handle start test request
      socket.on(ClientEvents.START_TEST, async (request: StartTestRequest) => {
        try {
          await this.handleStartTest(socket.id, request);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          socket.emit(ServerEvents.ERROR, {
            message: 'Failed to start test',
            error: errorMessage,
          });
        }
      });

      // Handle step approval
      socket.on(ClientEvents.STEP_APPROVAL, (response: StepApprovalResponse) => {
        try {
          this.handleStepApproval(response);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          socket.emit(ServerEvents.ERROR, {
            message: 'Failed to process approval',
            error: errorMessage,
          });
        }
      });

      // Handle snapshot approval
      socket.on(ClientEvents.SNAPSHOT_APPROVAL, (response: SnapshotApprovalResponse) => {
        try {
          this.handleSnapshotApproval(response);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          socket.emit(ServerEvents.ERROR, {
            message: 'Failed to process snapshot approval',
            error: errorMessage,
          });
        }
      });

      // Handle session cancellation
      socket.on(ClientEvents.CANCEL_SESSION, async (sessionId: string) => {
        try {
          await this.handleCancelSession(sessionId);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          socket.emit(ServerEvents.ERROR, {
            message: 'Failed to cancel session',
            error: errorMessage,
          });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`[WebSocket] Client disconnected: ${socket.id}`);
      });
    });
  }

  private async handleStartTest(
    socketId: string,
    request: StartTestRequest
  ): Promise<void> {
    console.log(`[WebSocket] Starting test for socket ${socketId}`, request);

    // Create session
    const sessionId = this.generateSessionId();
    const session: TestSession = {
      sessionId,
      scenario: request.scenario,
      llmProvider: request.llmProvider || 'groq',
      mcpClient: request.mcpClient,
      state: 'generating',
      currentStepIndex: 0,
      totalSteps: 0,
      steps: [],
      results: [],
      startedAt: new Date(),
    };

    this.activeSessions.set(sessionId, session);

    // Emit session created
    this.io.to(socketId).emit(ServerEvents.SESSION_CREATED, {
      sessionId,
      scenario: request.scenario,
    });

    // Run the test with human-in-loop if requested
    if (request.humanInLoop) {
      await this.runTestWithApproval(
        socketId,
        session,
        request.approvalTimeoutSeconds || 0,
        request.browser || 'chromium',
        request.enablePageAwareGeneration || false,
        request.showSnapshotsForApproval || false
      );
    } else {
      // Run without approval (just like the API endpoint)
      await this.runTestWithoutApproval(socketId, session);
    }
  }

  private async runTestWithApproval(
    socketId: string,
    session: TestSession,
    approvalTimeoutSeconds: number,
    browser: string = 'chromium',
    enablePageAwareGeneration: boolean = false,
    showSnapshotsForApproval: boolean = false
  ): Promise<void> {
    try {
      // If page-aware iterative generation is enabled, use the iterative flow
      if (enablePageAwareGeneration) {
        console.log(`[WebSocket] ✅ USING ITERATIVE GENERATION (Page-Aware Mode)`);
        console.log(`[WebSocket]    - Prevents locator hallucination`);
        console.log(`[WebSocket]    - Generates steps based on actual page elements`);
        await this.runIterativeTestWithApproval(
          socketId,
          session,
          approvalTimeoutSeconds,
          browser,
          showSnapshotsForApproval
        );
        return;
      }

      // Otherwise, use the traditional flow
      console.log(`[WebSocket] ⚠️  USING BATCH GENERATION (Traditional Mode)`);
      console.log(`[WebSocket]    - May hallucinate locators before visiting pages`);
      console.log(`[WebSocket]    - Consider enabling "Page-Aware Generation" for better accuracy`);
      // Generate steps
      session.state = 'generating';
      this.updateSessionStatus(socketId, session);

      const steps = await testOrchestrator.generateSteps(
        session.scenario,
        session.llmProvider
      );

      session.steps = steps;
      session.totalSteps = steps.length;
      session.state = 'awaiting_approval';

      this.io.to(socketId).emit(ServerEvents.STEPS_GENERATED, {
        sessionId: session.sessionId,
        steps,
      });

      // Execute steps one by one with approval
      for (let i = 0; i < steps.length; i++) {
        session.currentStepIndex = i;
        session.state = 'awaiting_approval';
        this.updateSessionStatus(socketId, session);

        // Request approval for this step
        const approvalRequest: StepApprovalRequest = {
          sessionId: session.sessionId,
          stepIndex: i,
          totalSteps: steps.length,
          step: steps[i],
          previousResults: session.results,
          timeoutSeconds: approvalTimeoutSeconds,
        };

        this.io.to(socketId).emit(ServerEvents.STEP_APPROVAL_REQUEST, approvalRequest);

        try {
          // Wait for approval
          const approval = await approvalManager.requestApproval(
            session.sessionId,
            i,
            approvalTimeoutSeconds * 1000
          );

          if (!approval.approved) {
            // Step rejected, mark as skipped
            this.io.to(socketId).emit(ServerEvents.STEP_EXECUTION_UPDATE, {
              sessionId: session.sessionId,
              stepIndex: i,
              status: 'skipped',
              result: {
                stepId: steps[i].id || `step_${i}`,
                action: steps[i].action,
                status: 'skipped',
                message: approval.reason || 'Rejected by user',
                duration: 0,
                timestamp: new Date().toISOString(),
              },
            });
            continue;
          }

          // Execute the step (use modified step if provided)
          const stepToExecute = approval.modifiedStep || steps[i];
          session.state = 'executing';
          this.updateSessionStatus(socketId, session);

          this.io.to(socketId).emit(ServerEvents.STEP_EXECUTION_UPDATE, {
            sessionId: session.sessionId,
            stepIndex: i,
            status: 'started',
          });

          const result = await testOrchestrator.executeStep(
            stepToExecute,
            undefined, // Don't use MCP for human-in-loop
            {
              browser,
              headless: false, // Always visible for human-in-loop
              sessionId: session.sessionId, // Pass sessionId for persistent browser
            }
          );

          session.results.push(result);

          this.io.to(socketId).emit(ServerEvents.STEP_EXECUTION_UPDATE, {
            sessionId: session.sessionId,
            stepIndex: i,
            status: result.status === 'passed' ? 'completed' : 'failed',
            result,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.io.to(socketId).emit(ServerEvents.STEP_EXECUTION_UPDATE, {
            sessionId: session.sessionId,
            stepIndex: i,
            status: 'failed',
            result: {
              stepId: steps[i].id || `step_${i}`,
              action: steps[i].action,
              status: 'failed',
              error: errorMessage,
              duration: 0,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Mark session as completed
      session.state = 'completed';
      session.completedAt = new Date();
      this.updateSessionStatus(socketId, session);

      this.io.to(socketId).emit(ServerEvents.SESSION_COMPLETED, {
        sessionId: session.sessionId,
        results: session.results,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      session.state = 'cancelled';
      this.io.to(socketId).emit(ServerEvents.ERROR, {
        sessionId: session.sessionId,
        message: 'Test execution failed',
        error: errorMessage,
      });
    } finally {
      // Close the persistent browser for this session
      await testOrchestrator.closeSessionExecutor(session.sessionId);
    }
  }

  private async runIterativeTestWithApproval(
    socketId: string,
    session: TestSession,
    approvalTimeoutSeconds: number,
    browser: string = 'chromium',
    showSnapshotsForApproval: boolean = false
  ): Promise<void> {
    try {
      session.state = 'generating';
      this.updateSessionStatus(socketId, session);

      console.log(`[WebSocket] Starting iterative generation for session ${session.sessionId}`);
      console.log(`[WebSocket] Show snapshots for approval: ${showSnapshotsForApproval}`);

      // Run the iterative test with callbacks for approval
      const result = await testOrchestrator.runIterativeTest(
        session.scenario,
        {
          sessionId: session.sessionId,
          llmProvider: session.llmProvider,
          browser,
          headless: false, // Always visible for human-in-loop
          
          // Callback when a step is generated (request approval)
          onStepGenerated: async (step, snapshot) => {
            const stepIndex = session.steps.length;
            session.steps.push(step);
            session.totalSteps = session.steps.length;
            
            // Emit step approval request
            const approvalRequest: StepApprovalRequest = {
              sessionId: session.sessionId,
              stepIndex,
              totalSteps: session.totalSteps,
              step,
              previousResults: session.results,
              timeoutSeconds: approvalTimeoutSeconds,
            };

            this.io.to(socketId).emit(ServerEvents.STEP_APPROVAL_REQUEST, approvalRequest);

            // Wait for user approval
            const approval = await approvalManager.requestApproval(
              session.sessionId,
              stepIndex,
              approvalTimeoutSeconds * 1000
            );

            return approval.approved;
          },

          // Callback when a step is executed
          onStepExecuted: async (stepResult) => {
            const stepIndex = session.results.length;
            session.results.push(stepResult);

            this.io.to(socketId).emit(ServerEvents.STEP_EXECUTION_UPDATE, {
              sessionId: session.sessionId,
              stepIndex,
              status: stepResult.status === 'passed' ? 'completed' : 'failed',
              result: stepResult,
            });
          },

          // Callback when a snapshot is captured (notification only)
          onSnapshotCaptured: async (snapshot) => {
            const notification: SnapshotCapturedNotification = {
              sessionId: session.sessionId,
              stepIndex: session.steps.length,
              snapshot,
            };
            this.io.to(socketId).emit(ServerEvents.SNAPSHOT_CAPTURED, notification);
          },

          // Callback for snapshot approval (if required)
          onSnapshotApproval: showSnapshotsForApproval ? async (snapshot) => {
            const stepIndex = session.steps.length;
            
            // Create page inspection service to generate summary
            const { PageInspectionService } = await import('../services/page-inspection.service.js');
            const pageInspection = new PageInspectionService();
            const summary = pageInspection.createSummary(snapshot);
            
            const approvalRequest: SnapshotApprovalRequest = {
              sessionId: session.sessionId,
              stepIndex,
              snapshot,
              summary,
              timeoutSeconds: approvalTimeoutSeconds,
            };

            this.io.to(socketId).emit(ServerEvents.SNAPSHOT_APPROVAL_REQUEST, approvalRequest);

            // Wait for user approval
            const approval = await approvalManager.requestSnapshotApproval(
              session.sessionId,
              stepIndex,
              approvalTimeoutSeconds * 1000
            );

            return approval.approved;
          } : undefined,
        }
      );

      // Update session with final results
      session.state = result.status === 'completed' ? 'completed' : 'cancelled';
      session.completedAt = new Date();
      
      this.io.to(socketId).emit(ServerEvents.SESSION_COMPLETED, {
        sessionId: session.sessionId,
        results: session.results,
        status: result.status,
        intentions: result.intentions,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      session.state = 'cancelled';
      this.io.to(socketId).emit(ServerEvents.ERROR, {
        sessionId: session.sessionId,
        message: 'Iterative test execution failed',
        error: errorMessage,
      });
    } finally {
      await testOrchestrator.closeSessionExecutor(session.sessionId);
    }
  }

  private async runTestWithoutApproval(
    socketId: string,
    session: TestSession
  ): Promise<void> {
    try {
      // This follows the same flow as the API endpoint
      const result = await testOrchestrator.runTest(
        session.scenario,
        session.llmProvider,
        true,
        session.mcpClient
      );

      session.steps = result.generatedSteps;
      session.totalSteps = result.generatedSteps.length;
      session.results = result.executionResult?.results || [];
      session.state = 'completed';
      session.completedAt = new Date();

      this.io.to(socketId).emit(ServerEvents.SESSION_COMPLETED, {
        sessionId: session.sessionId,
        results: session.results,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      session.state = 'cancelled';
      this.io.to(socketId).emit(ServerEvents.ERROR, {
        sessionId: session.sessionId,
        message: 'Test execution failed',
        error: errorMessage,
      });
    }
  }

  private handleStepApproval(response: StepApprovalResponse): void {
    const processed = approvalManager.respondToApproval(response);
    if (!processed) {
      console.warn(
        `[WebSocket] Received approval for unknown step: ${response.sessionId}:${response.stepIndex}`
      );
    }
  }

  private handleSnapshotApproval(response: SnapshotApprovalResponse): void {
    const processed = approvalManager.respondToSnapshotApproval(response);
    if (!processed) {
      console.warn(
        `[WebSocket] Received snapshot approval for unknown step: ${response.sessionId}:${response.stepIndex}`
      );
    }
  }

  private async handleCancelSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.state = 'cancelled';
      approvalManager.cancelSession(sessionId);
      this.activeSessions.delete(sessionId);
      // Close the persistent browser for this session
      await testOrchestrator.closeSessionExecutor(sessionId);
      console.log(`[WebSocket] Session cancelled: ${sessionId}`);
    }
  }

  private updateSessionStatus(socketId: string, session: TestSession): void {
    this.io.to(socketId).emit(ServerEvents.SESSION_STATUS, {
      sessionId: session.sessionId,
      state: session.state,
    });
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  public emitSnapshotCaptured(
    socketId: string,
    notification: SnapshotCapturedNotification
  ): void {
    this.io.to(socketId).emit(ServerEvents.SNAPSHOT_CAPTURED, notification);
  }

  public emitSnapshotApprovalRequest(
    socketId: string,
    request: SnapshotApprovalRequest
  ): void {
    this.io.to(socketId).emit(ServerEvents.SNAPSHOT_APPROVAL_REQUEST, request);
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  public close(): void {
    approvalManager.clearAll();
    this.io.close();
  }
}
