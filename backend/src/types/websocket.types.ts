/**
 * WebSocket Types - Human-in-Loop approval types
 */
import { TestStep, TestStepResult, BrowserType, PageSnapshot, SnapshotSummary } from './test.types.js';

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
 * Snapshot captured notification sent to client
 */
export interface SnapshotCapturedNotification {
  sessionId: string;
  url: string;
  title: string;
  timestamp: Date;
  summary?: SnapshotSummary; // Include summary if approval enabled
}

/**
 * Snapshot approval request sent to client
 */
export interface SnapshotApprovalRequest {
  sessionId: string;
  stepIndex: number;
  snapshot: PageSnapshot;
  summary: SnapshotSummary;
  proposedStep?: TestStep; // The step that will be executed based on this snapshot
  timeoutSeconds?: number;
}

/**
 * Snapshot approval response from client
 */
export interface SnapshotApprovalResponse {
  sessionId: string;
  stepIndex: number;
  approved: boolean;
  modifiedSelector?: string; // Allow client to modify the selector
  skipSnapshot?: boolean; // User can choose to skip snapshot-based validation
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
  SNAPSHOT_CAPTURED = 'snapshot:captured',
  SNAPSHOT_APPROVAL_REQUEST = 'snapshot:approval_request',
  ERROR = 'error',
}

/**
 * WebSocket event names (Client -> Server)
 */
export enum ClientEvents {
  START_TEST = 'test:start',
  STEP_APPROVAL = 'step:approval',
  SNAPSHOT_APPROVAL = 'snapshot:approval',
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
  browser?: BrowserType;
  enableIterativeGeneration?: boolean; // Enable page-aware iterative generation
  snapshotApprovalRequired?: boolean; // Require approval for snapshots (human-in-loop only)
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
