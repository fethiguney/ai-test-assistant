import { useState } from "react";
import { BrowserType } from "../types";
import "./TestPromptInput.css";

interface Props {
  onSubmit: (
    prompt: string,
    llmProvider: string,
    mcpClient: string,
    executeImmediately: boolean,
    browser: BrowserType,
    headless: boolean
  ) => void;
  loading: boolean;
  mode: "api" | "websocket";
}

export default function TestPromptInput({ onSubmit, loading, mode }: Props) {
  const [prompt, setPrompt] = useState("");
  const [llmProvider, setLlmProvider] = useState("auto");
  const [mcpClient, setMcpClient] = useState("playwright");
  const [executeImmediately, setExecuteImmediately] = useState(false);
  const [browser, setBrowser] = useState<BrowserType>("chromium");
  const [headless, setHeadless] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    // In websocket mode, always use headless: false
    const effectiveHeadless = mode === "websocket" ? false : headless;
    onSubmit(prompt, llmProvider, mcpClient, executeImmediately, browser, effectiveHeadless);
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

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="browser">Browser</label>
            <select
              id="browser"
              value={browser}
              onChange={(e) => setBrowser(e.target.value as BrowserType)}
              disabled={loading}
            >
              <option value="chromium">Chrome / Chromium</option>
              <option value="firefox">Firefox</option>
              <option value="webkit">WebKit (Safari)</option>
            </select>
          </div>

          <div className="form-group">
            {mode === "api" ? (
              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={!headless}
                    onChange={(e) => setHeadless(!e.target.checked)}
                    disabled={loading}
                  />
                  Show browser window
                </label>
              </div>
            ) : (
              <div className="info-message">
                <small>Browser always visible in Human-in-Loop mode</small>
              </div>
            )}
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
