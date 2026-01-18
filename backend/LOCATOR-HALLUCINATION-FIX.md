# Locator Hallucination Fix - Summary

## Problem
The AI Test Assistant was generating test steps with hallucinated (made-up) locators before navigating to web pages and capturing actual page snapshots. This caused tests to fail because the selectors didn't exist on the actual page.

### Example Issue
User request: "go to google.com and search ai test"

**Before Fix:**
1. LLM generates ALL steps upfront (including search input selector)
2. Uses made-up selector like `#search-box` or `input[name="q"]`
3. Navigates to Google
4. Tries to use made-up selector → **FAILS** because actual selector is different

## Solution

### 1. Enforced Iterative Generation with Page Context
**File:** `backend/src/websocket/websocket-test-orchestrator.ts`

- **Changed:** Generate steps ONE AT A TIME based on actual page state
- **Flow:**
  1. Parse scenario into high-level intentions
  2. For each intention:
     - If navigation needed → generate & execute navigation step
     - Capture page snapshot with REAL elements
     - Generate next step using ONLY selectors from snapshot
     - Execute step
     - If page changes → capture new snapshot

**Key Code:**
```typescript
// CRITICAL: For non-navigation steps, we MUST have a page snapshot
if (!currentPageSnapshot) {
  throw new Error(`Cannot generate step without page snapshot`);
}

// Generate step with actual page context
const stepRequest: IterativeStepRequest = {
  scenario: `${intention}. Full test scenario: ${scenario}`,
  previousSteps: executedSteps,
  currentPageSnapshot,  // ← Real elements from the page!
  requiresPageContext: true,
};
```

### 2. Stricter LLM Prompts
**File:** `backend/src/services/test-generator.service.ts`

**Updated System Prompt:**
```typescript
CRITICAL RULES - MUST FOLLOW:
6. You MUST ONLY use selectors from the "AVAILABLE INTERACTIVE ELEMENTS" list below
7. DO NOT create, guess, or hallucinate selectors - ONLY use what is provided
8. If you cannot find a suitable element in the list, return an error step
9. Copy the exact selector string from the element list - do NOT modify it
10. Never invent placeholder selectors like "#searchbox", ".search-input", etc.

IMPORTANT REMINDERS:
- Only use selectors that appear in the AVAILABLE INTERACTIVE ELEMENTS section
- Copy the exact selector string, do not modify it
- If no suitable element exists, return: {"action":"error","description":"Cannot find required element on page"}
```

### 3. Added Snapshot Approval Mechanism
**File:** `backend/src/websocket/websocket-test-orchestrator.ts`

- Added `onSnapshotApproval` callback for human-in-loop validation
- Allows users to review captured page elements before step generation
- Can reject snapshots if they don't contain expected elements

**File:** `backend/src/websocket/websocket-server.ts`

- Integrated snapshot approval into WebSocket flow
- Emits `SNAPSHOT_APPROVAL_REQUEST` event to frontend
- Waits for user approval before proceeding

### 4. Better Error Handling for Page Changes
**File:** `backend/src/websocket/websocket-test-orchestrator.ts`

```typescript
// Wait longer for page to settle after navigation
await new Promise(resolve => setTimeout(resolve, 2000));

try {
  currentPageSnapshot = await this.capturePageSnapshot(executor);
} catch (error) {
  console.error('Failed to capture snapshot after page change:', error);
  // Continue without snapshot - next step generation will handle it
  currentPageSnapshot = undefined;
}
```

### 5. Context Preservation
**File:** `backend/src/services/test-generator.service.ts`

```typescript
// Include full scenario context to help LLM extract specific values
userPrompt = `CURRENT INTENTION: ${request.scenario}\n\n`;
userPrompt += `FULL SCENARIO CONTEXT: This is part of a larger test scenario. Extract any specific values (URLs, search terms, etc.) from the intention.\n\n`;
```

## Test Results

### Test: "go to google.com and search ai test"

**After Fix:**
```
✅ Step 1: Navigate to google.com (PASSED)
📸 Snapshot captured: 39 elements including search input
✅ Step 2: Fill search input with "ai test" using REAL selector #APjFqb (PASSED)
✅ Step 3: Click search button using REAL selector [aria-label="Google Search"] (PASSED)
```

**Key Improvements:**
- ✅ No hallucinated locators before navigation
- ✅ Snapshot captured successfully (39 elements)
- ✅ Real selectors used from actual page (`#APjFqb`, `[aria-label="Google Search"]`)
- ✅ Search executed successfully

**Remaining Issue:**
- After search submission, page navigation causes snapshot capture to fail temporarily
- Solution: Increased wait time to 2 seconds and added error handling

## Architecture Changes

### Before (Batch Generation)
```
User Prompt → LLM → All Steps Generated → Execute All Steps
                     ↑ Hallucinated selectors!
```

### After (Iterative Generation)
```
User Prompt → Parse Intentions → For Each Intention:
                                  ├─ Navigate (if needed)
                                  ├─ Capture Snapshot (real elements)
                                  ├─ Generate Step (using real selectors)
                                  ├─ Approve Step (optional)
                                  └─ Execute Step
```

## Benefits

1. **No Hallucinations:** LLM can only use selectors that actually exist on the page
2. **Better Accuracy:** Steps are generated based on real page state
3. **Human Validation:** Optional approval for snapshots and steps
4. **Adaptive:** Can handle dynamic pages that change during test execution
5. **Transparent:** Shows exactly what elements are available at each step

## Usage

### Enable Iterative Generation (WebSocket)
```typescript
const request: StartTestRequest = {
  scenario: "go to google.com and search ai test",
  humanInLoop: true,
  enableIterativeGeneration: true,  // ← Enable iterative mode
  snapshotApprovalRequired: false,  // ← Optional: require snapshot approval
  approvalTimeoutSeconds: 30,
  browser: 'chromium',
};
```

### Direct API Usage
```typescript
const result = await testOrchestrator.runIterativeTest(scenario, {
  sessionId: 'test_123',
  llmProvider: 'groq',
  browser: 'chromium',
  headless: false,
  
  onStepGenerated: async (step, snapshot) => {
    // Review step before execution
    console.log('Generated:', step);
    console.log('Available elements:', snapshot?.elements.length);
    return true; // approve
  },
  
  onSnapshotCaptured: async (snapshot) => {
    // Review captured page elements
    console.log('Snapshot:', snapshot.url, snapshot.elements.length);
  },
});
```

## Files Modified

1. `backend/src/services/test-generator.service.ts` - Stricter prompts
2. `backend/src/websocket/websocket-test-orchestrator.ts` - Iterative flow
3. `backend/src/websocket/websocket-server.ts` - Snapshot approval integration
4. `backend/src/types/websocket.types.ts` - Updated types

## Testing

Run the test:
```bash
cd backend
npx tsx src/test-google-search.ts
```

This test validates:
- No locator hallucination before navigation
- Snapshot capture works correctly
- Real selectors are used from snapshots
- Search functionality works end-to-end
