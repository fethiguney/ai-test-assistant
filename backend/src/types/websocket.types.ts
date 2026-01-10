/**
 * WebSocket Types - Human-in-Loop approval types
 */
import { TestStep, TestStepResult } from './test.types.js';

/**
 * Approval status for a test step
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'timeout';

/**
 * Test session state
 */
export type SessionState = 'idle' | 'generating' | 'awaiting_approval' | 'executing' | 'completed' | 'cancelled';

/**
 * Test session information
 */
export interface TestSession {
  sessionId: string;
  userId?: string;
  scenario: string;
  llmProvider: string;
  mcpClient?: string;
  state: SessionState;
  currentStepIndex: number;
  totalSteps: number;
  steps: TestStep[];
  results: TestStepResult[];
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Step approval request sent to client
 */
export interface StepApprovalRequest {
  sessionId: string;
  stepIndex: number;
  totalSteps: number;
  step: TestStep;
  previousResults: TestStepResult[];
  timeoutSeconds?: number;
}

/**
 * Step approval response from client
 */
export interface StepApprovalResponse {
  sessionId: string;
  stepIndex: number;
  approved: boolean;
  modifiedStep?: TestStep; // Allow client to modify step before execution
  reason?: string;
}

/**
 * Step execution update sent to client
 */
export interface StepExecutionUpdate {
  sessionId: string;
  stepIndex: number;
  status: 'started' | 'completed' | 'failed' | 'skipped';
  result?: TestStepResult;
}

/**
 * Session status update
 */
export interface SessionStatusUpdate {
  sessionId: string;
  state: SessionState;
  message?: string;
  error?: string;
}

/**
 * WebSocket event names (Server -> Client)
 */
export enum ServerEvents {
  SESSION_CREATED = 'session:created',
  SESSION_STATUS = 'session:status',
  STEPS_GENERATED = 'steps:generated',
  STEP_APPROVAL_REQUEST = 'step:approval_request',
  STEP_EXECUTION_UPDATE = 'step:execution_update',
  SESSION_COMPLETED = 'session:completed',
  ERROR = 'error',
}

/**
 * WebSocket event names (Client -> Server)
 */
export enum ClientEvents {
  START_TEST = 'test:start',
  STEP_APPROVAL = 'step:approval',
  CANCEL_SESSION = 'session:cancel',
}

/**
 * Start test request from client
 */
export interface StartTestRequest {
  scenario: string;
  llmProvider?: string;
  mcpClient?: string;
  humanInLoop: boolean;
  approvalTimeoutSeconds?: number;
}

/**
 * Approval manager state
 */
export interface ApprovalState {
  pending: Map<string, {
    resolve: (value: StepApprovalResponse) => void;
    reject: (reason?: any) => void;
    timeoutHandle?: NodeJS.Timeout;
  }>;
}
