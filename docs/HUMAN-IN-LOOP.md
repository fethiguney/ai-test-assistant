# Human-in-Loop Test Execution

This document describes the Human-in-Loop (HITL) feature that allows step-by-step approval of test execution using WebSocket communication.

## Overview

The Human-in-Loop feature enables users to:
- Review each test step before execution
- Approve or reject steps individually
- Modify steps before execution
- Monitor real-time test execution progress
- Cancel active test sessions

## Architecture

### Backend Components

1. **WebSocket Server** (`backend/src/websocket/websocket-server.ts`)
   - Handles WebSocket connections
   - Manages test sessions
   - Emits events for step approval requests and execution updates
   - Coordinates with ApprovalManager

2. **ApprovalManager Service** (`backend/src/services/approval-manager.service.ts`)
   - Manages approval state for each step
   - Handles approval timeouts
   - Provides Promise-based approval workflow
   - Tracks pending approvals per session

3. **WebSocket Test Orchestrator** (`backend/src/websocket/websocket-test-orchestrator.ts`)
   - Simplified orchestrator for WebSocket sessions
   - Generates test steps from scenarios
   - Executes individual steps
   - Supports both direct Playwright and MCP execution

4. **Types** (`backend/src/types/websocket.types.ts`)
   - `StepApprovalRequest` - Request sent to client for approval
   - `StepApprovalResponse` - Client's approval/rejection response
   - `StepExecutionUpdate` - Real-time execution status updates
   - `SessionStatusUpdate` - Overall session state updates
   - `ServerEvents` / `ClientEvents` - WebSocket event enums

### Frontend Components

1. **WebSocket Hook** (`frontend/src/hooks/useWebSocket.ts`)
   - Manages WebSocket connection
   - Provides callbacks for server events
   - Exposes `startTest`, `approveStep`, `cancelSession` methods
   - Tracks connection status and current session

2. **StepApproval Component** (`frontend/src/components/StepApproval.tsx`)
   - UI for reviewing and approving/rejecting steps
   - Allows step modification before execution
   - Shows previous results for context
   - Optional rejection reason input

3. **App Component** (`frontend/src/App.tsx`)
   - Mode switcher: API (automatic) vs WebSocket (human-in-loop)
   - Manages session state and approval requests
   - Displays real-time step execution progress
   - Handles session cancellation

## Usage

### Starting a Human-in-Loop Test

1. Open the frontend at `http://localhost:3000`
2. Switch to "WebSocket (Human-in-Loop)" mode
3. Enter your test scenario in the prompt input
4. Select LLM provider and optional MCP client
5. Click "Generate & Run Test"

### Approval Workflow

When a step requires approval:

1. **Review Step**: The StepApproval component displays:
   - Step index (e.g., "Step 2 of 5")
   - Action (e.g., "navigate", "click", "fill")
   - Target (CSS selector or element)
   - Value (for input actions)
   - Description
   - Previous results (if any)

2. **Options**:
   - **Approve**: Execute the step as-is
   - **Edit & Approve**: Modify step properties before execution
   - **Reject**: Skip the step (optionally provide a reason)

3. **Execution**: After approval:
   - Step status changes to "executing"
   - Real-time updates show progress
   - Result is displayed (passed/failed/skipped)

### Session States

- `idle` - No active session
- `generating` - LLM is generating test steps
- `awaiting_approval` - Waiting for user to approve/reject current step
- `executing` - Step is being executed
- `completed` - All steps completed
- `cancelled` - Session was cancelled by user

## WebSocket Events

### Server → Client

| Event | Description | Payload |
|-------|-------------|---------|
| `session:created` | New session started | `{ sessionId, scenario }` |
| `session:status` | Session state changed | `SessionStatusUpdate` |
| `steps:generated` | Test steps generated | `{ sessionId, steps }` |
| `step:approval_request` | Requesting step approval | `StepApprovalRequest` |
| `step:execution_update` | Step execution progress | `StepExecutionUpdate` |
| `session:completed` | All steps completed | `{ sessionId, results }` |
| `error` | Error occurred | `{ message, error }` |

### Client → Server

| Event | Description | Payload |
|-------|-------------|---------|
| `test:start` | Start new test session | `StartTestRequest` |
| `step:approval` | Approve/reject step | `StepApprovalResponse` |
| `session:cancel` | Cancel active session | `sessionId` |

## Example: Starting a HITL Test

```typescript
// Frontend WebSocket client
import { useWebSocket } from './hooks/useWebSocket';

const { startTest, approveStep, cancelSession } = useWebSocket({
  onApprovalRequest: (request) => {
    console.log('Approve step:', request.step);
  },
  onStepUpdate: (update) => {
    console.log('Step status:', update.status);
  },
});

// Start test with human-in-loop
startTest({
  scenario: 'Navigate to google.com and search for "Playwright"',
  llmProvider: 'groq',
  humanInLoop: true,
  approvalTimeoutSeconds: 300, // 5 minutes
});

// Later: Approve a step
approveStep({
  sessionId: 'session_123',
  stepIndex: 0,
  approved: true,
});

// Or reject a step
approveStep({
  sessionId: 'session_123',
  stepIndex: 1,
  approved: false,
  reason: 'Wrong selector',
});
```

## Configuration

### Approval Timeout

Set a timeout for step approvals to prevent sessions from hanging indefinitely:

```typescript
startTest({
  scenario: '...',
  humanInLoop: true,
  approvalTimeoutSeconds: 300, // 5 minutes (0 = no timeout)
});
```

If timeout expires, the step is automatically rejected.

### Connection Settings

WebSocket connection is configured in `frontend/src/hooks/useWebSocket.ts`:

```typescript
const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling'],
});
```

For production, update the URL to your backend server.

## Benefits

1. **Quality Control**: Review each step before execution
2. **Safety**: Prevent unintended actions on production systems
3. **Learning**: Understand what the AI-generated test does
4. **Flexibility**: Modify steps on-the-fly without regenerating
5. **Debugging**: See exactly where tests fail with real-time updates

## Comparison: API vs WebSocket Mode

| Feature | API Mode | WebSocket Mode |
|---------|----------|----------------|
| Execution | Automatic | Step-by-step approval |
| Speed | Fast | Depends on user |
| Control | None (after start) | Full control per step |
| Use Case | CI/CD, automation | Development, debugging |
| Connection | HTTP (stateless) | WebSocket (stateful) |
| Progress | Only final result | Real-time updates |

## Troubleshooting

### WebSocket Connection Issues

If the connection status shows "Disconnected":

1. Ensure backend is running: `npm run dev` in `backend/`
2. Check WebSocket URL in `useWebSocket.ts`
3. Verify firewall/proxy settings
4. Check browser console for connection errors

### Approval Not Working

If approval buttons don't respond:

1. Check browser console for errors
2. Verify `currentSessionId` is set
3. Ensure WebSocket is connected
4. Check backend logs for errors

### Session Stuck in "awaiting_approval"

If a session is stuck:

1. Click "Cancel Session" button
2. Refresh the page
3. Restart backend if needed
4. Check `ApprovalManager` for pending approvals

## Future Enhancements

- [ ] Screenshot preview in approval UI
- [ ] Step execution history/timeline
- [ ] Multi-user collaboration
- [ ] Approval templates for common patterns
- [ ] Session replay/recording
- [ ] Approval workflow presets
- [ ] Integration with test case management tools

## Related Documentation

- [MCP Integration](./MCP-INTEGRATION.md)
- [Feature Development](./development/feature-development.md)
- [Architecture Decisions](./development/architecture-decisions.md)
