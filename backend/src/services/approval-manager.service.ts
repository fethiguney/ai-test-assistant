/**
 * ApprovalManager Service - Manages step-by-step approval state
 * Handles approval requests, responses, and timeouts for human-in-loop testing
 */
import { StepApprovalResponse, SnapshotApprovalResponse, ApprovalState } from '../types/index.js';

export class ApprovalManagerService {
  private approvalState: ApprovalState = {
    pending: new Map(),
  };

  private snapshotApprovalState: Map<string, {
    resolve: (value: SnapshotApprovalResponse) => void;
    reject: (reason?: any) => void;
    timeoutHandle?: NodeJS.Timeout;
  }> = new Map();

  /**
   * Request approval for a step
   * @param sessionId - Session identifier
   * @param stepIndex - Index of the step to approve
   * @param timeoutMs - Timeout in milliseconds (0 = no timeout)
   * @returns Promise that resolves with approval response
   */
  async requestApproval(
    sessionId: string,
    stepIndex: number,
    timeoutMs: number = 0
  ): Promise<StepApprovalResponse> {
    const approvalKey = `${sessionId}:${stepIndex}`;

    return new Promise<StepApprovalResponse>((resolve, reject) => {
      // Set up timeout if specified
      let timeoutHandle: NodeJS.Timeout | undefined;
      if (timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          this.approvalState.pending.delete(approvalKey);
          reject(new Error(`Approval timeout for step ${stepIndex}`));
        }, timeoutMs);
      }

      // Store the promise handlers
      this.approvalState.pending.set(approvalKey, {
        resolve,
        reject,
        timeoutHandle,
      });
    });
  }

  /**
   * Respond to an approval request
   * @param response - Approval response from client
   * @returns true if response was processed, false if not found
   */
  respondToApproval(response: StepApprovalResponse): boolean {
    const approvalKey = `${response.sessionId}:${response.stepIndex}`;
    const pending = this.approvalState.pending.get(approvalKey);

    if (!pending) {
      return false;
    }

    // Clear timeout if it exists
    if (pending.timeoutHandle) {
      clearTimeout(pending.timeoutHandle);
    }

    // Resolve the promise
    pending.resolve(response);

    // Clean up
    this.approvalState.pending.delete(approvalKey);

    return true;
  }

  /**
   * Request approval for a snapshot
   * @param sessionId - Session identifier
   * @param stepIndex - Index of the step for this snapshot
   * @param timeoutMs - Timeout in milliseconds (0 = no timeout)
   * @returns Promise that resolves with snapshot approval response
   */
  async requestSnapshotApproval(
    sessionId: string,
    stepIndex: number,
    timeoutMs: number = 0
  ): Promise<SnapshotApprovalResponse> {
    const approvalKey = `snapshot:${sessionId}:${stepIndex}`;

    return new Promise<SnapshotApprovalResponse>((resolve, reject) => {
      // Set up timeout if specified
      let timeoutHandle: NodeJS.Timeout | undefined;
      if (timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          this.snapshotApprovalState.delete(approvalKey);
          reject(new Error(`Snapshot approval timeout for step ${stepIndex}`));
        }, timeoutMs);
      }

      // Store the promise handlers
      this.snapshotApprovalState.set(approvalKey, {
        resolve,
        reject,
        timeoutHandle,
      });
    });
  }

  /**
   * Respond to a snapshot approval request
   * @param response - Snapshot approval response from client
   * @returns true if response was processed, false if not found
   */
  respondToSnapshotApproval(response: SnapshotApprovalResponse): boolean {
    const approvalKey = `snapshot:${response.sessionId}:${response.stepIndex}`;
    const pending = this.snapshotApprovalState.get(approvalKey);

    if (!pending) {
      return false;
    }

    // Clear timeout if it exists
    if (pending.timeoutHandle) {
      clearTimeout(pending.timeoutHandle);
    }

    // Resolve the promise
    pending.resolve(response);

    // Clean up
    this.snapshotApprovalState.delete(approvalKey);

    return true;
  }

  /**
   * Cancel all pending approvals for a session
   * @param sessionId - Session identifier
   */
  cancelSession(sessionId: string): void {
    // Cancel step approvals
    const keysToDelete: string[] = [];

    this.approvalState.pending.forEach((pending, key) => {
      if (key.startsWith(`${sessionId}:`)) {
        if (pending.timeoutHandle) {
          clearTimeout(pending.timeoutHandle);
        }
        pending.reject(new Error('Session cancelled'));
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.approvalState.pending.delete(key));

    // Cancel snapshot approvals
    const snapshotKeysToDelete: string[] = [];

    this.snapshotApprovalState.forEach((pending, key) => {
      if (key.startsWith(`snapshot:${sessionId}:`)) {
        if (pending.timeoutHandle) {
          clearTimeout(pending.timeoutHandle);
        }
        pending.reject(new Error('Session cancelled'));
        snapshotKeysToDelete.push(key);
      }
    });

    snapshotKeysToDelete.forEach((key) => this.snapshotApprovalState.delete(key));
  }

  /**
   * Get pending approval count for a session
   * @param sessionId - Session identifier
   * @returns Number of pending approvals
   */
  getPendingCount(sessionId: string): number {
    let count = 0;
    this.approvalState.pending.forEach((_, key) => {
      if (key.startsWith(`${sessionId}:`)) {
        count++;
      }
    });
    return count;
  }

  /**
   * Check if there are any pending approvals
   * @returns true if there are pending approvals
   */
  hasPendingApprovals(): boolean {
    return this.approvalState.pending.size > 0;
  }

  /**
   * Clear all pending approvals (for cleanup)
   */
  clearAll(): void {
    // Clear step approvals
    this.approvalState.pending.forEach((pending) => {
      if (pending.timeoutHandle) {
        clearTimeout(pending.timeoutHandle);
      }
      pending.reject(new Error('Service shutdown'));
    });
    this.approvalState.pending.clear();

    // Clear snapshot approvals
    this.snapshotApprovalState.forEach((pending) => {
      if (pending.timeoutHandle) {
        clearTimeout(pending.timeoutHandle);
      }
      pending.reject(new Error('Service shutdown'));
    });
    this.snapshotApprovalState.clear();
  }
}

// Singleton instance
export const approvalManager = new ApprovalManagerService();
