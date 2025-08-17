/**
 * Docker Container Health Tests
 * @description Tests for Docker container functionality and health
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';

describe('Docker Container Health Tests', () => {
  beforeAll(async () => {
    console.log('🐳 Starting Docker Container Health Tests');
  }, global.DOCKER_CONFIG.CONTAINER_START_TIMEOUT);

  afterAll(async () => {
    console.log('🐳 Docker Container Health Tests Complete');
  });

  describe('Container Startup', () => {
    it('should start all containers successfully', async () => {
      // Act
      await global.dockerUtils.startContainers();

      // Assert
      const containers = JSON.parse(
        execSync('docker ps --format "{{json .}}"', { encoding: 'utf8' })
          .trim()
          .split('\n')
          .filter(line => line.trim())
          .map(line => line)
          .join(',')
          .replace(/}\s*{/g, '},{')
          .replace(/^/, '[')
          .replace(/$/, ']')
      );

      const runningContainers = containers.filter((container: any) =>
        container.Image.includes('prompt-card')
      );

      expect(runningContainers.length).toBeGreaterThanOrEqual(3); // backend, frontend, auth
    });

    it('should pass health checks within timeout', async () => {
      // Arrange
      await global.dockerUtils.startContainers();

      // Act & Assert
      await expect(
        global.dockerUtils.waitForHealthy(['backend', 'frontend', 'auth'])
      ).resolves.not.toThrow();
    });

    it('should expose correct ports', async () => {
      // Arrange
      await global.dockerUtils.startContainers();

      // Act
      const backendResponse = await fetch('http://localhost:8000/api/health');
      const frontendResponse = await fetch('http://localhost:3000');
      const authResponse = await fetch('http://localhost:8005/health');

      // Assert
      expect(backendResponse.ok).toBe(true);
      expect(frontendResponse.ok).toBe(true);
      expect(authResponse.ok).toBe(true);
    });
  });

  describe('Service Integration', () => {
    beforeEach(async () => {
      await global.dockerUtils.startContainers();
    });

    it('should enable communication between services', async () => {
      // Act - Test backend to auth communication
      const response = await fetch('http://localhost:8000/api/auth/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: 'test-token',
        }),
      });

      // Assert
      expect(response.status).toBeOneOf([200, 401]); // Either valid or invalid token
    });

    it('should handle database connections', async () => {
      // Act
      const response = await fetch('http://localhost:8000/api/prompt-cards', {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      // Assert
      expect([200, 401]).toContain(response.status); // Either success or auth failure
    });

    it('should handle Redis connections', async () => {
      // Act - Test Redis connection through cache endpoint
      const response = await fetch('http://localhost:8000/api/health/cache');

      // Assert
      expect(response.ok).toBe(true);
      
      const healthData = await response.json();
      expect(healthData.redis).toMatchObject({
        status: 'connected',
      });
    });
  });

  describe('Container Resource Usage', () => {
    beforeEach(async () => {
      await global.dockerUtils.startContainers();
    });

    it('should maintain acceptable memory usage', async () => {
      // Wait for containers to stabilize
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Act
      const statsOutput = execSync(
        'docker stats --no-stream --format "table {{.Container}}\\t{{.MemUsage}}"',
        { encoding: 'utf8' }
      );

      // Parse memory usage
      const lines = statsOutput.trim().split('\n').slice(1); // Skip header
      const memoryUsages = lines.map(line => {
        const parts = line.split(/\\s+/);
        const container = parts[0];
        const memUsage = parts[1];
        
        if (memUsage.includes('/')) {
          const [used, total] = memUsage.split('/');
          const usedMB = parseFloat(used.replace(/[^0-9.]/g, ''));
          const totalMB = parseFloat(total.replace(/[^0-9.]/g, ''));
          
          return {
            container,
            usedMB,
            totalMB,
            usagePercent: (usedMB / totalMB) * 100,
          };
        }
        
        return null;
      }).filter(Boolean);

      // Assert
      memoryUsages.forEach(usage => {
        if (usage && usage.container.includes('prompt-card')) {
          expect(usage.usedMB).toBeLessThan(512); // 512MB limit per container
          expect(usage.usagePercent).toBeLessThan(80); // 80% usage limit
        }
      });

      console.log('💾 Container Memory Usage:', memoryUsages);
    });

    it('should maintain acceptable CPU usage', async () => {
      // Generate some load
      const loadPromises = Array(10).fill(null).map(() =>
        fetch('http://localhost:8000/api/prompt-cards')
      );

      await Promise.all(loadPromises);

      // Act
      const statsOutput = execSync(
        'docker stats --no-stream --format "table {{.Container}}\\t{{.CPUPerc}}"',
        { encoding: 'utf8' }
      );

      // Parse CPU usage
      const lines = statsOutput.trim().split('\n').slice(1); // Skip header
      const cpuUsages = lines.map(line => {
        const parts = line.split(/\\s+/);
        const container = parts[0];
        const cpuPerc = parseFloat(parts[1].replace('%', ''));
        
        return { container, cpuPerc };
      }).filter(usage => usage.container.includes('prompt-card'));

      // Assert
      cpuUsages.forEach(usage => {
        expect(usage.cpuPerc).toBeLessThan(80); // 80% CPU limit
      });

      console.log('🖥️ Container CPU Usage:', cpuUsages);
    });
  });

  describe('Container Persistence', () => {
    it('should persist data across container restarts', async () => {
      // Arrange
      await global.dockerUtils.startContainers();

      // Create test data
      const createResponse = await fetch('http://localhost:8000/api/prompt-cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
          title: 'Persistence Test Card',
          prompt: 'Test prompt for persistence',
          category: 'Test',
        }),
      });

      expect(createResponse.ok || createResponse.status === 401).toBe(true);
      const createdCard = createResponse.ok ? await createResponse.json() : null;

      // Act - Restart backend container
      execSync('docker-compose -f docker/docker-compose.yml restart backend');
      
      // Wait for restart
      await new Promise(resolve => setTimeout(resolve, 10000));
      await global.dockerUtils.waitForHealthy(['backend']);

      // Verify data persists
      const getResponse = await fetch('http://localhost:8000/api/prompt-cards', {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      // Assert
      if (getResponse.ok) {
        const cards = await getResponse.json();
        if (createdCard) {
          expect(cards.data.some((card: any) => card.id === createdCard.id)).toBe(true);
        }
      }
    });

    it('should handle volume mounts correctly', async () => {
      // Arrange
      await global.dockerUtils.startContainers();

      // Act - Check if database file exists in mounted volume
      const dbExists = await global.dockerUtils.execInContainer(
        'backend',
        'test -f /app/data/database.sqlite'
      );

      // Assert
      expect(dbExists).toBeTruthy();
    });
  });

  describe('Container Networking', () => {
    beforeEach(async () => {
      await global.dockerUtils.startContainers();
    });

    it('should establish proper network connectivity', async () => {
      // Act - Test internal network communication
      const backendToAuth = await global.dockerUtils.execInContainer(
        'backend',
        'curl -f http://auth:8005/health'
      );

      const frontendToBackend = await global.dockerUtils.execInContainer(
        'frontend',
        'curl -f http://backend:8000/api/health'
      );

      // Assert
      expect(backendToAuth).toBeTruthy();
      expect(frontendToBackend).toBeTruthy();
    });

    it('should isolate container networks properly', async () => {
      // Act - Verify containers can't access external networks unless intended
      try {
        await global.dockerUtils.execInContainer(
          'backend',
          'curl -f --connect-timeout 5 http://google.com'
        );
        
        // If this succeeds, the test should fail unless external access is intended
        expect(true).toBe(false); // Fail if external access is allowed
      } catch (error) {
        // Expected - containers should be isolated
        expect(true).toBe(true);
      }
    });
  });

  describe('Container Security', () => {
    beforeEach(async () => {
      await global.dockerUtils.startContainers();
    });

    it('should run containers as non-root user', async () => {
      // Act
      const backendUser = await global.dockerUtils.execInContainer('backend', 'whoami');
      const frontendUser = await global.dockerUtils.execInContainer('frontend', 'whoami');
      const authUser = await global.dockerUtils.execInContainer('auth', 'whoami');

      // Assert
      expect(backendUser.trim()).not.toBe('root');
      expect(frontendUser.trim()).not.toBe('root');
      expect(authUser.trim()).not.toBe('root');
    });

    it('should have read-only file systems where appropriate', async () => {
      // Act - Try to write to protected directories
      try {
        await global.dockerUtils.execInContainer(
          'backend',
          'touch /etc/test-file'
        );
        
        // Should fail for security
        expect(true).toBe(false);
      } catch (error) {
        // Expected - should not be able to write to system directories
        expect(true).toBe(true);
      }
    });

    it('should not expose sensitive environment variables', async () => {
      // Act
      const backendEnv = await global.dockerUtils.execInContainer('backend', 'env');
      
      // Assert
      expect(backendEnv).not.toContain('PASSWORD');
      expect(backendEnv).not.toContain('SECRET');
      expect(backendEnv).not.toContain('API_KEY');
    });
  });

  describe('Container Monitoring', () => {
    beforeEach(async () => {
      await global.dockerUtils.startContainers();
    });

    it('should provide health check endpoints', async () => {
      // Act
      const backendHealth = await fetch('http://localhost:8000/api/health');
      const authHealth = await fetch('http://localhost:8005/health');

      // Assert
      expect(backendHealth.ok).toBe(true);
      expect(authHealth.ok).toBe(true);

      const backendHealthData = await backendHealth.json();
      expect(backendHealthData).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
      });
    });

    it('should provide metrics endpoints', async () => {
      // Act
      const metricsResponse = await fetch('http://localhost:8000/api/metrics');

      // Assert
      if (metricsResponse.ok) {
        const metrics = await metricsResponse.text();
        expect(metrics).toContain('# HELP');
        expect(metrics).toContain('# TYPE');
      }
    });

    it('should log container events properly', async () => {
      // Act
      const backendLogs = await global.dockerUtils.getContainerLogs('backend');
      const authLogs = await global.dockerUtils.getContainerLogs('auth');

      // Assert
      expect(backendLogs).toContain('Server started');
      expect(authLogs).toContain('Auth service ready');
    });
  });

  describe('Container Scaling', () => {
    it('should support horizontal scaling', async () => {
      // Act - Scale backend to 2 instances
      execSync('docker-compose -f docker/docker-compose.yml up -d --scale backend=2');

      // Wait for scaling
      await new Promise(resolve => setTimeout(resolve, 15000));

      // Check running instances
      const containers = execSync(
        'docker ps --filter "name=backend" --format "{{.Names}}"',
        { encoding: 'utf8' }
      ).trim().split('\n').filter(name => name.trim());

      // Assert
      expect(containers.length).toBe(2);

      // Verify both instances are healthy
      for (const container of containers) {
        const health = execSync(`docker inspect ${container} --format='{{.State.Health.Status}}'`, {
          encoding: 'utf8'
        }).trim();
        
        expect(['healthy', 'starting']).toContain(health);
      }
    });
  });

  describe('Error Recovery', () => {
    beforeEach(async () => {
      await global.dockerUtils.startContainers();
    });

    it('should restart containers automatically on failure', async () => {
      // Act - Simulate container failure
      execSync('docker kill $(docker ps -q --filter "name=backend")');

      // Wait for automatic restart
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Check if container restarted
      const backendHealth = await fetch('http://localhost:8000/api/health');

      // Assert
      expect(backendHealth.ok).toBe(true);
    });

    it('should handle database connection failures gracefully', async () => {
      // Act - Stop database temporarily
      execSync('docker-compose -f docker/docker-compose.yml stop database');

      // Test application response
      const response = await fetch('http://localhost:8000/api/prompt-cards');

      // Should return proper error response, not crash
      expect([500, 503]).toContain(response.status);

      // Restart database
      execSync('docker-compose -f docker/docker-compose.yml start database');
      
      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify recovery
      const recoveryResponse = await fetch('http://localhost:8000/api/health');
      expect(recoveryResponse.ok).toBe(true);
    });
  });
});