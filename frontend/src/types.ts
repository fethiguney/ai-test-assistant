export interface TestStep {
  action: string
  target?: string
  value?: string
  description?: string
}

export interface TestStepResult {
  step: TestStep
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  error?: string
}

export interface TestExecutionResult {
  id: string
  status: 'passed' | 'failed' | 'error'
  totalDuration: number
  steps: TestStepResult[]
}

export interface DynamicTestRunResponse {
  id: string
  prompt: string
  generatedSteps: TestStep[]
  llmUsed: {
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
