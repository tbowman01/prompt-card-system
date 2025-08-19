/**
 * Test implementation for API Health Check code from quick-start-tutorials.md
 * Tests the JavaScript example from lines 41-44
 */

const axios = require('axios');

// Mock axios for testing
jest.mock('axios');
const mockedAxios = axios;

describe('API Health Check Implementation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should perform health check as shown in tutorial', async () => {
    // Mock successful response
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: { status: 'healthy', timestamp: '2025-08-18T13:00:00Z' }
    });

    // Implementation from tutorial (lines 41-44)
    const healthCheck = async () => {
      const response = await axios.get('http://localhost:3001/health');
      return response.status === 200;
    };

    const result = await healthCheck();
    
    expect(result).toBe(true);
    expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3001/health');
  });

  test('should handle health check failure', async () => {
    // Mock failed response
    mockedAxios.get.mockRejectedValue(new Error('Network Error'));

    const healthCheck = async () => {
      try {
        const response = await axios.get('http://localhost:3001/health');
        return response.status === 200;
      } catch (error) {
        return false;
      }
    };

    const result = await healthCheck();
    
    expect(result).toBe(false);
  });

  test('should handle non-200 status codes', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 503,
      data: { status: 'unhealthy' }
    });

    const healthCheck = async () => {
      const response = await axios.get('http://localhost:3001/health');
      return response.status === 200;
    };

    const result = await healthCheck();
    
    expect(result).toBe(false);
  });
});