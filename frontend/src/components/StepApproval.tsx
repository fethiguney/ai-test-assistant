/**
 * StepApproval Component - Human-in-loop approval UI for test steps
 */
import { useState } from 'react';
import { StepApprovalRequest, TestStepResult } from '../types';
import './StepApproval.css';

interface StepApprovalProps {
  request: StepApprovalRequest;
  onApprove: (modifiedStep?: any) => void;
  onReject: (reason: string) => void;
  disabled?: boolean;
}

export function StepApproval({ request, onApprove, onReject, disabled }: StepApprovalProps) {
  const [reason, setReason] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedStep, setEditedStep] = useState(request.step);

  const handleApprove = () => {
    if (isEditing) {
      onApprove(editedStep);
    } else {
      onApprove();
    }
  };

  const handleReject = () => {
    const finalReason = reason.trim() || 'Rejected by user';
    onReject(finalReason);
    setReason('');
  };

  return (
    <div className="step-approval">
      <div className="step-approval-header">
        <h3>Step {request.stepIndex + 1} of {request.totalSteps}</h3>
        {request.timeoutSeconds && request.timeoutSeconds > 0 && (
          <span className="timeout-badge">
            Timeout: {request.timeoutSeconds}s
          </span>
        )}
      </div>

      <div className="step-approval-content">
        <div className="step-details">
          <div className="step-field">
            <label>Action:</label>
            {isEditing ? (
              <input
                type="text"
                value={editedStep.action}
                onChange={(e) =>
                  setEditedStep({ ...editedStep, action: e.target.value })
                }
                disabled={disabled}
              />
            ) : (
              <span className="step-value">{request.step.action}</span>
            )}
          </div>

          {request.step.target && (
            <div className="step-field">
              <label>Target:</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedStep.target || ''}
                  onChange={(e) =>
                    setEditedStep({ ...editedStep, target: e.target.value })
                  }
                  disabled={disabled}
                />
              ) : (
                <code className="step-value">{request.step.target}</code>
              )}
            </div>
          )}

          {request.step.value && (
            <div className="step-field">
              <label>Value:</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedStep.value || ''}
                  onChange={(e) =>
                    setEditedStep({ ...editedStep, value: e.target.value })
                  }
                  disabled={disabled}
                />
              ) : (
                <code className="step-value">{request.step.value}</code>
              )}
            </div>
          )}

          {request.step.description && (
            <div className="step-field">
              <label>Description:</label>
              <span className="step-description">{request.step.description}</span>
            </div>
          )}
        </div>

        {request.previousResults.length > 0 && (
          <div className="previous-results">
            <h4>Previous Results:</h4>
            <div className="results-summary">
              {request.previousResults.map((result: TestStepResult, idx: number) => (
                <div
                  key={idx}
                  className={`result-item result-${result.status}`}
                >
                  <span className="result-index">#{idx + 1}</span>
                  <span className="result-action">{result.action}</span>
                  <span className={`result-status status-${result.status}`}>
                    {result.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="approval-actions">
          <div className="edit-toggle">
            <label>
              <input
                type="checkbox"
                checked={isEditing}
                onChange={(e) => setIsEditing(e.target.checked)}
                disabled={disabled}
              />
              Edit step before execution
            </label>
          </div>

          <div className="reject-section">
            <input
              type="text"
              placeholder="Reason for rejection (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={disabled}
              className="reason-input"
            />
          </div>

          <div className="action-buttons">
            <button
              onClick={handleReject}
              disabled={disabled}
              className="btn btn-reject"
            >
              ✗ Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={disabled}
              className="btn btn-approve"
            >
              ✓ Approve {isEditing && '(with changes)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
