import { Router } from 'express';
import { performanceMonitor } from '../services/performance/PerformanceMonitor';
import { AnalyticsEngine } from '../services/analytics/AnalyticsEngine';
import { ReportGenerator } from '../services/reports/generators/ReportGenerator';
import { OptimizationEngine } from '../services/optimization/OptimizationEngine';
import { TestQueueManager } from '../services/testing/TestQueueManager';
import { ProgressService } from '../services/websocket/ProgressService';

const router = Router();

// Initialize services for performance monitoring
const analyticsEngine = AnalyticsEngine.getInstance();

/**
 * GET /performance/overview
 * Get overall performance overview
 */
router.get('/overview', async (req, res) => {
  try {
    const [
      systemMetrics,
      applicationMetrics,
      summary,
      alerts
    ] = await Promise.all([
      performanceMonitor.getSystemMetrics(),
      performanceMonitor.getApplicationMetrics(),
      performanceMonitor.getPerformanceSummary(),
      performanceMonitor.getActiveAlerts()
    ]);

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        systemMetrics,
        applicationMetrics,
        summary,
        alerts,
        uptime: process.uptime(),
        version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /performance/metrics
 * Get performance metrics for a specific metric name
 */
router.get('/metrics/:metricName?', (req, res) => {
  try {
    const { metricName } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    if (metricName) {
      const metrics = performanceMonitor.getMetrics(metricName, limit);
      res.json({
        success: true,
        data: {
          metricName,
          metrics,
          count: metrics.length
        }
      });
    } else {
      const metricNames = performanceMonitor.getMetricNames();
      const statistics = performanceMonitor.getStatistics();
      
      res.json({
        success: true,
        data: {
          metricNames,
          statistics,
          totalMetrics: metricNames.length
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /performance/alerts
 * Get active performance alerts
 */
router.get('/alerts', (req, res) => {
  try {
    const alerts = performanceMonitor.getActiveAlerts();
    const severity = req.query.severity as string;
    
    let filteredAlerts = alerts;
    if (severity) {
      filteredAlerts = alerts.filter(alert => alert.severity === severity);
    }

    res.json({
      success: true,
      data: {
        alerts: filteredAlerts,
        total: alerts.length,
        filtered: filteredAlerts.length,
        severityBreakdown: {
          critical: alerts.filter(a => a.severity === 'critical').length,
          high: alerts.filter(a => a.severity === 'high').length,
          medium: alerts.filter(a => a.severity === 'medium').length,
          low: alerts.filter(a => a.severity === 'low').length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /performance/system
 * Get detailed system performance metrics
 */
router.get('/system', async (req, res) => {
  try {
    const systemMetrics = await performanceMonitor.getSystemMetrics();
    const nodeMetrics = {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
      pid: process.pid,
      version: process.version,
      versions: process.versions
    };

    res.json({
      success: true,
      data: {
        system: systemMetrics,
        node: nodeMetrics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /performance/services
 * Get performance statistics for all services
 */
router.get('/services', async (req, res) => {
  try {
    const serviceStats = {
      analytics: analyticsEngine.getQueryPerformanceStats ? analyticsEngine.getQueryPerformanceStats() : {},
      cacheStats: analyticsEngine.getCacheStats ? analyticsEngine.getCacheStats() : {},
      optimization: {
        // Would get from optimization engine if available
        cacheHitRate: 0,
        avgProcessingTime: 0
      },
      testing: {
        // Would get from test queue manager if available
        queueSize: 0,
        activeJobs: 0,
        avgExecutionTime: 0
      },
      websocket: {
        // Would get from progress service if available
        activeConnections: 0,
        messagesSent: 0,
        avgLatency: 0
      }
    };

    res.json({
      success: true,
      data: serviceStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /performance/database
 * Get database performance metrics
 */
router.get('/database', async (req, res) => {
  try {
    // Get analytics engine performance stats
    const analyticsStats = analyticsEngine.getQueryPerformanceStats ? 
      analyticsEngine.getQueryPerformanceStats() : {};
    
    const cacheStats = analyticsEngine.getCacheStats ? 
      analyticsEngine.getCacheStats() : { size: 0, max: 0, hitRate: 0 };

    // Calculate database performance metrics
    const dbMetrics = {
      queryStats: analyticsStats,
      cacheStats,
      connections: {
        active: 1, // SQLite is single connection
        idle: 0,
        total: 1
      },
      performance: {
        avgQueryTime: Object.values(analyticsStats).length > 0 ? 
          Object.values(analyticsStats).reduce((sum: number, stat: any) => sum + stat.avg, 0) / Object.values(analyticsStats).length : 0,
        slowQueries: Object.values(analyticsStats).filter((stat: any) => stat.avg > 100).length,
        totalQueries: Object.values(analyticsStats).reduce((sum: number, stat: any) => sum + stat.count, 0)
      }
    };

    res.json({
      success: true,
      data: dbMetrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /performance/bottlenecks
 * Identify performance bottlenecks
 */
router.get('/bottlenecks', async (req, res) => {
  try {
    const statistics = performanceMonitor.getStatistics();
    const alerts = performanceMonitor.getActiveAlerts();
    
    // Identify bottlenecks based on performance data
    const bottlenecks = [];
    
    // CPU bottlenecks
    if (statistics.cpu_usage && statistics.cpu_usage.avg > 80) {
      bottlenecks.push({
        type: 'cpu',
        severity: statistics.cpu_usage.avg > 90 ? 'critical' : 'high',
        description: `High CPU usage: ${statistics.cpu_usage.avg.toFixed(1)}%`,
        recommendation: 'Consider optimizing CPU-intensive operations or scaling horizontally'
      });
    }
    
    // Memory bottlenecks
    if (statistics.memory_usage && statistics.memory_usage.avg > 85) {
      bottlenecks.push({
        type: 'memory',
        severity: statistics.memory_usage.avg > 95 ? 'critical' : 'high',
        description: `High memory usage: ${statistics.memory_usage.avg.toFixed(1)}%`,
        recommendation: 'Consider optimizing memory usage or increasing available memory'
      });
    }
    
    // Response time bottlenecks
    if (statistics.app_response_time && statistics.app_response_time.avg > 2000) {
      bottlenecks.push({
        type: 'response_time',
        severity: statistics.app_response_time.avg > 5000 ? 'critical' : 'high',
        description: `Slow response time: ${statistics.app_response_time.avg.toFixed(0)}ms`,
        recommendation: 'Optimize database queries, enable caching, or improve algorithm efficiency'
      });
    }
    
    // Database query bottlenecks
    const dbStats = analyticsEngine.getQueryPerformanceStats ? 
      analyticsEngine.getQueryPerformanceStats() : {};
    
    Object.entries(dbStats).forEach(([queryName, stats]: [string, any]) => {
      if (stats.avg > 100) {
        bottlenecks.push({
          type: 'database',
          severity: stats.avg > 500 ? 'critical' : stats.avg > 200 ? 'high' : 'medium',
          description: `Slow query: ${queryName} (${stats.avg.toFixed(1)}ms avg)`,
          recommendation: 'Add database indexes, optimize query structure, or implement query result caching'
        });
      }
    });

    res.json({
      success: true,
      data: {
        bottlenecks,
        totalBottlenecks: bottlenecks.length,
        severityBreakdown: {
          critical: bottlenecks.filter(b => b.severity === 'critical').length,
          high: bottlenecks.filter(b => b.severity === 'high').length,
          medium: bottlenecks.filter(b => b.severity === 'medium').length
        },
        recommendations: bottlenecks.map(b => b.recommendation)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /performance/recommendations
 * Get performance optimization recommendations
 */
router.get('/recommendations', async (req, res) => {
  try {
    const systemMetrics = await performanceMonitor.getSystemMetrics();
    const appMetrics = performanceMonitor.getApplicationMetrics();
    const statistics = performanceMonitor.getStatistics();
    
    const recommendations = [];
    
    // CPU optimization recommendations
    if (systemMetrics.cpu.usage > 70) {
      recommendations.push({
        category: 'cpu',
        priority: systemMetrics.cpu.usage > 90 ? 'high' : 'medium',
        title: 'Optimize CPU Usage',
        description: 'High CPU usage detected. Consider implementing the following optimizations:',
        actions: [
          'Enable CPU-intensive task queuing',
          'Implement worker threads for parallel processing',
          'Optimize algorithm complexity',
          'Consider horizontal scaling'
        ]
      });
    }
    
    // Memory optimization recommendations
    if (systemMetrics.memory.utilization > 80) {
      recommendations.push({
        category: 'memory',
        priority: systemMetrics.memory.utilization > 95 ? 'high' : 'medium',
        title: 'Optimize Memory Usage',
        description: 'High memory utilization detected. Consider implementing the following optimizations:',
        actions: [
          'Implement memory-efficient data structures',
          'Add result caching with TTL',
          'Optimize object pooling',
          'Review memory leaks'
        ]
      });
    }
    
    // Database optimization recommendations
    const dbStats = analyticsEngine.getQueryPerformanceStats ? 
      analyticsEngine.getQueryPerformanceStats() : {};
    
    const slowQueries = Object.entries(dbStats).filter(([_, stats]: [string, any]) => stats.avg > 100);
    
    if (slowQueries.length > 0) {
      recommendations.push({
        category: 'database',
        priority: 'high',
        title: 'Optimize Database Performance',
        description: `${slowQueries.length} slow queries detected. Consider implementing the following optimizations:`,
        actions: [
          'Add indexes for frequently queried columns',
          'Implement query result caching',
          'Optimize database schema',
          'Use prepared statements',
          'Consider database connection pooling'
        ]
      });
    }
    
    // Cache optimization recommendations
    const cacheStats = analyticsEngine.getCacheStats ? analyticsEngine.getCacheStats() : null;
    
    if (cacheStats && cacheStats.hitRate < 70) {
      recommendations.push({
        category: 'cache',
        priority: 'medium',
        title: 'Improve Cache Performance',
        description: `Cache hit rate is ${cacheStats.hitRate?.toFixed(1)}%. Consider implementing the following optimizations:`,
        actions: [
          'Increase cache size limits',
          'Optimize cache TTL values',
          'Implement cache warming',
          'Add cache prefetching for predictable queries'
        ]
      });
    }
    
    // Response time optimization recommendations
    if (appMetrics.averageResponseTime > 1000) {
      recommendations.push({
        category: 'response_time',
        priority: appMetrics.averageResponseTime > 3000 ? 'high' : 'medium',
        title: 'Optimize Response Time',
        description: `Average response time is ${appMetrics.averageResponseTime.toFixed(0)}ms. Consider implementing the following optimizations:`,
        actions: [
          'Implement result caching',
          'Optimize critical path algorithms',
          'Add async processing for non-critical operations',
          'Consider CDN for static assets'
        ]
      });
    }

    res.json({
      success: true,
      data: {
        recommendations,
        totalRecommendations: recommendations.length,
        priorityBreakdown: {
          high: recommendations.filter(r => r.priority === 'high').length,
          medium: recommendations.filter(r => r.priority === 'medium').length,
          low: recommendations.filter(r => r.priority === 'low').length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /performance/thresholds
 * Set custom performance thresholds
 */
router.post('/thresholds', (req, res) => {
  try {
    const { metricName, warning, critical } = req.body;
    
    if (!metricName || typeof warning !== 'number' || typeof critical !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body. Required: metricName, warning, critical'
      });
    }
    
    if (critical <= warning) {
      return res.status(400).json({
        success: false,
        error: 'Critical threshold must be greater than warning threshold'
      });
    }
    
    performanceMonitor.setThreshold(metricName, warning, critical);
    
    res.json({
      success: true,
      data: {
        metricName,
        warning,
        critical,
        message: 'Threshold updated successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /performance/clear
 * Clear performance metrics and alerts
 */
router.post('/clear', (req, res) => {
  try {
    performanceMonitor.clear();
    
    res.json({
      success: true,
      data: {
        message: 'Performance metrics and alerts cleared successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /performance/export
 * Export performance data
 */
router.get('/export', (req, res) => {
  try {
    const exportData = performanceMonitor.exportMetrics();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="performance-metrics.json"');
    res.send(exportData);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /performance/health
 * Quick health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const summary = performanceMonitor.getPerformanceSummary();
    const alerts = performanceMonitor.getActiveAlerts();
    
    const health = {
      status: summary.systemHealth,
      uptime: summary.uptime,
      timestamp: new Date().toISOString(),
      version: process.version,
      memory: process.memoryUsage(),
      activeAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length
    };
    
    const statusCode = summary.systemHealth === 'critical' ? 503 : 
                      summary.systemHealth === 'warning' ? 200 : 200;
    
    res.status(statusCode).json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;