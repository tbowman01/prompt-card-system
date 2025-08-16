import { EventEmitter } from 'events';
import { Logger } from '../../utils/Logger';

export interface EdgeLocation {
  id: string;
  region: string;
  country: string;
  city: string;
  coordinates: { lat: number; lng: number };
  status: 'active' | 'inactive' | 'degraded';
}

export interface EdgeMetrics {
  latency: Record<string, number>;
  availability: Record<string, number>;
  throughput: Record<string, number>;
  errorRate: Record<string, number>;
  transferCost: number;
  totalConnections: Record<string, number>;
  bandwidth: Record<string, number>;
  timestamp: number;
}

export interface EdgePerformanceAlert {
  locationId: string;
  metric: 'latency' | 'availability' | 'throughput' | 'errors';
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: number;
}

export interface GeographicDistribution {
  region: string;
  requestCount: number;
  averageLatency: number;
  errorRate: number;
  revenue: number;
  userSatisfaction: number;
}

export class EdgeMonitor extends EventEmitter {
  private logger = Logger.getInstance();
  private isInitialized = false;
  
  // Edge locations configuration
  private edgeLocations = new Map<string, EdgeLocation>();
  private edgeMetricsHistory = new Map<string, EdgeMetrics[]>();
  
  // Performance thresholds per region
  private performanceThresholds = {
    latency: { warning: 150, critical: 300 }, // ms
    availability: { warning: 0.99, critical: 0.95 }, // percentage
    throughput: { warning: 100, critical: 50 }, // requests/sec
    errorRate: { warning: 0.02, critical: 0.05 } // percentage
  };
  
  // Geographic performance tracking
  private geographicMetrics = new Map<string, GeographicDistribution>();
  
  // Real-time monitoring
  private monitoringInterval?: NodeJS.Timeout;

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.logger.info('Initializing edge monitor');
    
    await this.setupEdgeLocations();
    await this.initializeGeographicTracking();
    
    this.startEdgeMonitoring();
    
    this.isInitialized = true;
    this.logger.info('Edge monitor initialized successfully');
  }

  public async collect(): Promise<EdgeMetrics> {
    const timestamp = Date.now();
    
    // Collect metrics from all edge locations
    const locationMetrics = await this.collectLocationMetrics();
    
    // Aggregate metrics across all locations
    const aggregatedMetrics: EdgeMetrics = {
      latency: {},
      availability: {},
      throughput: {},
      errorRate: {},
      transferCost: 0,
      totalConnections: {},
      bandwidth: {},
      timestamp
    };

    // Aggregate data from all locations
    for (const [locationId, metrics] of locationMetrics.entries()) {
      aggregatedMetrics.latency[locationId] = metrics.latency;
      aggregatedMetrics.availability[locationId] = metrics.availability;
      aggregatedMetrics.throughput[locationId] = metrics.throughput;
      aggregatedMetrics.errorRate[locationId] = metrics.errorRate;
      aggregatedMetrics.totalConnections[locationId] = metrics.connections;
      aggregatedMetrics.bandwidth[locationId] = metrics.bandwidth;
      aggregatedMetrics.transferCost += metrics.cost;
    }

    // Check for performance alerts
    await this.checkEdgePerformance(locationMetrics);
    
    // Update geographic distribution
    await this.updateGeographicDistribution(locationMetrics);

    return aggregatedMetrics;
  }

  private async setupEdgeLocations(): Promise<void> {
    // Define major edge locations globally
    const locations: EdgeLocation[] = [
      {
        id: 'us-east-1',
        region: 'North America',
        country: 'United States',
        city: 'Virginia',
        coordinates: { lat: 38.9517, lng: -77.4481 },
        status: 'active'
      },
      {
        id: 'us-west-1',
        region: 'North America',
        country: 'United States',
        city: 'California',
        coordinates: { lat: 37.4419, lng: -122.1430 },
        status: 'active'
      },
      {
        id: 'eu-west-1',
        region: 'Europe',
        country: 'Ireland',
        city: 'Dublin',
        coordinates: { lat: 53.3498, lng: -6.2603 },
        status: 'active'
      },
      {
        id: 'eu-central-1',
        region: 'Europe',
        country: 'Germany',
        city: 'Frankfurt',
        coordinates: { lat: 50.1109, lng: 8.6821 },
        status: 'active'
      },
      {
        id: 'ap-southeast-1',
        region: 'Asia Pacific',
        country: 'Singapore',
        city: 'Singapore',
        coordinates: { lat: 1.3521, lng: 103.8198 },
        status: 'active'
      },
      {
        id: 'ap-northeast-1',
        region: 'Asia Pacific',
        country: 'Japan',
        city: 'Tokyo',
        coordinates: { lat: 35.6762, lng: 139.6503 },
        status: 'active'
      },
      {
        id: 'ap-south-1',
        region: 'Asia Pacific',
        country: 'India',
        city: 'Mumbai',
        coordinates: { lat: 19.0760, lng: 72.8777 },
        status: 'active'
      },
      {
        id: 'sa-east-1',
        region: 'South America',
        country: 'Brazil',
        city: 'São Paulo',
        coordinates: { lat: -23.5505, lng: -46.6333 },
        status: 'active'
      }
    ];

    for (const location of locations) {
      this.edgeLocations.set(location.id, location);
      this.edgeMetricsHistory.set(location.id, []);
    }

    this.logger.debug('Edge locations configured', { count: this.edgeLocations.size });
  }

  private async collectLocationMetrics(): Promise<Map<string, any>> {
    const locationMetrics = new Map<string, any>();
    
    for (const [locationId, location] of this.edgeLocations.entries()) {
      if (location.status !== 'active') continue;
      
      const metrics = await this.collectSingleLocationMetrics(locationId);
      locationMetrics.set(locationId, metrics);
      
      // Store in history
      const history = this.edgeMetricsHistory.get(locationId) || [];
      history.push({
        locationId,
        ...metrics,
        timestamp: Date.now()
      });
      
      // Cleanup old history
      if (history.length > 1000) {
        history.splice(0, history.length - 1000);
      }
      
      this.edgeMetricsHistory.set(locationId, history);
    }
    
    return locationMetrics;
  }

  private async collectSingleLocationMetrics(locationId: string): Promise<any> {
    // Simulate metrics collection for each edge location
    // In a real implementation, this would query actual edge infrastructure
    
    const location = this.edgeLocations.get(locationId);
    if (!location) return {};
    
    // Base metrics with regional variations
    const baseLatency = this.getBaseLatencyForRegion(location.region);
    const loadFactor = this.getLoadFactorForRegion(location.region);
    
    return {
      latency: this.generateRealisticLatency(baseLatency, loadFactor),
      availability: this.generateRealisticAvailability(),
      throughput: this.generateRealisticThroughput(loadFactor),
      errorRate: this.generateRealisticErrorRate(),
      connections: this.generateConnectionCount(loadFactor),
      bandwidth: this.generateBandwidthUsage(loadFactor),
      cost: this.calculateTransferCost(locationId, loadFactor)
    };
  }

  private getBaseLatencyForRegion(region: string): number {
    // Base latency varies by region due to infrastructure and distance
    const baseLatencies = {
      'North America': 25,
      'Europe': 35,
      'Asia Pacific': 45,
      'South America': 55
    };
    
    return baseLatencies[region as keyof typeof baseLatencies] || 40;
  }

  private getLoadFactorForRegion(region: string): number {
    // Simulate different load patterns based on time zones and business hours
    const hour = new Date().getUTCHours();
    
    // Adjust for different peak times by region
    const peakHours = {
      'North America': [14, 22], // 9 AM - 5 PM EST
      'Europe': [8, 16], // 9 AM - 5 PM CET
      'Asia Pacific': [1, 9], // 9 AM - 5 PM JST
      'South America': [12, 20] // 9 AM - 5 PM BRT
    };
    
    const peaks = peakHours[region as keyof typeof peakHours] || [8, 16];
    const isPeakTime = hour >= peaks[0] && hour <= peaks[1];
    
    const baseFactor = isPeakTime ? 1.5 : 0.4;
    const variance = Math.random() * 0.4 + 0.8; // 80-120% variance
    
    return baseFactor * variance;
  }

  private generateRealisticLatency(baseLatency: number, loadFactor: number): number {
    const loadMultiplier = 1 + (loadFactor - 1) * 0.3; // Load affects latency
    const variance = Math.random() * 0.4 + 0.8; // 80-120% variance
    const spike = Math.random() < 0.02 ? Math.random() * 200 : 0; // 2% chance of latency spike
    
    return Math.max(10, baseLatency * loadMultiplier * variance + spike);
  }

  private generateRealisticAvailability(): number {
    const baseAvailability = 0.999;
    const degradation = Math.random() < 0.001 ? Math.random() * 0.05 : 0; // 0.1% chance of degradation
    
    return Math.max(0.9, baseAvailability - degradation);
  }

  private generateRealisticThroughput(loadFactor: number): number {
    const baseThroughput = 200; // requests per second
    const scalingFactor = loadFactor * (Math.random() * 0.3 + 0.85); // 85-115% variance
    
    return Math.max(10, baseThroughput * scalingFactor);
  }

  private generateRealisticErrorRate(): number {
    const baseErrorRate = 0.005; // 0.5%
    const spike = Math.random() < 0.01 ? Math.random() * 0.02 : 0; // 1% chance of error spike
    
    return Math.min(0.1, baseErrorRate + spike);
  }

  private generateConnectionCount(loadFactor: number): number {
    const baseConnections = 1000;
    return Math.floor(baseConnections * loadFactor * (Math.random() * 0.4 + 0.8));
  }

  private generateBandwidthUsage(loadFactor: number): number {
    const baseBandwidth = 500; // Mbps
    return baseBandwidth * loadFactor * (Math.random() * 0.3 + 0.85);
  }

  private calculateTransferCost(locationId: string, loadFactor: number): number {
    // Cost varies by region and data transfer amount
    const baseCosts = {
      'us-east-1': 0.02, // per GB
      'us-west-1': 0.02,
      'eu-west-1': 0.03,
      'eu-central-1': 0.03,
      'ap-southeast-1': 0.04,
      'ap-northeast-1': 0.04,
      'ap-south-1': 0.035,
      'sa-east-1': 0.05
    };
    
    const costPerGB = baseCosts[locationId as keyof typeof baseCosts] || 0.03;
    const dataTransferGB = loadFactor * 100 * (Math.random() * 0.5 + 0.75); // 75-125% variance
    
    return costPerGB * dataTransferGB;
  }

  private async checkEdgePerformance(locationMetrics: Map<string, any>): Promise<void> {
    const alerts: EdgePerformanceAlert[] = [];
    
    for (const [locationId, metrics] of locationMetrics.entries()) {
      // Check latency
      if (metrics.latency > this.performanceThresholds.latency.critical) {
        alerts.push({
          locationId,
          metric: 'latency',
          value: metrics.latency,
          threshold: this.performanceThresholds.latency.critical,
          severity: 'critical',
          description: `Critical latency at ${locationId}: ${metrics.latency.toFixed(1)}ms`,
          timestamp: Date.now()
        });
      } else if (metrics.latency > this.performanceThresholds.latency.warning) {
        alerts.push({
          locationId,
          metric: 'latency',
          value: metrics.latency,
          threshold: this.performanceThresholds.latency.warning,
          severity: 'high',
          description: `High latency at ${locationId}: ${metrics.latency.toFixed(1)}ms`,
          timestamp: Date.now()
        });
      }
      
      // Check availability
      if (metrics.availability < this.performanceThresholds.availability.critical) {
        alerts.push({
          locationId,
          metric: 'availability',
          value: metrics.availability,
          threshold: this.performanceThresholds.availability.critical,
          severity: 'critical',
          description: `Critical availability at ${locationId}: ${(metrics.availability * 100).toFixed(2)}%`,
          timestamp: Date.now()
        });
      } else if (metrics.availability < this.performanceThresholds.availability.warning) {
        alerts.push({
          locationId,
          metric: 'availability',
          value: metrics.availability,
          threshold: this.performanceThresholds.availability.warning,
          severity: 'high',
          description: `Low availability at ${locationId}: ${(metrics.availability * 100).toFixed(2)}%`,
          timestamp: Date.now()
        });
      }
      
      // Check throughput
      if (metrics.throughput < this.performanceThresholds.throughput.critical) {
        alerts.push({
          locationId,
          metric: 'throughput',
          value: metrics.throughput,
          threshold: this.performanceThresholds.throughput.critical,
          severity: 'critical',
          description: `Critical low throughput at ${locationId}: ${metrics.throughput.toFixed(1)} req/s`,
          timestamp: Date.now()
        });
      } else if (metrics.throughput < this.performanceThresholds.throughput.warning) {
        alerts.push({
          locationId,
          metric: 'throughput',
          value: metrics.throughput,
          threshold: this.performanceThresholds.throughput.warning,
          severity: 'medium',
          description: `Low throughput at ${locationId}: ${metrics.throughput.toFixed(1)} req/s`,
          timestamp: Date.now()
        });
      }
      
      // Check error rate
      if (metrics.errorRate > this.performanceThresholds.errorRate.critical) {
        alerts.push({
          locationId,
          metric: 'errors',
          value: metrics.errorRate,
          threshold: this.performanceThresholds.errorRate.critical,
          severity: 'critical',
          description: `Critical error rate at ${locationId}: ${(metrics.errorRate * 100).toFixed(2)}%`,
          timestamp: Date.now()
        });
      } else if (metrics.errorRate > this.performanceThresholds.errorRate.warning) {
        alerts.push({
          locationId,
          metric: 'errors',
          value: metrics.errorRate,
          threshold: this.performanceThresholds.errorRate.warning,
          severity: 'high',
          description: `High error rate at ${locationId}: ${(metrics.errorRate * 100).toFixed(2)}%`,
          timestamp: Date.now()
        });
      }
    }
    
    // Emit alerts
    for (const alert of alerts) {
      this.emit('edge_alert', alert);
    }
  }

  private async initializeGeographicTracking(): Promise<void> {
    // Initialize geographic distribution tracking
    for (const [locationId, location] of this.edgeLocations.entries()) {
      this.geographicMetrics.set(location.region, {
        region: location.region,
        requestCount: 0,
        averageLatency: 0,
        errorRate: 0,
        revenue: 0,
        userSatisfaction: 0.85 // Default satisfaction score
      });
    }
  }

  private async updateGeographicDistribution(locationMetrics: Map<string, any>): Promise<void> {
    // Update geographic distribution metrics
    const regionMetrics = new Map<string, any>();
    
    for (const [locationId, metrics] of locationMetrics.entries()) {
      const location = this.edgeLocations.get(locationId);
      if (!location) continue;
      
      const region = location.region;
      if (!regionMetrics.has(region)) {
        regionMetrics.set(region, {
          requestCount: 0,
          totalLatency: 0,
          totalErrors: 0,
          totalRequests: 0,
          locationCount: 0
        });
      }
      
      const regionData = regionMetrics.get(region);
      regionData.requestCount += metrics.throughput * 60; // Convert to requests per minute
      regionData.totalLatency += metrics.latency;
      regionData.totalErrors += metrics.errorRate * metrics.throughput * 60;
      regionData.totalRequests += metrics.throughput * 60;
      regionData.locationCount += 1;
    }
    
    // Calculate averages and update geographic metrics
    for (const [region, data] of regionMetrics.entries()) {
      const avgLatency = data.totalLatency / data.locationCount;
      const errorRate = data.totalRequests > 0 ? data.totalErrors / data.totalRequests : 0;
      
      // Estimate revenue based on request volume and performance
      const baseRevenuePerRequest = 0.01; // $0.01 per request
      const performanceMultiplier = Math.max(0.5, 1 - (avgLatency / 1000) - errorRate);
      const revenue = data.requestCount * baseRevenuePerRequest * performanceMultiplier;
      
      // Calculate user satisfaction based on performance
      const latencyScore = Math.max(0, 1 - (avgLatency / 500)); // Normalize to 500ms
      const availabilityScore = 1 - errorRate;
      const userSatisfaction = (latencyScore * 0.6 + availabilityScore * 0.4);
      
      this.geographicMetrics.set(region, {
        region,
        requestCount: data.requestCount,
        averageLatency: avgLatency,
        errorRate,
        revenue,
        userSatisfaction
      });
    }
  }

  private startEdgeMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.analyzeEdgeOptimization();
      } catch (error) {
        this.logger.error('Error in edge monitoring', { error });
      }
    }, 60000); // Check every minute
  }

  private async analyzeEdgeOptimization(): Promise<void> {
    // Analyze opportunities for edge optimization
    const optimizations: any[] = [];
    
    for (const [region, metrics] of this.geographicMetrics.entries()) {
      // High latency optimization
      if (metrics.averageLatency > 200) {
        optimizations.push({
          type: 'latency_optimization',
          region,
          description: `High latency in ${region} - consider adding more edge locations`,
          currentLatency: metrics.averageLatency,
          potentialImprovement: '40-60% latency reduction',
          estimatedCost: '$5000-10000/month'
        });
      }
      
      // High error rate optimization
      if (metrics.errorRate > 0.02) {
        optimizations.push({
          type: 'reliability_optimization',
          region,
          description: `High error rate in ${region} - investigate infrastructure issues`,
          currentErrorRate: metrics.errorRate,
          potentialImprovement: 'Reduce errors by 70-80%',
          estimatedCost: '$2000-5000 investigation'
        });
      }
      
      // Low user satisfaction optimization
      if (metrics.userSatisfaction < 0.7) {
        optimizations.push({
          type: 'user_experience_optimization',
          region,
          description: `Low user satisfaction in ${region} - performance improvements needed`,
          currentSatisfaction: metrics.userSatisfaction,
          potentialImprovement: 'Increase satisfaction to 85%+',
          estimatedCost: '$3000-8000/month'
        });
      }
    }
    
    // Emit optimizations
    for (const optimization of optimizations) {
      this.emit('edge_optimization', optimization);
    }
  }

  public getEdgeSummary(): any {
    const activeLocations = Array.from(this.edgeLocations.values()).filter(l => l.status === 'active');
    const regionSummary = Array.from(this.geographicMetrics.values());
    
    return {
      totalLocations: activeLocations.length,
      regions: regionSummary.length,
      globalMetrics: {
        averageLatency: regionSummary.reduce((sum, r) => sum + r.averageLatency, 0) / regionSummary.length,
        totalRequests: regionSummary.reduce((sum, r) => sum + r.requestCount, 0),
        totalRevenue: regionSummary.reduce((sum, r) => sum + r.revenue, 0),
        averageUserSatisfaction: regionSummary.reduce((sum, r) => sum + r.userSatisfaction, 0) / regionSummary.length
      },
      regionBreakdown: regionSummary,
      healthyLocations: activeLocations.filter(l => this.isLocationHealthy(l.id)).length
    };
  }

  private isLocationHealthy(locationId: string): boolean {
    const history = this.edgeMetricsHistory.get(locationId);
    if (!history || history.length === 0) return false;
    
    const latest = history[history.length - 1];
    return (
      latest.latency < this.performanceThresholds.latency.warning &&
      latest.availability > this.performanceThresholds.availability.warning &&
      latest.throughput > this.performanceThresholds.throughput.warning &&
      latest.errorRate < this.performanceThresholds.errorRate.warning
    );
  }

  public getLocationDetails(locationId: string): any {
    const location = this.edgeLocations.get(locationId);
    const history = this.edgeMetricsHistory.get(locationId);
    
    if (!location) return null;
    
    return {
      location,
      isHealthy: this.isLocationHealthy(locationId),
      recentMetrics: history ? history.slice(-10) : [],
      performanceScore: this.calculateLocationPerformanceScore(locationId)
    };
  }

  private calculateLocationPerformanceScore(locationId: string): number {
    const history = this.edgeMetricsHistory.get(locationId);
    if (!history || history.length === 0) return 0;
    
    const latest = history[history.length - 1];
    
    // Calculate score based on multiple factors (0-100)
    const latencyScore = Math.max(0, 100 - (latest.latency / 5)); // 5ms = 1 point
    const availabilityScore = latest.availability * 100;
    const throughputScore = Math.min(100, (latest.throughput / 2)); // 2 req/s = 1 point
    const errorScore = Math.max(0, 100 - (latest.errorRate * 2000)); // 0.05% = 1 point
    
    return (latencyScore * 0.3 + availabilityScore * 0.3 + throughputScore * 0.2 + errorScore * 0.2);
  }

  public async shutdown(): Promise<void> {
    if (!this.isInitialized) return;
    
    this.logger.info('Shutting down edge monitor');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.isInitialized = false;
    this.logger.info('Edge monitor shut down');
  }
}