// Global test teardown - runs once after all tests
import fs from 'fs';
import path from 'path';

export default async function globalTeardown(): Promise<void> {
  console.log('🧪 Cleaning up global test environment...');
  
  // Clean up test database
  const testDbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/test.sqlite');
  
  try {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      console.log('✅ Test database cleaned up');
    }
    
    // Clean up WAL and SHM files if they exist
    const walFile = testDbPath + '-wal';
    const shmFile = testDbPath + '-shm';
    
    if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
    if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
    
  } catch (error) {
    console.error('❌ Error cleaning up test database:', error);
  }
  
  console.log('✅ Global test teardown complete');
}