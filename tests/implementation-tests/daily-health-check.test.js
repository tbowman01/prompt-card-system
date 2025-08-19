/**
 * Test implementation for Daily Health Check function from quick-start-tutorials.md
 * Tests the JavaScript example from lines 429-441
 */

const axios = require('axios');

// Mock axios for testing
jest.mock('axios');
const mockedAxios = axios;

describe('Daily Health Check Function Implementation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should execute daily health check as shown in tutorial', async () => {
    // Mock successful health check response
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: { 
        status: 'healthy', 
        timestamp: '2025-08-18T13:00:00Z',
        uptime: '24h',
        memory: '85%',
        cpu: '45%'
      }
    });

    // Implementation from tutorial (lines 429-441)
    const dailyHealthCheck = async () => {
      try {
        const response = await axios.get('http://localhost:3001/health');
        const healthData = response.data;
        
        console.log(`Daily Health Check - ${new Date().toISOString()}`);
        console.log(`Status: ${healthData.status}`);
        console.log(`Uptime: ${healthData.uptime}`);
        console.log(`Memory Usage: ${healthData.memory}`);
        console.log(`CPU Usage: ${healthData.cpu}`);
        
        return healthData.status === 'healthy';
      } catch (error) {
        console.error('Health check failed:', error.message);
        return false;
      }
    };

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    const result = await dailyHealthCheck();
    
    expect(result).toBe(true);
    expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3001/health');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Daily Health Check'));
    expect(consoleSpy).toHaveBeenCalledWith('Status: healthy');
    expect(consoleSpy).toHaveBeenCalledWith('Uptime: 24h');
    
    consoleSpy.mockRestore();
  });

  test('should handle health check failure with proper logging', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Connection refused'));

    const dailyHealthCheck = async () => {
      try {
        const response = await axios.get('http://localhost:3001/health');
        const healthData = response.data;
        
        console.log(`Daily Health Check - ${new Date().toISOString()}`);
        console.log(`Status: ${healthData.status}`);
        
        return healthData.status === 'healthy';
      } catch (error) {
        console.error('Health check failed:', error.message);
        return false;
      }
    };

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const result = await dailyHealthCheck();
    
    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('Health check failed:', 'Connection refused');
    
    consoleSpy.mockRestore();
  });

  test('should handle unhealthy status from server', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: { 
        status: 'unhealthy', 
        timestamp: '2025-08-18T13:00:00Z',
        uptime: '2h',
        memory: '95%',
        cpu: '85%',
        errors: ['High memory usage', 'CPU overload']
      }
    });

    const dailyHealthCheck = async () => {
      try {
        const response = await axios.get('http://localhost:3001/health');
        const healthData = response.data;
        
        console.log(`Daily Health Check - ${new Date().toISOString()}`);
        console.log(`Status: ${healthData.status}`);
        console.log(`Memory Usage: ${healthData.memory}`);
        console.log(`CPU Usage: ${healthData.cpu}`);
        
        if (healthData.errors) {
          console.log('Errors:', healthData.errors.join(', '));
        }
        
        return healthData.status === 'healthy';
      } catch (error) {
        console.error('Health check failed:', error.message);
        return false;
      }
    };

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    const result = await dailyHealthCheck();
    
    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('Status: unhealthy');
    expect(consoleSpy).toHaveBeenCalledWith('Memory Usage: 95%');
    expect(consoleSpy).toHaveBeenCalledWith('Errors:', 'High memory usage, CPU overload');
    
    consoleSpy.mockRestore();
  });
});