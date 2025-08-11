// Global test setup - runs once before all tests
import { initializeDatabase } from '../database/connection';
import path from 'path';
import fs from 'fs';

export default async function globalSetup(): Promise<void> {
  console.log('🧪 Setting up global test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = path.join(__dirname, '../../data/test.sqlite');
  process.env.OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  
  // Ensure test data directory exists
  const testDataDir = path.dirname(process.env.DATABASE_PATH);
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
  
  // Clean up any existing test database
  if (fs.existsSync(process.env.DATABASE_PATH)) {
    fs.unlinkSync(process.env.DATABASE_PATH);
  }
  
  // Initialize test database
  try {
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('Database initialized successfully');
    console.log('✅ Test database initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
    console.error('❌ Failed to initialize test database:', error);
  }
  
  console.log('✅ Global test setup complete');
}