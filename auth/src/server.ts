#!/usr/bin/env node

import { buildApp } from './app';
import { initDatabase, closeDatabase } from './database/connection';
import { loadConfig } from './config/config';

async function start() {
  const config = loadConfig();
  
  try {
    console.log('🔐 Starting vLLM Authentication Service...');
    
    // Initialize database
    console.log('📊 Initializing database connection...');
    await initDatabase(config);
    
    // Build and start Fastify app
    console.log('🚀 Building application...');
    const app = buildApp();
    
    // Start server
    const address = await app.listen({
      port: config.port,
      host: '0.0.0.0'
    });
    
    console.log(`✅ Authentication service running on ${address}`);
    console.log(`📋 Environment: ${config.nodeEnv}`);
    console.log(`🔒 Security level: ${config.auditLogLevel}`);
    
    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
      
      try {
        console.log('🔌 Closing HTTP server...');
        await app.close();
        
        console.log('📊 Closing database connections...');
        await closeDatabase();
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };
    
    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    console.error('❌ Failed to start authentication service:', error);
    await closeDatabase();
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start the service
start();