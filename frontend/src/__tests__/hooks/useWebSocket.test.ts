import { renderHook, act } from '@testing-library/react'
import { useWebSocket } from '@/hooks/useWebSocket'

// Mock socket.io-client
jest.mock('socket.io-client', () => {
  const mockSocket = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connected: false,
  }
  
  return {
    io: jest.fn(() => mockSocket),
    __mockSocket: mockSocket,
  }
})

import { io } from 'socket.io-client'

const mockSocket = (io as any).__mockSocket

describe('useWebSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSocket.connected = false
  })

  it('initializes with disconnected state', () => {
    const { result } = renderHook(() => useWebSocket('http://localhost:3001'))

    expect(result.current.connected).toBe(false)
    expect(result.current.messages).toEqual([])
    expect(result.current.error).toBe(null)
  })

  it('connects to WebSocket server', () => {
    renderHook(() => useWebSocket('http://localhost:3001'))

    expect(io).toHaveBeenCalledWith('http://localhost:3001', {
      transports: ['websocket'],
      autoConnect: true,
    })
  })

  it('handles connection events', () => {
    const { result } = renderHook(() => useWebSocket('http://localhost:3001'))

    // Simulate connect event
    const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1]
    act(() => {
      mockSocket.connected = true
      connectHandler()
    })

    expect(result.current.connected).toBe(true)
    expect(result.current.error).toBe(null)
  })

  it('handles disconnect events', () => {
    const { result } = renderHook(() => useWebSocket('http://localhost:3001'))

    // First connect
    const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1]
    act(() => {
      mockSocket.connected = true
      connectHandler()
    })

    // Then disconnect
    const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1]
    act(() => {
      mockSocket.connected = false
      disconnectHandler()
    })

    expect(result.current.connected).toBe(false)
  })

  it('handles error events', () => {
    const { result } = renderHook(() => useWebSocket('http://localhost:3001'))

    const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'error')[1]
    const errorMessage = 'Connection failed'
    
    act(() => {
      errorHandler(errorMessage)
    })

    expect(result.current.error).toBe(errorMessage)
  })

  it('handles message events', () => {
    const { result } = renderHook(() => useWebSocket('http://localhost:3001'))

    const messageHandler = mockSocket.on.mock.calls.find(call => call[0] === 'message')[1]
    const testMessage = { type: 'test', data: 'test data' }
    
    act(() => {
      messageHandler(testMessage)
    })

    expect(result.current.messages).toEqual([testMessage])
  })

  it('accumulates multiple messages', () => {
    const { result } = renderHook(() => useWebSocket('http://localhost:3001'))

    const messageHandler = mockSocket.on.mock.calls.find(call => call[0] === 'message')[1]
    
    act(() => {
      messageHandler({ type: 'message1', data: 'data1' })
      messageHandler({ type: 'message2', data: 'data2' })
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0]).toEqual({ type: 'message1', data: 'data1' })
    expect(result.current.messages[1]).toEqual({ type: 'message2', data: 'data2' })
  })

  it('provides sendMessage function', () => {
    const { result } = renderHook(() => useWebSocket('http://localhost:3001'))

    act(() => {
      result.current.sendMessage('test-event', { data: 'test' })
    })

    expect(mockSocket.emit).toHaveBeenCalledWith('test-event', { data: 'test' })
  })

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket('http://localhost:3001'))

    unmount()

    expect(mockSocket.disconnect).toHaveBeenCalled()
  })

  it('removes event listeners on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket('http://localhost:3001'))

    unmount()

    // Should call off for each event type
    expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function))
    expect(mockSocket.off).toHaveBeenCalledWith('disconnect', expect.any(Function))
    expect(mockSocket.off).toHaveBeenCalledWith('error', expect.any(Function))
    expect(mockSocket.off).toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('handles reconnection attempts', () => {
    const { result } = renderHook(() => useWebSocket('http://localhost:3001'))

    // Simulate disconnect
    const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1]
    act(() => {
      mockSocket.connected = false
      disconnectHandler()
    })

    expect(result.current.connected).toBe(false)

    // Simulate reconnect
    const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1]
    act(() => {
      mockSocket.connected = true
      connectHandler()
    })

    expect(result.current.connected).toBe(true)
    expect(result.current.error).toBe(null) // Error should be cleared on reconnect
  })

  it('handles custom options', () => {
    const customOptions = {
      transports: ['polling'],
      autoConnect: false,
    }

    renderHook(() => useWebSocket('http://localhost:3001', customOptions))

    expect(io).toHaveBeenCalledWith('http://localhost:3001', customOptions)
  })
})