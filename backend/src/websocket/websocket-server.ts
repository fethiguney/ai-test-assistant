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

      // Handle session cancellation
      socket.on(ClientEvents.CANCEL_SESSION, (sessionId: string) => {
        try {
          this.handleCancelSession(sessionId);
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
        request.approvalTimeoutSeconds || 0
      );
    } else {
      // Run without approval (just like the API endpoint)
      await this.runTestWithoutApproval(socketId, session);
    }
  }

  private async runTestWithApproval(
    socketId: string,
    session: TestSession,
    approvalTimeoutSeconds: number
  ): Promise<void> {
    try {
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
            session.mcpClient
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

  private handleCancelSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.state = 'cancelled';
      approvalManager.cancelSession(sessionId);
      this.activeSessions.delete(sessionId);
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

  public getIO(): SocketIOServer {
    return this.io;
  }

  public close(): void {
    approvalManager.clearAll();
    this.io.close();
  }
}
