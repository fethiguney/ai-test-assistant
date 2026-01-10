import { useState } from "react";
import "./TestPromptInput.css";

interface Props {
  onSubmit: (
    prompt: string,
    llmProvider: string,
    mcpClient: string,
    executeImmediately: boolean
  ) => void;
  loading: boolean;
}

export default function TestPromptInput({ onSubmit, loading }: Props) {
  const [prompt, setPrompt] = useState("");
  const [llmProvider, setLlmProvider] = useState("auto");
  const [mcpClient, setMcpClient] = useState("playwright");
  const [executeImmediately, setExecuteImmediately] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onSubmit(prompt, llmProvider, mcpClient, executeImmediately);
  };

  return (
    <div className="test-prompt-input">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="prompt">Test Scenario Prompt</label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your test scenario in natural language...&#10;&#10;Example: Go to login page, enter username 'tomsmith', enter password 'SuperSecretPassword!', click login button, verify success message"
            rows={6}
            disabled={loading}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="llm-provider">LLM Provider</label>
            <select
              id="llm-provider"
              value={llmProvider}
              onChange={(e) => setLlmProvider(e.target.value)}
              disabled={loading}
            >
              <option value="groq">Groq (Fast, Cloud)</option>
              <option value="ollama">Ollama (Local)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="mcp-client">Test Executor</label>
            <select
              id="mcp-client"
              value={mcpClient}
              onChange={(e) => setMcpClient(e.target.value)}
              disabled={loading}
            >
              <option value="playwright">MCP - Playwright</option>
              <option value="direct">Direct - Playwright</option>
              <option value="appium">MCP - Appium (Coming Soon)</option>
            </select>
          </div>
        </div>

        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={executeImmediately}
              onChange={(e) => setExecuteImmediately(e.target.checked)}
              disabled={loading}
            />
            Execute test immediately
          </label>
        </div>

        <button type="submit" disabled={loading || !prompt.trim()}>
          {loading
            ? "⏳ Processing..."
            : executeImmediately
            ? "🚀 Generate & Execute"
            : "📝 Generate Steps"}
        </button>
      </form>
    </div>
  );
}
