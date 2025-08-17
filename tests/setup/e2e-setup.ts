/**
 * End-to-End Test Setup Configuration
 * @description Global setup for E2E tests with full application stack
 */

import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// E2E test configuration
global.E2E_CONFIG = {
  FRONTEND_URL: 'http://localhost:3000',
  BACKEND_URL: 'http://localhost:8000',
  AUTH_URL: 'http://localhost:8005',
  TEST_TIMEOUT: 60000,
  PAGE_LOAD_TIMEOUT: 30000,
  ELEMENT_TIMEOUT: 10000,
};

// Application lifecycle management
let backendProcess: any;
let frontendProcess: any;
let authProcess: any;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.E2E_TEST = 'true';
  
  console.log('🎭 Starting E2E Test Environment...');
  
  try {
    // Start auth service
    console.log('Starting auth service...');
    authProcess = exec('cd auth && npm run dev', { env: { ...process.env, PORT: '8005' } });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Start backend
    console.log('Starting backend service...');
    backendProcess = exec('cd backend && npm run dev', { env: { ...process.env, PORT: '8000' } });
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Start frontend
    console.log('Starting frontend service...');
    frontendProcess = exec('cd frontend && npm run dev', { env: { ...process.env, PORT: '3000' } });
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Verify services are running
    await verifyServices();
    
    console.log('🎭 E2E Test Environment Ready');
  } catch (error) {
    console.error('Failed to start E2E environment:', error);
    throw error;
  }
}, 120000);

afterAll(async () => {
  console.log('🎭 Shutting down E2E Test Environment...');
  
  // Kill processes
  if (frontendProcess) frontendProcess.kill();
  if (backendProcess) backendProcess.kill();
  if (authProcess) authProcess.kill();
  
  // Give processes time to shut down
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('🎭 E2E Test Environment Cleanup Complete');
}, 30000);

beforeEach(async () => {
  // Reset database state before each test
  try {
    await fetch(`${global.E2E_CONFIG.BACKEND_URL}/api/test/reset`, {
      method: 'POST',
    });
  } catch (error) {
    console.warn('Could not reset test database:', error);
  }
});

afterEach(() => {
  // Cleanup after each test
  jest.restoreAllMocks();
});

async function verifyServices() {
  const services = [
    { name: 'Frontend', url: global.E2E_CONFIG.FRONTEND_URL },
    { name: 'Backend', url: `${global.E2E_CONFIG.BACKEND_URL}/api/health` },
    { name: 'Auth', url: `${global.E2E_CONFIG.AUTH_URL}/health` },
  ];
  
  for (const service of services) {
    let retries = 10;
    while (retries > 0) {
      try {
        const response = await fetch(service.url);
        if (response.ok) {
          console.log(`✅ ${service.name} service is ready`);
          break;
        }
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to verify ${service.name} service at ${service.url}`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
}