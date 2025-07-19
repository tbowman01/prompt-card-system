import { NextRequest, NextResponse } from 'next/server';
import os from 'os';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  service: string;
  version: string;
  environment: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  details?: {
    [key: string]: any;
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryPercentage = (usedMemory / totalMemory) * 100;
    
    // Check backend connectivity
    let backendStatus: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy';
    let backendMessage = '';
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const backendResponse = await fetch(`${backendUrl}/api/health`, {
        signal: AbortSignal.timeout(3000)
      });
      
      if (backendResponse.ok) {
        backendStatus = 'healthy';
      } else {
        backendStatus = 'degraded';
        backendMessage = `Backend returned ${backendResponse.status}`;
      }
    } catch (error) {
      backendStatus = 'unhealthy';
      backendMessage = error instanceof Error ? error.message : 'Backend connection failed';
    }
    
    // Determine overall health
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (backendStatus === 'unhealthy' || memoryPercentage > 90) {
      overallStatus = 'unhealthy';
    } else if (backendStatus === 'degraded' || memoryPercentage > 80) {
      overallStatus = 'degraded';
    }
    
    const health: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'prompt-card-frontend',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
      },
      details: {
        backend: {
          status: backendStatus,
          message: backendMessage || undefined,
          url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        },
        system: {
          platform: os.platform(),
          nodeVersion: process.version,
          cpus: os.cpus().length,
          loadAverage: os.loadavg(),
          systemMemory: {
            used: Math.round(usedMemory / 1024 / 1024 / 1024 * 100) / 100,
            total: Math.round(totalMemory / 1024 / 1024 / 1024 * 100) / 100,
            percentage: Math.round(memoryPercentage)
          }
        },
        responseTime: Date.now() - startTime
      }
    };
    
    return NextResponse.json(health, {
      status: overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': overallStatus
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'prompt-card-frontend',
        error: error instanceof Error ? error.message : 'Health check failed',
        responseTime: Date.now() - startTime
      },
      { status: 503 }
    );
  }
}

// Readiness endpoint for container orchestration
export async function HEAD(request: NextRequest) {
  try {
    // Simple check - if we can respond, we're ready
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}