// Setup MSW for testing environment only
import { setupServer } from 'msw/node'
import { handlers } from '../mocks/handlers'

// Setup server with request handlers
const server = setupServer(...handlers)

// Establish API mocking before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' })
})

// Reset any request handlers between tests
afterEach(() => server.resetHandlers())

// Clean up after tests are complete
afterAll(() => server.close())

export { server }