/**
 * WebSocket Hook - Connect to backend WebSocket for real-time test execution
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ServerEvents,
  ClientEvents,
  StartTestRequest,
  StepApprovalResponse,
  StepApprovalRequest,
  StepExecutionUpdate,
  SessionStatusUpdate,
  TestStep,
} from '../types';

interface UseWebSocketOptions {
  onStepsGenerated?: (steps: TestStep[]) => void;
  onApprovalRequest?: (request: StepApprovalRequest) => void;
  onStepUpdate?: (update: StepExecutionUpdate) => void;
  onSessionStatus?: (status: SessionStatusUpdate) => void;
  onSessionCompleted?: (data: any) => void;
  onError?: (error: any) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to WebSocket server
    const socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      setIsConnected(false);
    });

    // Listen to server events
    socket.on(ServerEvents.SESSION_CREATED, (data: { sessionId: string }) => {
      console.log('[WebSocket] Session created:', data.sessionId);
      setCurrentSessionId(data.sessionId);
    });

    socket.on(ServerEvents.STEPS_GENERATED, (data: { steps: TestStep[] }) => {
      console.log('[WebSocket] Steps generated:', data.steps.length);
      options.onStepsGenerated?.(data.steps);
    });

    socket.on(ServerEvents.STEP_APPROVAL_REQUEST, (request: StepApprovalRequest) => {
      console.log('[WebSocket] Approval request for step:', request.stepIndex);
      options.onApprovalRequest?.(request);
    });

    socket.on(ServerEvents.STEP_EXECUTION_UPDATE, (update: StepExecutionUpdate) => {
      console.log('[WebSocket] Step update:', update.stepIndex, update.status);
      options.onStepUpdate?.(update);
    });

    socket.on(ServerEvents.SESSION_STATUS, (status: SessionStatusUpdate) => {
      console.log('[WebSocket] Session status:', status.state);
      options.onSessionStatus?.(status);
    });

    socket.on(ServerEvents.SESSION_COMPLETED, (data: any) => {
      console.log('[WebSocket] Session completed');
      options.onSessionCompleted?.(data);
      setCurrentSessionId(null);
    });

    socket.on(ServerEvents.ERROR, (error: any) => {
      console.error('[WebSocket] Error:', error);
      options.onError?.(error);
    });

    // Cleanup on unmount
    return () => {
      socket.close();
    };
  }, []);

  const startTest = useCallback((request: StartTestRequest) => {
    if (!socketRef.current) {
      throw new Error('WebSocket not connected');
    }
    console.log('[WebSocket] Starting test:', request);
    socketRef.current.emit(ClientEvents.START_TEST, request);
  }, []);

  const approveStep = useCallback((response: StepApprovalResponse) => {
    if (!socketRef.current) {
      throw new Error('WebSocket not connected');
    }
    console.log('[WebSocket] Sending approval:', response);
    socketRef.current.emit(ClientEvents.STEP_APPROVAL, response);
  }, []);

  const cancelSession = useCallback((sessionId: string) => {
    if (!socketRef.current) {
      throw new Error('WebSocket not connected');
    }
    console.log('[WebSocket] Cancelling session:', sessionId);
    socketRef.current.emit(ClientEvents.CANCEL_SESSION, sessionId);
    setCurrentSessionId(null);
  }, []);

  return {
    isConnected,
    currentSessionId,
    startTest,
    approveStep,
    cancelSession,
  };
}
