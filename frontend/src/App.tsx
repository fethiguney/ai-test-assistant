import { useState } from 'react'
import TestPromptInput from './components/TestPromptInput'
import TestResults from './components/TestResults'
import { DynamicTestRunResponse } from './types'
import './App.css'

function App() {
  const [result, setResult] = useState<DynamicTestRunResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const handleTestRun = async (
    prompt: string,
    llmProvider: string,
    mcpClient: string,
    executeImmediately: boolean
  ) => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/test/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          llmProvider: llmProvider === 'auto' ? undefined : llmProvider,
          mcpClient,
          executeImmediately,
          executionOptions: {
            headless: true,
            timeout: 30000,
          },
        }),
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error('Test run failed:', error)
      alert('Failed to run test. Check console for details.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 AI Test Assistant</h1>
        <p>Convert natural language prompts into executable test steps</p>
      </header>

      <main className="app-main">
        <TestPromptInput onSubmit={handleTestRun} loading={loading} />
        {result && <TestResults result={result} />}
      </main>

      <footer className="app-footer">
        <p>Powered by LLM + MCP (Model Context Protocol)</p>
      </footer>
    </div>
  )
}

export default App
