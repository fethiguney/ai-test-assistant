# Troubleshooting Guide

## Issue: Test gets stuck in "Processing..." state

### Problem
When you click "Generate & Execute" or "Generate Steps", the UI shows "⏳ Processing..." but never completes.

### Root Cause
The application was trying to use **Ollama (Local)** as the default LLM provider, but Ollama is not running on your system. This causes the LLM request to hang indefinitely, leaving the UI in a "processing" state.

### Solution

**Option 1: Use Groq (Recommended - Already configured)**

1. Open `http://localhost:3000`
2. In the "LLM Provider" dropdown, select **"Groq (Fast, Cloud)"** instead of "Auto"
3. Now try running your test - it should work!

**Option 2: Set Groq as Default via API**

Run this command in PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/llm/providers/active" -Method POST -Body '{"provider":"groq"}' -ContentType "application/json"
```

Then "Auto" will use Groq by default.

**Option 3: Install and Run Ollama**

If you want to use local LLM:
1. Install Ollama from https://ollama.com
2. Run `ollama pull llama3.2`  
3. Keep Ollama running in the background
4. Now "Auto" or "Ollama (Local)" will work

### Additional Fixes Applied

I also fixed these issues:

1. **API Payload Mismatch**: Frontend was sending `scenario` but backend expected `prompt`
   - Fixed in `frontend/src/App.tsx`

2. **Type Safety**: Added optional chaining for `llmUsed` in TestResults component  
   - Fixed in `frontend/src/components/TestResults.tsx` and `frontend/src/types.ts`

### How to Test Now

1. Restart frontend if needed:
   ```powershell
   cd d:\ai-test-assistant-poc\frontend
   npm run dev
   ```

2. Open http://localhost:3000

3. Select **"Groq (Fast, Cloud)"** from LLM Provider dropdown

4. Enter a test scenario:
   ```
   Navigate to https://example.com and verify the page title
   ```

5. Check "Execute test immediately"

6. Click "🚀 Generate & Execute"

7. It should now complete successfully within 2-5 seconds!

### Expected Results

- ✅ Test steps are generated
- ✅ Steps are executed (if "Execute immediately" is checked)
- ✅ Results are displayed with execution details
- ✅ No more "stuck in processing"!

### WebSocket Mode (Human-in-Loop)

To use the step-by-step approval mode:

1. Click **"WebSocket (Human-in-Loop)"** button in the header
2. You should see **"● Connected"** indicator
3. Enter your test scenario
4. Click **"Generate Steps"**
5. Review and approve each step individually
6. Monitor real-time execution progress

### Still Having Issues?

Check backend logs:
```powershell
Get-Content "c:\Users\Nuevo\.cursor\projects\d-ai-test-assistant-poc\terminals\8.txt" -Tail 50
```

Look for:
- `[Orchestrator] Running test with...` - shows which LLM is being used
- `[Error]` - shows any errors
- WebSocket connection messages

### Quick Health Check

Test if backend is working:
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/health"
```

Should return: `{"status":"ok"}`

Test if Groq is working:
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/llm/providers/health?provider=groq"
```

Should return: `{"available":true,"provider":"groq","latencyMs":...}`

---

**Summary**: The main issue was that Ollama wasn't running. Just select **Groq** from the dropdown and everything will work! 🎉
