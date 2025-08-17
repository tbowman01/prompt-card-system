/**
 * useWebSocket Hook Unit Tests
 * @description Comprehensive tests for WebSocket hook functionality
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock WebSocket
const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: WebSocket.CONNECTING,
};

global.WebSocket = jest.fn(() => mockWebSocket) as any;

import { useWebSocket } from '../../../../frontend/src/hooks/useWebSocket';

describe('useWebSocket Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWebSocket.readyState = WebSocket.CONNECTING;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Connection Management', () => {
    it('should establish WebSocket connection', () => {
      // Act
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080')
      );

      // Assert
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8080');
      expect(result.current.connectionState).toBe('connecting');
    });

    it('should handle connection open', () => {
      // Arrange
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080')
      );

      // Act
      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        const openHandler = mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'open')?.[1];
        openHandler?.();
      });

      // Assert
      expect(result.current.connectionState).toBe('connected');
    });

    it('should handle connection close', () => {
      // Arrange
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080')
      );

      // Act
      act(() => {
        mockWebSocket.readyState = WebSocket.CLOSED;
        const closeHandler = mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'close')?.[1];
        closeHandler?.({ code: 1000, reason: 'Normal closure' });
      });

      // Assert
      expect(result.current.connectionState).toBe('disconnected');
      expect(result.current.lastError).toBeNull();
    });

    it('should handle connection error', () => {
      // Arrange
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080')
      );

      // Act
      act(() => {
        const errorHandler = mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'error')?.[1];
        errorHandler?.({ error: 'Connection failed' });
      });

      // Assert
      expect(result.current.connectionState).toBe('error');
      expect(result.current.lastError).toBeTruthy();
    });
  });

  describe('Message Handling', () => {
    it('should receive and store messages', () => {
      // Arrange
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080')
      );

      const testMessage = { type: 'test', data: 'hello world' };

      // Act
      act(() => {
        const messageHandler = mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'message')?.[1];
        messageHandler?.({ data: JSON.stringify(testMessage) });
      });

      // Assert
      expect(result.current.lastMessage).toEqual(testMessage);
      expect(result.current.messages).toContainEqual(testMessage);
    });

    it('should handle malformed messages gracefully', () => {
      // Arrange
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080')
      );

      // Act
      act(() => {
        const messageHandler = mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'message')?.[1];
        messageHandler?.({ data: 'invalid json' });
      });

      // Assert
      expect(result.current.lastMessage).toBeNull();
      expect(result.current.lastError).toBeTruthy();
    });

    it('should limit message history', () => {
      // Arrange
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080', { maxMessages: 2 })
      );

      // Act
      act(() => {
        const messageHandler = mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'message')?.[1];
        
        // Send 3 messages
        messageHandler?.({ data: JSON.stringify({ id: 1 }) });
        messageHandler?.({ data: JSON.stringify({ id: 2 }) });
        messageHandler?.({ data: JSON.stringify({ id: 3 }) });
      });

      // Assert
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]).toEqual({ id: 2 });
      expect(result.current.messages[1]).toEqual({ id: 3 });
    });
  });

  describe('Message Sending', () => {
    it('should send messages when connected', () => {
      // Arrange
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080')
      );

      // Act
      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        result.current.sendMessage({ type: 'test', data: 'hello' });
      });

      // Assert
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'test', data: 'hello' })
      );
    });

    it('should queue messages when not connected', () => {
      // Arrange
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080')
      );

      // Act
      act(() => {
        mockWebSocket.readyState = WebSocket.CONNECTING;
        result.current.sendMessage({ type: 'test', data: 'hello' });
      });

      // Assert
      expect(mockWebSocket.send).not.toHaveBeenCalled();
      expect(result.current.queuedMessages).toHaveLength(1);
    });

    it('should send queued messages when connection opens', () => {
      // Arrange
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080')
      );

      // Queue a message while disconnected
      act(() => {
        mockWebSocket.readyState = WebSocket.CONNECTING;
        result.current.sendMessage({ type: 'test', data: 'hello' });
      });

      // Act - Connection opens
      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        const openHandler = mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'open')?.[1];
        openHandler?.();
      });

      // Assert
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'test', data: 'hello' })
      );
      expect(result.current.queuedMessages).toHaveLength(0);
    });

    it('should handle send errors', () => {
      // Arrange
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080')
      );

      mockWebSocket.send.mockImplementation(() => {
        throw new Error('Send failed');
      });

      // Act
      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        result.current.sendMessage({ type: 'test' });
      });

      // Assert
      expect(result.current.lastError).toBeTruthy();
    });
  });

  describe('Reconnection', () => {
    it('should attempt reconnection on close', async () => {
      // Arrange
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080', { reconnectAttempts: 2 })
      );

      // Act
      act(() => {
        const closeHandler = mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'close')?.[1];
        closeHandler?.({ code: 1006, reason: 'Abnormal closure' });
      });

      // Assert
      expect(result.current.reconnectAttempts).toBe(1);
      
      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(global.WebSocket).toHaveBeenCalledTimes(2);
    });

    it('should not reconnect on normal closure', () => {
      // Arrange
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080', { reconnectAttempts: 2 })
      );

      // Act
      act(() => {
        const closeHandler = mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'close')?.[1];
        closeHandler?.({ code: 1000, reason: 'Normal closure' });
      });

      // Assert
      expect(result.current.reconnectAttempts).toBe(0);
    });

    it('should stop reconnecting after max attempts', async () => {
      // Arrange
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080', { reconnectAttempts: 1 })
      );

      // Act - First reconnection attempt
      act(() => {
        const closeHandler = mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'close')?.[1];
        closeHandler?.({ code: 1006, reason: 'Abnormal closure' });
      });

      // Act - Second failure (should stop trying)
      act(() => {
        const closeHandler = mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'close')?.[1];
        closeHandler?.({ code: 1006, reason: 'Abnormal closure' });
      });

      // Assert
      expect(result.current.connectionState).toBe('failed');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on unmount', () => {
      // Arrange
      const { unmount } = renderHook(() => 
        useWebSocket('ws://localhost:8080')
      );

      // Act
      unmount();

      // Assert
      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it('should remove event listeners on unmount', () => {
      // Arrange
      const { unmount } = renderHook(() => 
        useWebSocket('ws://localhost:8080')
      );

      // Act
      unmount();

      // Assert
      expect(mockWebSocket.removeEventListener).toHaveBeenCalledTimes(4);
    });
  });

  describe('Configuration', () => {
    it('should respect custom options', () => {
      // Arrange
      const options = {
        maxMessages: 50,
        reconnectAttempts: 5,
        reconnectInterval: 2000,
      };

      // Act
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080', options)
      );

      // Assert
      expect(result.current.options).toMatchObject(options);
    });

    it('should use default options when not provided', () => {
      // Act
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080')
      );

      // Assert
      expect(result.current.options.maxMessages).toBe(100);
      expect(result.current.options.reconnectAttempts).toBe(3);
      expect(result.current.options.reconnectInterval).toBe(1000);
    });
  });

  describe('Message Filtering', () => {
    it('should filter messages by type', () => {
      // Arrange
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080')
      );

      // Act
      act(() => {
        const messageHandler = mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'message')?.[1];
        
        messageHandler?.({ data: JSON.stringify({ type: 'status', data: 'connected' }) });
        messageHandler?.({ data: JSON.stringify({ type: 'data', data: 'payload' }) });
        messageHandler?.({ data: JSON.stringify({ type: 'status', data: 'idle' }) });
      });

      // Assert
      const statusMessages = result.current.getMessagesByType('status');
      expect(statusMessages).toHaveLength(2);
      expect(statusMessages[0].data).toBe('connected');
      expect(statusMessages[1].data).toBe('idle');
    });

    it('should return empty array for unknown message type', () => {
      // Arrange
      const { result } = renderHook(() => 
        useWebSocket('ws://localhost:8080')
      );

      // Act
      const unknownMessages = result.current.getMessagesByType('unknown');

      // Assert
      expect(unknownMessages).toEqual([]);
    });
  });
});