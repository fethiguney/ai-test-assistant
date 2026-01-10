// ============================================
// Browser Types
// ============================================

export type BrowserType = 'chromium' | 'firefox' | 'webkit';

// ============================================
// Test Step Types
// ============================================

export interface TestStep {
  id: string
  action: string
  target?: string
  value?: string
  description?: string
}

export interface TestStepResult {
  stepId: string
  action: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  message?: string
  error?: string
  screenshot?: string
  timestamp: string
}

export interface TestExecutionResult {
  id: string
  status: 'passed' | 'failed' | 'error'
  totalDuration: number
  steps: TestStepResult[]
  results: TestStepResult[]
}

export interface DynamicTestRunResponse {
  id: string
  prompt: string
  generatedSteps: TestStep[]
  llmUsed?: {
    provider: string
    model: string
    latencyMs: number
  }
  executionMethod?: 'direct' | 'mcp'
  mcpClient?: string
  execution?: TestExecutionResult
  status: 'generated' | 'executed'
  timestamp: string
}

export interface LLMProviderSummary {
  name: string
  type: string
  active: boolean
}

export interface MCPClientSummary {
  name: string
  type: string
  active: boolean
}

// WebSocket Types
export type SessionState = 'idle' | 'generating' | 'awaiting_approval' | 'executing' | 'completed' | 'cancelled'

export interface StepApprovalRequest {
  sessionId: string
  stepIndex: number
  totalSteps: number
  step: TestStep
  previousResults: TestStepResult[]
  timeoutSeconds?: number
}

export interface StepApprovalResponse {
  sessionId: string
  stepIndex: number
  approved: boolean
  modifiedStep?: TestStep
  reason?: string
}

export interface StepExecutionUpdate {
  sessionId: string
  stepIndex: number
  status: 'started' | 'completed' | 'failed' | 'skipped'
  result?: TestStepResult
}

export interface SessionStatusUpdate {
  sessionId: string
  state: SessionState
  message?: string
  error?: string
}

export interface StartTestRequest {
  scenario: string
  llmProvider?: string
  mcpClient?: string
  humanInLoop: boolean
  approvalTimeoutSeconds?: number
  browser?: BrowserType
  executionOptions?: {
    headless?: boolean
    timeout?: number
    screenshot?: boolean
  }
}

export enum ServerEvents {
  SESSION_CREATED = 'session:created',
  SESSION_STATUS = 'session:status',
  STEPS_GENERATED = 'steps:generated',
  STEP_APPROVAL_REQUEST = 'step:approval_request',
  STEP_EXECUTION_UPDATE = 'step:execution_update',
  SESSION_COMPLETED = 'session:completed',
  ERROR = 'error',
}

export enum ClientEvents {
  START_TEST = 'test:start',
  STEP_APPROVAL = 'step:approval',
  CANCEL_SESSION = 'session:cancel',
}
