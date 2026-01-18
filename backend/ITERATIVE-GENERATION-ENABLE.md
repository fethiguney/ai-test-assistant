# How to Enable Iterative Generation (Fix for Locator Hallucination)

## The Problem
When **Page-Aware Generation is DISABLED**, the system:
1. Generates ALL test steps upfront (batch mode)
2. LLM invents/hallucinates selectors without seeing the page
3. Steps fail because selectors don't match real elements

## The Solution
Enable **Page-Aware Generation** to use iterative flow:
1. Navigate to page FIRST
2. Capture real elements
3. Generate ONE step at a time using ONLY real selectors
4. No hallucination!

## How to Enable in Frontend

### WebSocket Mode (Human-in-Loop)

1. Select **"WebSocket (Human-in-Loop)"** mode
2. Check the **"Enable Page-Aware Generation"** checkbox in Advanced Settings
3. Optionally check **"Show snapshots for approval"** to see page elements

![Enable Page-Aware Generation](https://i.imgur.com/placeholder.png)

**Screenshot of your UI should show:**
```
Advanced Settings
☑ Enable Page-Aware Generation ℹ️
☐ Show snapshots for approval ℹ️
```

### Verification in Console
When enabled, you should see in the browser DevTools console:
```
[WebSocket] Starting iterative generation for session session_xxx
[WebSocket] Show snapshots for approval: false
```

NOT:
```
[WebSocket] Steps generated: 5
```

## Default State
- **Page-Aware Generation**: ✅ Enabled by default (as of latest update)
- **Show Snapshots**: ❌ Disabled by default (optional)

## Testing
Try the scenario: **"go to google.com and search ai test"**

### With Page-Aware Generation ENABLED ✅
```
Step 1: Navigate to google.com ✅
[Snapshot captured: 39 elements]
Step 2: Fill search input using REAL selector #APjFqb ✅
Step 3: Click search button using REAL selector [aria-label="Google Search"] ✅
```

### With Page-Aware Generation DISABLED ❌
```
Generated all 5 steps at once
Step 1: Navigate to google.com ✅
Step 2: Fill #search-box (HALLUCINATED - doesn't exist!) ❌
```

## Troubleshooting

### Issue: Still seeing all steps generated at once
**Solution:** Make sure the checkbox is checked in the UI. Refresh the page and try again.

### Issue: "Iterative generation not yet implemented" error
**Solution:** Update to the latest version. The field names were fixed from `enableIterativeGeneration` to `enablePageAwareGeneration`.

### Issue: Steps fail with "element not found"
**Cause:** Page-aware generation is disabled
**Solution:** Enable the checkbox and rerun the test.

## API Usage (for developers)

```typescript
const request: StartTestRequest = {
  scenario: "go to google.com and search ai test",
  humanInLoop: true,
  enablePageAwareGeneration: true,  // ← THIS MUST BE TRUE
  showSnapshotsForApproval: false,   // ← Optional
  approvalTimeoutSeconds: 300,
  browser: 'chromium',
};

socket.emit('test:start', request);
```

## Backend Logs
When working correctly, you should see:

```
[WebSocket] Starting iterative generation for session session_xxx
[IterativeTest] Parsing scenario into intentions...
[IterativeTest] Found 4 intentions
[IterativeTest] Processing intention 1/4: Navigate to search engine page
[IterativeTest] Generating navigation step...
[IterativeTest] Capturing page snapshot...
[IterativeTest] Extracted 39 elements from page
[IterativeTest] Processing intention 2/4: Enter search query
[IterativeTest] Generating step with page context...
[IterativeTest] Snapshot has 39 elements available
```

NOT:
```
[WebSocket] Steps generated: 5  ← This means batch mode!
```

## Summary
- **Always enable "Page-Aware Generation"** to prevent hallucinated selectors
- The checkbox is in the "Advanced Settings" section
- It should be checked by default
- Verify in console that iterative generation is being used
