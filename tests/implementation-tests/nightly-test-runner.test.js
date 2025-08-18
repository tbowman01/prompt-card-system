/**
 * Test implementation for Nightly Test Runner from quick-start-tutorials.md
 * Tests the JavaScript example from lines 444-456
 */

const axios = require('axios');

// Mock axios for testing
jest.mock('axios');
const mockedAxios = axios;

describe('Nightly Test Runner Implementation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should execute nightly test runner as shown in tutorial', async () => {
    // Mock successful test execution response
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: { 
        testId: 'nightly-test-123',
        status: 'running',
        timestamp: '2025-08-18T02:00:00Z'
      }
    });

    // Mock test results polling
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: {
        testId: 'nightly-test-123',
        status: 'completed',
        results: {
          total: 150,
          passed: 148,
          failed: 2,
          duration: '45m 30s'
        }
      }
    });

    // Implementation from tutorial (lines 444-456)
    const nightlyTestRunner = async () => {
      try {
        console.log(`Starting nightly test run - ${new Date().toISOString()}`);
        
        // Start test execution
        const response = await axios.post('http://localhost:3001/api/test-execution/run', {
          type: 'nightly',
          timestamp: new Date().toISOString()
        });
        
        const testId = response.data.testId;
        console.log(`Test execution started with ID: ${testId}`);
        
        // Poll for results (simplified for test)
        const resultsResponse = await axios.get(`http://localhost:3001/api/test-execution/${testId}/results`);
        const results = resultsResponse.data.results;
        
        console.log(`Nightly tests completed:`);
        console.log(`Total: ${results.total}, Passed: ${results.passed}, Failed: ${results.failed}`);
        console.log(`Duration: ${results.duration}`);
        
        return results.failed === 0;
      } catch (error) {
        console.error('Nightly test run failed:', error.message);
        return false;
      }
    };

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    const result = await nightlyTestRunner();
    
    expect(result).toBe(false); // 2 failed tests
    expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:3001/api/test-execution/run', {
      type: 'nightly',
      timestamp: expect.any(String)
    });
    expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3001/api/test-execution/nightly-test-123/results');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Starting nightly test run'));
    expect(consoleSpy).toHaveBeenCalledWith('Test execution started with ID: nightly-test-123');
    expect(consoleSpy).toHaveBeenCalledWith('Total: 150, Passed: 148, Failed: 2');
    
    consoleSpy.mockRestore();
  });

  test('should handle all tests passing scenario', async () => {
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: { 
        testId: 'nightly-test-456',
        status: 'running'
      }
    });

    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: {
        testId: 'nightly-test-456',
        status: 'completed',
        results: {
          total: 150,
          passed: 150,
          failed: 0,
          duration: '42m 15s'
        }
      }
    });

    const nightlyTestRunner = async () => {
      try {
        console.log(`Starting nightly test run - ${new Date().toISOString()}`);
        
        const response = await axios.post('http://localhost:3001/api/test-execution/run', {
          type: 'nightly',
          timestamp: new Date().toISOString()
        });
        
        const testId = response.data.testId;
        const resultsResponse = await axios.get(`http://localhost:3001/api/test-execution/${testId}/results`);
        const results = resultsResponse.data.results;
        
        console.log(`Nightly tests completed:`);
        console.log(`Total: ${results.total}, Passed: ${results.passed}, Failed: ${results.failed}`);
        
        return results.failed === 0;
      } catch (error) {
        console.error('Nightly test run failed:', error.message);
        return false;
      }
    };

    const result = await nightlyTestRunner();
    
    expect(result).toBe(true); // All tests passed
  });

  test('should handle test execution startup failure', async () => {
    mockedAxios.post.mockRejectedValue(new Error('Service unavailable'));

    const nightlyTestRunner = async () => {
      try {
        console.log(`Starting nightly test run - ${new Date().toISOString()}`);
        
        const response = await axios.post('http://localhost:3001/api/test-execution/run', {
          type: 'nightly',
          timestamp: new Date().toISOString()
        });
        
        return true;
      } catch (error) {
        console.error('Nightly test run failed:', error.message);
        return false;
      }
    };

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const result = await nightlyTestRunner();
    
    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('Nightly test run failed:', 'Service unavailable');
    
    consoleSpy.mockRestore();
  });
});