/**
 * SnapshotApproval Component - Human-in-loop approval for page snapshots
 */
import { useState } from 'react';
import { SnapshotApprovalRequest, DOMElement } from '../types';
import './SnapshotApproval.css';

interface SnapshotApprovalProps {
  request: SnapshotApprovalRequest;
  onApprove: (modifiedSelector?: string) => void;
  onSkip: () => void;
  disabled?: boolean;
}

export function SnapshotApproval({ request, onApprove, onSkip, disabled }: SnapshotApprovalProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [modifiedSelector, setModifiedSelector] = useState(request.suggestedSelector || '');
  const [isModifying, setIsModifying] = useState(false);

  const snapshot = request.snapshot;
  const displayLimit = 20;
  const elementsToShow = showAll ? snapshot.elements : snapshot.elements.slice(0, displayLimit);

  // Count interactive elements
  const interactiveElements = {
    buttons: snapshot.elements.filter((el: DOMElement) => 
      el.tag.toLowerCase() === 'button' || el.role === 'button'
    ).length,
    inputs: snapshot.elements.filter((el: DOMElement) => 
      el.tag.toLowerCase() === 'input' || el.tag.toLowerCase() === 'textarea'
    ).length,
    links: snapshot.elements.filter((el: DOMElement) => 
      el.tag.toLowerCase() === 'a' || el.role === 'link'
    ).length,
    selects: snapshot.elements.filter((el: DOMElement) => 
      el.tag.toLowerCase() === 'select'
    ).length,
  };

  const handleApprove = () => {
    if (isModifying && modifiedSelector.trim() !== request.suggestedSelector) {
      onApprove(modifiedSelector.trim());
    } else {
      onApprove();
    }
  };

  const formatElementLabel = (element: DOMElement): string => {
    const parts: string[] = [];
    
    if (element.role) {
      parts.push(`role="${element.role}"`);
    }
    if (element.ariaLabel) {
      parts.push(`aria-label="${element.ariaLabel}"`);
    }
    if (element.text && element.text.length > 0) {
      const truncatedText = element.text.length > 40 
        ? element.text.substring(0, 40) + '...' 
        : element.text;
      parts.push(`text="${truncatedText}"`);
    }
    
    return parts.length > 0 ? parts.join(', ') : 'No label';
  };

  return (
    <div className="snapshot-approval">
      <div className="snapshot-approval-header">
        <h3>Page Snapshot - Step {request.stepIndex + 1}</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="expand-toggle"
          disabled={disabled}
        >
          {isExpanded ? '▼ Collapse' : '▶ Expand'}
        </button>
      </div>

      {isExpanded && (
        <div className="snapshot-approval-content">
          {/* Page Info */}
          <div className="page-info">
            <div className="info-row">
              <label>URL:</label>
              <span className="url-value">{snapshot.url}</span>
            </div>
            <div className="info-row">
              <label>Title:</label>
              <span className="title-value">{snapshot.title || 'Untitled'}</span>
            </div>
            <div className="info-row">
              <label>Captured:</label>
              <span className="timestamp-value">
                {new Date(snapshot.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Interactive Elements Summary */}
          <div className="elements-summary">
            <h4>Detected Elements</h4>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">Buttons:</span>
                <span className="summary-count">{interactiveElements.buttons}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Inputs:</span>
                <span className="summary-count">{interactiveElements.inputs}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Links:</span>
                <span className="summary-count">{interactiveElements.links}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Selects:</span>
                <span className="summary-count">{interactiveElements.selects}</span>
              </div>
            </div>
            <div className="total-elements">
              Total elements: <strong>{snapshot.elements.length}</strong>
            </div>
          </div>

          {/* Suggested Selector */}
          {request.suggestedSelector && (
            <div className="suggested-selector">
              <h4>
                Suggested Selector
                {request.nextAction && (
                  <span className="next-action"> for {request.nextAction}</span>
                )}
              </h4>
              <div className="selector-section">
                {isModifying ? (
                  <input
                    type="text"
                    value={modifiedSelector}
                    onChange={(e) => setModifiedSelector(e.target.value)}
                    disabled={disabled}
                    className="selector-input"
                    placeholder="Enter selector..."
                  />
                ) : (
                  <code className="selector-value">{request.suggestedSelector}</code>
                )}
                <button
                  onClick={() => setIsModifying(!isModifying)}
                  className="modify-btn"
                  disabled={disabled}
                >
                  {isModifying ? 'Cancel' : 'Modify'}
                </button>
              </div>
            </div>
          )}

          {/* Elements List */}
          <div className="elements-list">
            <div className="elements-list-header">
              <h4>Elements on Page</h4>
              {snapshot.elements.length > displayLimit && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="show-more-btn"
                  disabled={disabled}
                >
                  {showAll 
                    ? 'Show Less' 
                    : `Show All (${snapshot.elements.length - displayLimit} more)`
                  }
                </button>
              )}
            </div>
            <div className="elements-container">
              {elementsToShow.map((element: DOMElement, idx: number) => (
                <div key={idx} className="element-item">
                  <div className="element-tag">{element.tag}</div>
                  <div className="element-info">
                    <code className="element-selector">{element.selector}</code>
                    <div className="element-label">{formatElementLabel(element)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="snapshot-actions">
            <button
              onClick={onSkip}
              disabled={disabled}
              className="btn btn-skip"
            >
              Skip Snapshot
            </button>
            <button
              onClick={handleApprove}
              disabled={disabled}
              className="btn btn-approve"
            >
              ✓ Looks Good {isModifying && '(with modified selector)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
