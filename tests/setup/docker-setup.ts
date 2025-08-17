/**
 * Docker Test Setup Configuration
 * @description Global setup for Docker container testing
 */

import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Docker test configuration
global.DOCKER_CONFIG = {
  COMPOSE_FILE: 'docker/docker-compose.yml',
  TEST_NETWORK: 'prompt-card-test-network',
  HEALTH_CHECK_TIMEOUT: 60000,
  CONTAINER_START_TIMEOUT: 120000,
};

// Container management
let containersStarted = false;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DOCKER_TEST = 'true';
  
  console.log('🐳 Initializing Docker Test Environment...');
  
  try {
    // Ensure Docker is running
    await execAsync('docker --version');
    console.log('✅ Docker is available');
    
    // Cleanup any existing test containers
    await cleanupContainers();
    
    // Build test images
    console.log('Building test images...');
    await execAsync('docker-compose -f docker/docker-compose.yml build', { 
      cwd: process.cwd(),
      timeout: 300000 
    });
    
    console.log('🐳 Docker Test Environment Ready');
  } catch (error) {
    console.error('Failed to initialize Docker test environment:', error);
    throw new Error('Docker test environment setup failed. Ensure Docker is installed and running.');
  }
}, 600000);

afterAll(async () => {
  console.log('🐳 Cleaning up Docker Test Environment...');
  
  try {
    await cleanupContainers();
    console.log('🐳 Docker Test Environment Cleanup Complete');
  } catch (error) {
    console.error('Error during Docker cleanup:', error);
  }
}, 120000);

beforeEach(async () => {
  // Each test gets fresh containers
  if (containersStarted) {
    await cleanupContainers();
  }
});

afterEach(async () => {
  // Stop containers after each test
  if (containersStarted) {
    await stopContainers();
  }
});

// Utility functions
global.dockerUtils = {
  async startContainers(services: string[] = []) {
    console.log('Starting Docker containers...');
    
    const serviceArgs = services.length > 0 ? services.join(' ') : '';
    const command = `docker-compose -f ${global.DOCKER_CONFIG.COMPOSE_FILE} up -d ${serviceArgs}`;
    
    await execAsync(command, { 
      cwd: process.cwd(),
      timeout: global.DOCKER_CONFIG.CONTAINER_START_TIMEOUT 
    });
    
    containersStarted = true;
    
    // Wait for health checks
    await this.waitForHealthy(services);
    
    console.log('✅ Docker containers are ready');
  },
  
  async stopContainers() {
    if (!containersStarted) return;
    
    console.log('Stopping Docker containers...');
    await execAsync(`docker-compose -f ${global.DOCKER_CONFIG.COMPOSE_FILE} stop`, {
      cwd: process.cwd()
    });
    containersStarted = false;
  },
  
  async waitForHealthy(services: string[] = [], timeout = 60000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const { stdout } = await execAsync(
          `docker-compose -f ${global.DOCKER_CONFIG.COMPOSE_FILE} ps --format json`
        );
        
        const containers = stdout.trim().split('\n').map(line => JSON.parse(line));
        const unhealthy = containers.filter(container => 
          container.Health !== 'healthy' && 
          (services.length === 0 || services.includes(container.Service))
        );
        
        if (unhealthy.length === 0) {
          return;
        }
        
        console.log(`Waiting for containers to be healthy... (${unhealthy.length} remaining)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.log('Waiting for containers to start...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error('Containers did not become healthy within timeout');
  },
  
  async getContainerLogs(service: string) {
    try {
      const { stdout } = await execAsync(
        `docker-compose -f ${global.DOCKER_CONFIG.COMPOSE_FILE} logs ${service}`
      );
      return stdout;
    } catch (error) {
      return `Error getting logs: ${error}`;
    }
  },
  
  async execInContainer(service: string, command: string) {
    const { stdout } = await execAsync(
      `docker-compose -f ${global.DOCKER_CONFIG.COMPOSE_FILE} exec -T ${service} ${command}`
    );
    return stdout;
  },
};

async function cleanupContainers() {
  try {
    await execAsync(`docker-compose -f ${global.DOCKER_CONFIG.COMPOSE_FILE} down -v --remove-orphans`, {
      cwd: process.cwd()
    });
    containersStarted = false;
  } catch (error) {
    // Ignore cleanup errors
  }
}

async function stopContainers() {
  try {
    await execAsync(`docker-compose -f ${global.DOCKER_CONFIG.COMPOSE_FILE} stop`, {
      cwd: process.cwd()
    });
    containersStarted = false;
  } catch (error) {
    // Ignore stop errors
  }
}