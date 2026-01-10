import { DynamicTestRunResponse } from '../types'
import './TestResults.css'

interface Props {
  result: DynamicTestRunResponse
}

export default function TestResults({ result }: Props) {
  return (
    <div className="test-results">
      <div className="results-header">
        <h2>Test Results</h2>
        <span className={`status-badge ${result.status}`}>
          {result.status === 'executed' ? '✅ Executed' : '📝 Generated'}
        </span>
      </div>

      <div className="result-card">
        <h3>Execution Info</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="label">LLM Provider:</span>
            <span className="value">{result.llmUsed.provider}</span>
          </div>
          <div className="info-item">
            <span className="label">Model:</span>
            <span className="value">{result.llmUsed.model}</span>
          </div>
          <div className="info-item">
            <span className="label">Generation Time:</span>
            <span className="value">{result.llmUsed.latencyMs}ms</span>
          </div>
          {result.executionMethod && (
            <div className="info-item">
              <span className="label">Execution Method:</span>
              <span className="value">{result.executionMethod === 'mcp' ? 'MCP Protocol' : 'Direct'}</span>
            </div>
          )}
          {result.mcpClient && (
            <div className="info-item">
              <span className="label">MCP Client:</span>
              <span className="value">{result.mcpClient}</span>
            </div>
          )}
        </div>
      </div>

      <div className="result-card">
        <h3>Generated Steps ({result.generatedSteps.length})</h3>
        <div className="steps-list">
          {result.generatedSteps.map((step, i) => (
            <div key={i} className="step-item">
              <div className="step-number">{i + 1}</div>
              <div className="step-content">
                <div className="step-action">{step.action}</div>
                {step.target && <div className="step-target">Target: {step.target}</div>}
                {step.value && <div className="step-value">Value: {step.value}</div>}
                {step.description && <div className="step-description">{step.description}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {result.execution && (
        <div className="result-card">
          <h3>Execution Results</h3>
          <div className="execution-summary">
            <div className={`execution-status ${result.execution.status}`}>
              {result.execution.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}
            </div>
            <div className="execution-duration">
              Duration: {result.execution.totalDuration}ms
            </div>
          </div>

          <div className="execution-steps">
            {result.execution.steps.map((stepResult, i) => (
              <div key={i} className={`execution-step ${stepResult.status}`}>
                <div className="step-header">
                  <span className="step-icon">
                    {stepResult.status === 'passed' ? '✅' : '❌'}
                  </span>
                  <span className="step-action">{stepResult.step.action}</span>
                  <span className="step-duration">{stepResult.duration}ms</span>
                </div>
                {stepResult.error && (
                  <div className="step-error">Error: {stepResult.error}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
