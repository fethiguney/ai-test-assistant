import { useState } from "react";
import TestPromptInput from "./components/TestPromptInput";
import TestResults from "./components/TestResults";
import { StepApproval } from "./components/StepApproval";
import { useWebSocket } from "./hooks/useWebSocket";
import {
  DynamicTestRunResponse,
  StepApprovalRequest,
  StepExecutionUpdate,
  SessionStatusUpdate,
  TestStep,
  TestStepResult,
  SessionState,
  BrowserType,
} from "./types";
import "./App.css";

type ExecutionMode = "api" | "websocket";

function App() {
  // API-based state
  const [result, setResult] = useState<DynamicTestRunResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Execution mode
  const [mode, setMode] = useState<ExecutionMode>("api");

  // WebSocket-based state
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [generatedSteps, setGeneratedSteps] = useState<TestStep[]>([]);
  const [currentApprovalRequest, setCurrentApprovalRequest] =
    useState<StepApprovalRequest | null>(null);
  const [executionResults, setExecutionResults] = useState<TestStepResult[]>(
    []
  );
  const [stepUpdates, setStepUpdates] = useState<
    Map<number, StepExecutionUpdate>
  >(new Map());

  const {
    isConnected,
    currentSessionId,
    startTest,
    approveStep,
    cancelSession,
  } = useWebSocket({
    onStepsGenerated: (steps: TestStep[]) => {
      console.log("Steps generated:", steps);
      setGeneratedSteps(steps);
    },
    onApprovalRequest: (request: StepApprovalRequest) => {
      console.log("Approval request:", request);
      setCurrentApprovalRequest(request);
    },
    onStepUpdate: (update: StepExecutionUpdate) => {
      console.log("Step update:", update);
      setStepUpdates((prev) => new Map(prev).set(update.stepIndex, update));
      if (update.result) {
        setExecutionResults((prev) => [...prev, update.result!]);
      }
    },
    onSessionStatus: (status: SessionStatusUpdate) => {
      console.log("Session status:", status);
      setSessionState(status.state);
    },
    onSessionCompleted: (data: any) => {
      console.log("Session completed:", data);
      setSessionState("completed");
      setCurrentApprovalRequest(null);
      setLoading(false); // Ensure loading is false
      // Keep results visible (no auto-reset to idle, like API mode)
    },
    onError: (error: any) => {
      console.error("WebSocket error:", error);
      alert(`Error: ${error.message || "Unknown error"}`);
      setSessionState("idle"); // Reset on error
      setLoading(false); // Ensure loading is false
    },
  });

  const handleTestRun = async (
    prompt: string,
    llmProvider: string,
    mcpClient: string,
    executeImmediately: boolean,
    browser: BrowserType,
    headless: boolean,
    enablePageAware: boolean,
    showSnapshotsForApproval: boolean
  ) => {
    if (mode === "websocket") {
      // Use WebSocket with human-in-loop
      // Clear previous results when starting a new test
      setLoading(false); // Ensure loading is false for WebSocket mode
      setSessionState("generating");
      setGeneratedSteps([]);
      setCurrentApprovalRequest(null);
      setExecutionResults([]);
      setStepUpdates(new Map());

      startTest({
        scenario: prompt,
        llmProvider: llmProvider === "auto" ? undefined : llmProvider,
        mcpClient: mcpClient || undefined,
        humanInLoop: true,
        approvalTimeoutSeconds: 300, // 5 minutes
        browser,
        enablePageAwareGeneration: enablePageAware,
        showSnapshotsForApproval: showSnapshotsForApproval,
        executionOptions: {
          headless: false, // Always visible in human-in-loop mode
          screenshot: true,
        },
      });
    } else {
      // Use API (existing behavior)
      setLoading(true);
      setResult(null);

      try {
        const response = await fetch("/api/test/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            llmProvider: llmProvider === "auto" ? undefined : llmProvider,
            mcpClient,
            executeImmediately,
            browser,
            enablePageAwareGeneration: enablePageAware,
            executionOptions: {
              headless,
              screenshot: true,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        setResult(data);
      } catch (error) {
        console.error("Test run failed:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        alert(`Failed to run test: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleApprove = (modifiedStep?: TestStep) => {
    if (!currentApprovalRequest || !currentSessionId) return;

    approveStep({
      sessionId: currentSessionId,
      stepIndex: currentApprovalRequest.stepIndex,
      approved: true,
      modifiedStep,
    });

    setCurrentApprovalRequest(null);
  };

  const handleReject = (reason: string) => {
    if (!currentApprovalRequest || !currentSessionId) return;

    approveStep({
      sessionId: currentSessionId,
      stepIndex: currentApprovalRequest.stepIndex,
      approved: false,
      reason,
    });

    setCurrentApprovalRequest(null);
  };

  const handleCancel = () => {
    if (currentSessionId) {
      cancelSession(currentSessionId);
      setSessionState("cancelled");
      setCurrentApprovalRequest(null);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 AI Test Assistant</h1>
        <p>Convert natural language prompts into executable test steps</p>

        <div className="mode-switcher">
          <label>Execution Mode:</label>
          <div className="mode-buttons">
            <button
              onClick={() => setMode("api")}
              className={`mode-btn ${mode === "api" ? "active" : ""}`}
              disabled={loading || sessionState !== "idle"}
            >
              API (Automatic)
            </button>
            <button
              onClick={() => setMode("websocket")}
              className={`mode-btn ${mode === "websocket" ? "active" : ""}`}
              disabled={loading || sessionState !== "idle"}
            >
              WebSocket (Human-in-Loop)
            </button>
          </div>
          {mode === "websocket" && (
            <span
              className={`connection-status ${
                isConnected ? "connected" : "disconnected"
              }`}
            >
              {isConnected ? "● Connected" : "○ Disconnected"}
            </span>
          )}
        </div>
      </header>

      <main className="app-main">
        <TestPromptInput
          onSubmit={handleTestRun}
          loading={
            mode === "api"
              ? loading
              : sessionState !== "idle" && sessionState !== "completed"
          }
          mode={mode}
        />

        {/* WebSocket Mode - Approval UI */}
        {mode === "websocket" && currentApprovalRequest && (
          <StepApproval
            request={currentApprovalRequest}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}

        {/* WebSocket Mode - Session Status */}
        {mode === "websocket" &&
          (currentSessionId ||
            sessionState === "completed" ||
            sessionState === "cancelled") && (
            <div className="session-status">
              <div className="session-info">
                {currentSessionId && (
                  <span className="session-id">
                    Session: {currentSessionId}
                  </span>
                )}
                <span className={`session-state state-${sessionState}`}>
                  {sessionState.toUpperCase()}
                </span>
                {sessionState !== "idle" &&
                  sessionState !== "completed" &&
                  sessionState !== "cancelled" && (
                    <button onClick={handleCancel} className="btn-cancel">
                      Cancel Session
                    </button>
                  )}
              </div>

              {generatedSteps.length > 0 && (
                <div className="generated-steps">
                  <h3>Generated Steps ({generatedSteps.length}):</h3>
                  <ol>
                    {generatedSteps.map((step, idx) => {
                      const update = stepUpdates.get(idx);
                      return (
                        <li
                          key={idx}
                          className={`step-item ${
                            update ? `step-${update.status}` : ""
                          }`}
                        >
                          <span className="step-action">{step.action}</span>
                          {step.target && (
                            <code className="step-target">{step.target}</code>
                          )}
                          {update && (
                            <span
                              className={`step-status status-${update.status}`}
                            >
                              {update.status}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {/* WebSocket Mode - Execution Results (After Completion) */}
              {(sessionState === "completed" || sessionState === "cancelled") &&
                executionResults.length > 0 && (
                  <div className="websocket-results">
                    <h3>Execution Results</h3>
                    <div className="execution-summary">
                      <div className="summary-stats">
                        <span className="stat">
                          Total Steps: {executionResults.length}
                        </span>
                        <span className="stat success">
                          Passed:{" "}
                          {
                            executionResults.filter(
                              (r) => r.status === "passed"
                            ).length
                          }
                        </span>
                        <span className="stat failure">
                          Failed:{" "}
                          {
                            executionResults.filter(
                              (r) => r.status === "failed"
                            ).length
                          }
                        </span>
                        <span className="stat skipped">
                          Skipped:{" "}
                          {
                            executionResults.filter(
                              (r) => r.status === "skipped"
                            ).length
                          }
                        </span>
                      </div>
                    </div>

                    <div className="execution-details">
                      {executionResults.map((result, idx) => (
                        <div
                          key={idx}
                          className={`result-item result-${result.status}`}
                        >
                          <div className="result-header">
                            <span className="result-icon">
                              {result.status === "passed"
                                ? "✅"
                                : result.status === "failed"
                                ? "❌"
                                : "⊘"}
                            </span>
                            <span className="result-action">
                              {result.action}
                            </span>
                            <span className="result-duration">
                              {result.duration}ms
                            </span>
                          </div>
                          {result.message && (
                            <div className="result-message">
                              {result.message}
                            </div>
                          )}
                          {result.error && (
                            <div className="result-error">
                              Error: {result.error}
                            </div>
                          )}
                          {result.screenshot && (
                            <div className="result-screenshot">
                              <img
                                src={`data:image/png;base64,${result.screenshot}`}
                                alt="Screenshot"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

        {/* API Mode - Results */}
        {mode === "api" && result && <TestResults result={result} />}
      </main>

      <footer className="app-footer">
        <p>
          {mode === "api"
            ? "API Mode: Automatic execution with LLM + MCP"
            : "WebSocket Mode: Human-in-the-loop approval for each step"}
        </p>
      </footer>
    </div>
  );
}

export default App;
