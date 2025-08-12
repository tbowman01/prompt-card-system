/**
 * Collaboration Analytics Service
 * Tracks productivity metrics, collaboration patterns, and generates insights
 */

import { EventEmitter } from 'events';
import { DatabaseConnection } from '../../database/connection';
import Redis from 'ioredis';

export interface CollaborationMetric {
  id: string;
  workspaceId?: string;
  documentId?: string;
  userId?: string;
  metricType: MetricType;
  value: number;
  dimensions: Record<string, any>;
  timestamp: Date;
  aggregationPeriod?: 'hour' | 'day' | 'week' | 'month';
}

export type MetricType = 
  | 'edit_count'
  | 'comment_count'
  | 'review_count'
  | 'collaboration_time'
  | 'document_views'
  | 'conflict_resolution'
  | 'response_time'
  | 'review_turnaround'
  | 'productivity_score'
  | 'quality_score'
  | 'engagement_score';

export interface ProductivityMetrics {
  totalEdits: number;
  totalComments: number;
  totalReviews: number;
  averageResponseTime: number;
  collaborationTime: number;
  documentsCreated: number;
  documentsCompleted: number;
  reviewsApproved: number;
  reviewsRejected: number;
  conflictsResolved: number;
  productivityTrend: number; // percentage change
}

export interface CollaborationPattern {
  patternType: PatternType;
  description: string;
  frequency: number;
  participants: string[];
  timeframe: {
    start: Date;
    end: Date;
  };
  confidence: number; // 0-1
  insights: string[];
  recommendations: string[];
}

export type PatternType = 
  | 'peak_collaboration_hours'
  | 'bottleneck_reviewers'
  | 'frequent_collaborators'
  | 'conflict_hotspots'
  | 'productivity_cycles'
  | 'knowledge_sharing'
  | 'review_patterns'
  | 'communication_patterns';

export interface TeamInsight {
  type: InsightType;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  category: 'productivity' | 'collaboration' | 'quality' | 'performance';
  metrics: Record<string, number>;
  trends: Record<string, number[]>;
  recommendations: Recommendation[];
  affectedUsers: string[];
  timeframe: {
    start: Date;
    end: Date;
  };
}

export type InsightType = 
  | 'low_productivity'
  | 'high_conflict_rate'
  | 'slow_reviews'
  | 'poor_collaboration'
  | 'knowledge_silos'
  | 'burnout_risk'
  | 'improvement_opportunity'
  | 'best_practice';

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  category: 'workflow' | 'training' | 'tools' | 'process';
  estimatedImpact: number; // 0-100
  implementation: {
    difficulty: 'easy' | 'medium' | 'hard';
    timeToImplement: string;
    resources: string[];
  };
  metrics: string[];
}

export interface ContributionReport {
  userId: string;
  username: string;
  metrics: {
    editsCount: number;
    commentsCount: number;
    reviewsCount: number;
    documentsCreated: number;
    collaborationTime: number;
    qualityScore: number;
    responsiveness: number;
  };
  trends: {
    productivity: number[];
    collaboration: number[];
    quality: number[];
  };
  strengths: string[];
  improvementAreas: string[];
  rank: number;
  percentile: number;
}

export interface WorkspaceHealthScore {
  overall: number;
  breakdown: {
    productivity: number;
    collaboration: number;
    quality: number;
    responsiveness: number;
    innovation: number;
  };
  trends: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
  benchmarks: {
    industry: number;
    similar: number;
  };
}

export class CollaborationAnalytics extends EventEmitter {
  private db: DatabaseConnection;
  private redis: Redis;
  private metricsCache: Map<string, CollaborationMetric[]> = new Map();
  private patternCache: Map<string, CollaborationPattern[]> = new Map();
  private insightCache: Map<string, TeamInsight[]> = new Map();
  private aggregationIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(redisConfig?: any) {
    super();
    this.db = new DatabaseConnection();
    this.redis = new Redis(redisConfig || process.env.REDIS_URL);
    this.startMetricsAggregation();
    this.startPatternDetection();
    this.startInsightGeneration();
  }

  /**
   * Record a collaboration metric
   */
  public async recordMetric(metricData: {
    workspaceId?: string;
    documentId?: string;
    userId?: string;
    metricType: MetricType;
    value: number;
    dimensions?: Record<string, any>;
  }): Promise<void> {
    try {
      const metricId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const metric: CollaborationMetric = {
        id: metricId,
        workspaceId: metricData.workspaceId,
        documentId: metricData.documentId,
        userId: metricData.userId,
        metricType: metricData.metricType,
        value: metricData.value,
        dimensions: metricData.dimensions || {},
        timestamp: new Date()
      };

      // Store in database
      await this.db.query(`
        INSERT INTO collaboration.collaboration_metrics (
          id, workspace_id, document_id, user_id, metric_type, metric_value, dimensions, recorded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        metric.id,
        metric.workspaceId,
        metric.documentId,
        metric.userId,
        metric.metricType,
        metric.value,
        JSON.stringify(metric.dimensions),
        metric.timestamp
      ]);

      // Cache for real-time processing
      const cacheKey = this.getCacheKey(metric.workspaceId, metric.documentId, metric.userId);
      const cached = this.metricsCache.get(cacheKey) || [];
      cached.push(metric);
      
      // Keep only recent metrics in cache (last 1000)
      if (cached.length > 1000) {
        cached.splice(0, cached.length - 1000);
      }
      
      this.metricsCache.set(cacheKey, cached);

      // Publish to Redis for real-time updates
      await this.redis.publish('analytics:metric', JSON.stringify(metric));

      this.emit('metric-recorded', metric);
    } catch (error) {
      console.error('Error recording metric:', error);
    }
  }

  /**
   * Get productivity metrics for user/workspace
   */
  public async getProductivityMetrics(
    workspaceId?: string,
    userId?: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<ProductivityMetrics> {
    try {
      let query = `
        SELECT 
          metric_type,
          SUM(metric_value) as total_value,
          AVG(metric_value) as avg_value,
          COUNT(*) as count
        FROM collaboration.collaboration_metrics
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramIndex = 1;

      if (workspaceId) {
        query += ` AND workspace_id = $${paramIndex++}`;
        params.push(workspaceId);
      }

      if (userId) {
        query += ` AND user_id = $${paramIndex++}`;
        params.push(userId);
      }

      if (timeframe) {
        query += ` AND recorded_at >= $${paramIndex++} AND recorded_at <= $${paramIndex++}`;
        params.push(timeframe.start, timeframe.end);
      }

      query += ` GROUP BY metric_type`;

      const result = await this.db.query(query, params);
      const metricMap = new Map();
      
      result.rows.forEach(row => {
        metricMap.set(row.metric_type, {
          total: parseFloat(row.total_value),
          average: parseFloat(row.avg_value),
          count: parseInt(row.count)
        });
      });

      // Calculate productivity trend
      const trend = await this.calculateProductivityTrend(workspaceId, userId, timeframe);

      return {
        totalEdits: metricMap.get('edit_count')?.total || 0,
        totalComments: metricMap.get('comment_count')?.total || 0,
        totalReviews: metricMap.get('review_count')?.total || 0,
        averageResponseTime: metricMap.get('response_time')?.average || 0,
        collaborationTime: metricMap.get('collaboration_time')?.total || 0,
        documentsCreated: metricMap.get('document_views')?.count || 0,
        documentsCompleted: 0, // Would need additional tracking
        reviewsApproved: 0, // Would need additional tracking
        reviewsRejected: 0, // Would need additional tracking
        conflictsResolved: metricMap.get('conflict_resolution')?.total || 0,
        productivityTrend: trend
      };
    } catch (error) {
      console.error('Error getting productivity metrics:', error);
      return this.getEmptyProductivityMetrics();
    }
  }

  /**
   * Detect collaboration patterns
   */
  public async detectCollaborationPatterns(
    workspaceId: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<CollaborationPattern[]> {
    try {
      // Check cache first
      const cacheKey = `patterns_${workspaceId}_${timeframe?.start?.getTime()}_${timeframe?.end?.getTime()}`;
      const cached = this.patternCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const patterns: CollaborationPattern[] = [];

      // Detect peak collaboration hours
      const peakHours = await this.detectPeakCollaborationHours(workspaceId, timeframe);
      if (peakHours) patterns.push(peakHours);

      // Detect bottleneck reviewers
      const bottlenecks = await this.detectBottleneckReviewers(workspaceId, timeframe);
      if (bottlenecks) patterns.push(bottlenecks);

      // Detect frequent collaborators
      const frequentCollabs = await this.detectFrequentCollaborators(workspaceId, timeframe);
      if (frequentCollabs) patterns.push(frequentCollabs);

      // Detect conflict hotspots
      const conflictHotspots = await this.detectConflictHotspots(workspaceId, timeframe);
      if (conflictHotspots) patterns.push(conflictHotspots);

      // Cache results
      this.patternCache.set(cacheKey, patterns);
      
      // Set cache expiration
      setTimeout(() => {
        this.patternCache.delete(cacheKey);
      }, 300000); // 5 minutes

      return patterns;
    } catch (error) {
      console.error('Error detecting collaboration patterns:', error);
      return [];
    }
  }

  /**
   * Generate team insights
   */
  public async generateTeamInsights(
    workspaceId: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<TeamInsight[]> {
    try {
      const insights: TeamInsight[] = [];

      // Analyze productivity trends
      const productivityInsight = await this.analyzeProductivityTrends(workspaceId, timeframe);
      if (productivityInsight) insights.push(productivityInsight);

      // Analyze collaboration quality
      const qualityInsight = await this.analyzeCollaborationQuality(workspaceId, timeframe);
      if (qualityInsight) insights.push(qualityInsight);

      // Analyze review performance
      const reviewInsight = await this.analyzeReviewPerformance(workspaceId, timeframe);
      if (reviewInsight) insights.push(reviewInsight);

      // Detect burnout risk
      const burnoutInsight = await this.detectBurnoutRisk(workspaceId, timeframe);
      if (burnoutInsight) insights.push(burnoutInsight);

      return insights;
    } catch (error) {
      console.error('Error generating team insights:', error);
      return [];
    }
  }

  /**
   * Generate contribution report for user
   */
  public async generateContributionReport(
    userId: string,
    workspaceId?: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<ContributionReport | null> {
    try {
      // Get user info
      const userResult = await this.db.query(`
        SELECT username, first_name, last_name FROM collaboration.users WHERE id = $1
      `, [userId]);

      if (userResult.rows.length === 0) {
        return null;
      }

      const user = userResult.rows[0];
      const metrics = await this.getProductivityMetrics(workspaceId, userId, timeframe);
      
      // Calculate trends
      const trends = await this.calculateUserTrends(userId, workspaceId, timeframe);
      
      // Analyze strengths and improvement areas
      const analysis = await this.analyzeUserPerformance(userId, workspaceId, timeframe);
      
      // Calculate rank among team members
      const rank = await this.calculateUserRank(userId, workspaceId, timeframe);

      return {
        userId,
        username: user.username,
        metrics: {
          editsCount: metrics.totalEdits,
          commentsCount: metrics.totalComments,
          reviewsCount: metrics.totalReviews,
          documentsCreated: metrics.documentsCreated,
          collaborationTime: metrics.collaborationTime,
          qualityScore: analysis.qualityScore,
          responsiveness: analysis.responsiveness
        },
        trends,
        strengths: analysis.strengths,
        improvementAreas: analysis.improvementAreas,
        rank: rank.position,
        percentile: rank.percentile
      };
    } catch (error) {
      console.error('Error generating contribution report:', error);
      return null;
    }
  }

  /**
   * Calculate workspace health score
   */
  public async calculateWorkspaceHealthScore(
    workspaceId: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<WorkspaceHealthScore> {
    try {
      const metrics = await this.getProductivityMetrics(workspaceId, undefined, timeframe);
      const patterns = await this.detectCollaborationPatterns(workspaceId, timeframe);
      
      // Calculate individual scores
      const productivity = this.calculateProductivityScore(metrics);
      const collaboration = this.calculateCollaborationScore(patterns);
      const quality = this.calculateQualityScore(metrics);
      const responsiveness = this.calculateResponsivenessScore(metrics);
      const innovation = this.calculateInnovationScore(metrics);
      
      // Calculate overall score
      const overall = (productivity + collaboration + quality + responsiveness + innovation) / 5;
      
      // Get trends
      const trends = await this.calculateHealthTrends(workspaceId, timeframe);
      
      // Get benchmarks (mock data for now)
      const benchmarks = {
        industry: 75,
        similar: 68
      };

      return {
        overall: Math.round(overall),
        breakdown: {
          productivity: Math.round(productivity),
          collaboration: Math.round(collaboration),
          quality: Math.round(quality),
          responsiveness: Math.round(responsiveness),
          innovation: Math.round(innovation)
        },
        trends,
        benchmarks
      };
    } catch (error) {
      console.error('Error calculating workspace health score:', error);
      return this.getDefaultHealthScore();
    }
  }

  // Private helper methods

  private startMetricsAggregation(): void {
    // Aggregate hourly metrics
    const hourlyInterval = setInterval(async () => {
      await this.aggregateMetrics('hour');
    }, 3600000); // Every hour

    // Aggregate daily metrics
    const dailyInterval = setInterval(async () => {
      await this.aggregateMetrics('day');
    }, 86400000); // Every day

    this.aggregationIntervals.set('hourly', hourlyInterval);
    this.aggregationIntervals.set('daily', dailyInterval);
  }

  private startPatternDetection(): void {
    // Run pattern detection every 30 minutes
    const interval = setInterval(async () => {
      await this.runPatternDetection();
    }, 1800000);

    this.aggregationIntervals.set('patterns', interval);
  }

  private startInsightGeneration(): void {
    // Generate insights every hour
    const interval = setInterval(async () => {
      await this.runInsightGeneration();
    }, 3600000);

    this.aggregationIntervals.set('insights', interval);
  }

  private async aggregateMetrics(period: 'hour' | 'day'): Promise<void> {
    try {
      const interval = period === 'hour' ? '1 hour' : '1 day';
      
      const result = await this.db.query(`
        INSERT INTO collaboration.collaboration_metrics (
          id, workspace_id, document_id, user_id, metric_type, metric_value, 
          dimensions, recorded_at, aggregation_period
        )
        SELECT 
          gen_random_uuid(),
          workspace_id,
          document_id,
          user_id,
          metric_type,
          SUM(metric_value) as metric_value,
          jsonb_build_object('aggregated', true, 'period', $1) as dimensions,
          date_trunc($1, recorded_at) as recorded_at,
          $1 as aggregation_period
        FROM collaboration.collaboration_metrics
        WHERE recorded_at >= NOW() - INTERVAL '${interval}'
          AND aggregation_period IS NULL
        GROUP BY workspace_id, document_id, user_id, metric_type, date_trunc($1, recorded_at)
        ON CONFLICT DO NOTHING
      `, [period]);

      console.log(`Aggregated ${result.rowCount} ${period}ly metrics`);
    } catch (error) {
      console.error(`Error aggregating ${period}ly metrics:`, error);
    }
  }

  private async runPatternDetection(): Promise<void> {
    try {
      // Get active workspaces
      const workspaces = await this.db.query(`
        SELECT DISTINCT workspace_id FROM collaboration.collaboration_metrics
        WHERE recorded_at >= NOW() - INTERVAL '24 hours'
      `);

      for (const workspace of workspaces.rows) {
        await this.detectCollaborationPatterns(workspace.workspace_id);
      }
    } catch (error) {
      console.error('Error running pattern detection:', error);
    }
  }

  private async runInsightGeneration(): Promise<void> {
    try {
      // Get active workspaces
      const workspaces = await this.db.query(`
        SELECT DISTINCT workspace_id FROM collaboration.collaboration_metrics
        WHERE recorded_at >= NOW() - INTERVAL '24 hours'
      `);

      for (const workspace of workspaces.rows) {
        const insights = await this.generateTeamInsights(workspace.workspace_id);
        
        // Cache insights
        this.insightCache.set(workspace.workspace_id, insights);
        
        // Emit insights for real-time updates
        this.emit('insights-generated', {
          workspaceId: workspace.workspace_id,
          insights
        });
      }
    } catch (error) {
      console.error('Error running insight generation:', error);
    }
  }

  // Pattern detection methods

  private async detectPeakCollaborationHours(
    workspaceId: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<CollaborationPattern | null> {
    try {
      let query = `
        SELECT 
          EXTRACT(hour FROM recorded_at) as hour,
          COUNT(*) as activity_count
        FROM collaboration.collaboration_metrics
        WHERE workspace_id = $1
      `;
      
      const params: any[] = [workspaceId];
      let paramIndex = 2;

      if (timeframe) {
        query += ` AND recorded_at >= $${paramIndex++} AND recorded_at <= $${paramIndex++}`;
        params.push(timeframe.start, timeframe.end);
      }

      query += ` GROUP BY EXTRACT(hour FROM recorded_at) ORDER BY activity_count DESC LIMIT 3`;

      const result = await this.db.query(query, params);
      
      if (result.rows.length === 0) {
        return null;
      }

      const peakHours = result.rows.map(row => parseInt(row.hour));
      const totalActivity = result.rows.reduce((sum, row) => sum + parseInt(row.activity_count), 0);

      return {
        patternType: 'peak_collaboration_hours',
        description: `Peak collaboration occurs during hours: ${peakHours.join(', ')}`,
        frequency: totalActivity,
        participants: [], // Would need additional query to get participants
        timeframe: timeframe || { start: new Date(Date.now() - 7*24*60*60*1000), end: new Date() },
        confidence: 0.8,
        insights: [
          `Most active hours are ${peakHours.join(', ')}`,
          `${totalActivity} total activities during peak hours`
        ],
        recommendations: [
          'Schedule important meetings during peak hours',
          'Consider time zone differences for global teams'
        ]
      };
    } catch (error) {
      console.error('Error detecting peak collaboration hours:', error);
      return null;
    }
  }

  private async detectBottleneckReviewers(
    workspaceId: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<CollaborationPattern | null> {
    // Implementation would analyze review response times by user
    return null;
  }

  private async detectFrequentCollaborators(
    workspaceId: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<CollaborationPattern | null> {
    // Implementation would analyze user collaboration frequencies
    return null;
  }

  private async detectConflictHotspots(
    workspaceId: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<CollaborationPattern | null> {
    // Implementation would analyze conflict resolution patterns
    return null;
  }

  // Insight generation methods

  private async analyzeProductivityTrends(
    workspaceId: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<TeamInsight | null> {
    // Implementation would analyze productivity trends
    return null;
  }

  private async analyzeCollaborationQuality(
    workspaceId: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<TeamInsight | null> {
    // Implementation would analyze collaboration quality
    return null;
  }

  private async analyzeReviewPerformance(
    workspaceId: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<TeamInsight | null> {
    // Implementation would analyze review performance
    return null;
  }

  private async detectBurnoutRisk(
    workspaceId: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<TeamInsight | null> {
    // Implementation would detect burnout risk indicators
    return null;
  }

  // Utility methods

  private getCacheKey(workspaceId?: string, documentId?: string, userId?: string): string {
    return [workspaceId || 'global', documentId || 'all', userId || 'all'].join(':');
  }

  private async calculateProductivityTrend(
    workspaceId?: string,
    userId?: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<number> {
    // Implementation would calculate productivity trend percentage
    return 0;
  }

  private async calculateUserTrends(
    userId: string,
    workspaceId?: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<{ productivity: number[]; collaboration: number[]; quality: number[] }> {
    return {
      productivity: [],
      collaboration: [],
      quality: []
    };
  }

  private async analyzeUserPerformance(
    userId: string,
    workspaceId?: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<{
    qualityScore: number;
    responsiveness: number;
    strengths: string[];
    improvementAreas: string[];
  }> {
    return {
      qualityScore: 75,
      responsiveness: 80,
      strengths: [],
      improvementAreas: []
    };
  }

  private async calculateUserRank(
    userId: string,
    workspaceId?: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<{ position: number; percentile: number }> {
    return { position: 1, percentile: 90 };
  }

  private calculateProductivityScore(metrics: ProductivityMetrics): number {
    // Weighted calculation of productivity score
    const editScore = Math.min(metrics.totalEdits / 100, 1) * 25;
    const commentScore = Math.min(metrics.totalComments / 50, 1) * 20;
    const reviewScore = Math.min(metrics.totalReviews / 20, 1) * 25;
    const responseScore = Math.max(0, (1 - metrics.averageResponseTime / 86400)) * 30; // Response time in seconds
    
    return editScore + commentScore + reviewScore + responseScore;
  }

  private calculateCollaborationScore(patterns: CollaborationPattern[]): number {
    // Calculate collaboration score based on patterns
    return 75; // Placeholder
  }

  private calculateQualityScore(metrics: ProductivityMetrics): number {
    // Calculate quality score based on conflicts, reviews, etc.
    const conflictRate = metrics.conflictsResolved / Math.max(metrics.totalEdits, 1);
    return Math.max(0, 100 - conflictRate * 100);
  }

  private calculateResponsivenessScore(metrics: ProductivityMetrics): number {
    // Calculate responsiveness based on response times
    return Math.max(0, 100 - metrics.averageResponseTime / 3600); // Convert seconds to hours
  }

  private calculateInnovationScore(metrics: ProductivityMetrics): number {
    // Calculate innovation score based on new documents, features, etc.
    return Math.min(metrics.documentsCreated * 10, 100);
  }

  private async calculateHealthTrends(
    workspaceId: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<{ daily: number[]; weekly: number[]; monthly: number[] }> {
    return {
      daily: [70, 72, 68, 75, 78, 80, 77],
      weekly: [70, 73, 76, 79],
      monthly: [70, 75, 78]
    };
  }

  private getEmptyProductivityMetrics(): ProductivityMetrics {
    return {
      totalEdits: 0,
      totalComments: 0,
      totalReviews: 0,
      averageResponseTime: 0,
      collaborationTime: 0,
      documentsCreated: 0,
      documentsCompleted: 0,
      reviewsApproved: 0,
      reviewsRejected: 0,
      conflictsResolved: 0,
      productivityTrend: 0
    };
  }

  private getDefaultHealthScore(): WorkspaceHealthScore {
    return {
      overall: 50,
      breakdown: {
        productivity: 50,
        collaboration: 50,
        quality: 50,
        responsiveness: 50,
        innovation: 50
      },
      trends: {
        daily: [],
        weekly: [],
        monthly: []
      },
      benchmarks: {
        industry: 0,
        similar: 0
      }
    };
  }

  /**
   * Get cached insights for workspace
   */
  public getCachedInsights(workspaceId: string): TeamInsight[] {
    return this.insightCache.get(workspaceId) || [];
  }

  /**
   * Clear caches
   */
  public clearCaches(): void {
    this.metricsCache.clear();
    this.patternCache.clear();
    this.insightCache.clear();
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    // Clear intervals
    for (const [, interval] of this.aggregationIntervals.entries()) {
      clearInterval(interval);
    }
    
    this.aggregationIntervals.clear();
    this.clearCaches();
    
    await this.redis.quit();
  }
}

export default CollaborationAnalytics;