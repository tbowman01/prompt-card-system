import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface ExecutionProgress {
  job_id: string;
  execution_id: string;
  total_tests: number;
  completed_tests: number;
  failed_tests: number;
  current_test?: {
    test_case_id: number;
    model: string;
    started_at: Date;
    estimated_completion: Date;
  };
  overall_progress_percent: number;
  estimated_time_remaining: number;
  message: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  updated_at: Date;
}

export interface TestExecutionResult {
  test_case_id: number;
  prompt: string;
  model: string;
  response: string;
  passed: boolean;
  assertions: Array<{
    type: string;
    passed: boolean;
    message?: string;
  }>;
  execution_time_ms: number;
  error?: string;
}

export interface WebSocketConfig {
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connected: boolean; // Alias for isConnected for backward compatibility
  connect: () => void;
  disconnect: () => void;
  subscribeToTest: (executionId: string) => void;
  unsubscribeFromTest: (executionId: string) => void;
  subscribeToProgress: () => void;
  unsubscribeFromProgress: () => void;
  cancelExecution: (executionId: string, reason: string) => void;
  getProgress: (executionId: string) => void;
  getActiveExecutions: () => void;
  messages: Array<any>; // For message history
  error: string | null; // For error tracking
  sendMessage: (event: string, data: any) => void; // For sending messages
}

export const useWebSocket = (
  url: string = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001',
  config: WebSocketConfig = {}
): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Array<any>>([]);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    autoConnect = true,
    reconnection = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000
  } = config;

  const connect = () => {
    if (socketRef.current && socketRef.current.connected) {
      return;
    }

    console.log('Connecting to WebSocket server:', url);

    socketRef.current = io(url, {
      autoConnect: false,
      reconnection,
      reconnectionAttempts,
      reconnectionDelay
    });

    // Connection event handlers
    socketRef.current.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null); // Clear error on successful connection
      
      // Clear any pending reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      
      // Attempt to reconnect if not explicitly disconnected
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, try to reconnect
        if (reconnection && reconnectionAttempts > 0) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectionDelay);
        }
      }
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
      setError(error.message || 'Connection error');
    });

    socketRef.current.on('error', (error) => {
      console.error('WebSocket error:', error);
      setError(error.message || error);
    });

    socketRef.current.on('message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    socketRef.current.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
    });

    socketRef.current.on('reconnect_error', (error) => {
      console.error('WebSocket reconnection error:', error);
    });

    socketRef.current.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed');
      setIsConnected(false);
    });

    // Connect
    socketRef.current.connect();
  };

  const disconnect = () => {
    if (socketRef.current) {
      console.log('Disconnecting from WebSocket server');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const subscribeToTest = (executionId: string) => {
    if (socketRef.current && isConnected) {
      console.log('Subscribing to test execution:', executionId);
      socketRef.current.emit('subscribe-test', executionId);
    }
  };

  const unsubscribeFromTest = (executionId: string) => {
    if (socketRef.current && isConnected) {
      console.log('Unsubscribing from test execution:', executionId);
      socketRef.current.emit('unsubscribe-test', executionId);
    }
  };

  const subscribeToProgress = () => {
    if (socketRef.current && isConnected) {
      console.log('Subscribing to progress updates');
      socketRef.current.emit('subscribe-progress');
    }
  };

  const unsubscribeFromProgress = () => {
    if (socketRef.current && isConnected) {
      console.log('Unsubscribing from progress updates');
      socketRef.current.emit('unsubscribe-progress');
    }
  };

  const cancelExecution = (executionId: string, reason: string) => {
    if (socketRef.current && isConnected) {
      console.log('Cancelling execution:', executionId, 'reason:', reason);
      socketRef.current.emit('cancel-execution', {
        execution_id: executionId,
        reason,
        cleanup_partial_results: true,
        notify_stakeholders: true
      });
    }
  };

  const getProgress = (executionId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('get-progress', executionId);
    }
  };

  const getActiveExecutions = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('get-active-executions');
    }
  };

  const sendMessage = (event: string, data: any) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, data);
    }
  };

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect]);

  return {
    socket: socketRef.current,
    isConnected,
    connected: isConnected, // Backward compatibility alias
    connect,
    disconnect,
    subscribeToTest,
    unsubscribeFromTest,
    subscribeToProgress,
    unsubscribeFromProgress,
    cancelExecution,
    getProgress,
    getActiveExecutions,
    messages,
    error,
    sendMessage
  };
};

export default useWebSocket;