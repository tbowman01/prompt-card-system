import { EventStore } from '../analytics/EventStore';
import { AnalyticsEngine } from '../analytics/AnalyticsEngine';
import { llmService } from '../llmService';
import { EnhancedAssertionResult } from '../assertions/AssertionEngine';

export interface PromptAnalysisResult {
  promptId: string;
  analysisId: string;
  effectiveness: {
    score: number; // 0-100
    category: 'poor' | 'fair' | 'good' | 'excellent';
    reasoning: string;
  };
  patterns: {
    successPatterns: string[];
    failurePatterns: string[];
    commonErrors: string[];
  };
  metrics: {
    averageResponseTime: number;
    successRate: number;
    totalExecutions: number;
    consistencyScore: number;
  };
  recommendations: {
    priority: 'low' | 'medium' | 'high' | 'critical';
    type: 'structure' | 'clarity' | 'specificity' | 'context' | 'security';
    suggestion: string;
    expectedImprovement: number; // percentage
  }[];
  trends: {
    performanceOverTime: Array<{ timestamp: Date; score: number }>;
    successRateOverTime: Array<{ timestamp: Date; rate: number }>;
  };
  securityIssues: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: 'injection' | 'leakage' | 'manipulation' | 'compliance';
    description: string;
    recommendation: string;
  }[];
  timestamp: Date;
}

export interface PromptComparisonResult {
  promptA: string;
  promptB: string;
  winner: 'A' | 'B' | 'tie';
  confidence: number;
  metrics: {
    responseTime: { A: number; B: number };
    successRate: { A: number; B: number };
    qualityScore: { A: number; B: number };
  };
  analysis: string;
}

export class PromptAnalyzer {
  private eventStore: EventStore;
  private analyticsEngine: AnalyticsEngine;
  
  constructor() {
    this.eventStore = EventStore.getInstance();
    this.analyticsEngine = AnalyticsEngine.getInstance();
  }

  /**
   * Analyze prompt effectiveness using historical data and AI insights
   */
  async analyzePrompt(
    promptId: string,
    promptText: string,
    timeRange: { start: Date; end: Date } = this.getDefaultTimeRange()
  ): Promise<PromptAnalysisResult> {
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Gather historical execution data
      const executionEvents = await this.eventStore.getEvents({
        event_type: 'test_execution',
        start_time: timeRange.start,
        end_time: timeRange.end
      });

      const promptExecutions = executionEvents.filter(event => 
        event.entity_id === promptId || event.data.prompt_id === promptId
      );

      // Calculate basic metrics
      const metrics = this.calculatePromptMetrics(promptExecutions);
      
      // Analyze patterns using AI
      const patterns = await this.analyzeExecutionPatterns(promptExecutions, promptText);
      
      // Generate effectiveness score
      const effectiveness = this.calculateEffectivenessScore(metrics, patterns);
      
      // Generate AI-powered recommendations
      const recommendations = await this.generateRecommendations(
        promptText, 
        metrics, 
        patterns, 
        effectiveness
      );
      
      // Calculate trends
      const trends = this.calculateTrends(promptExecutions);
      
      // Perform security analysis
      const securityIssues = await this.analyzeSecurityIssues(promptText);
      
      const result: PromptAnalysisResult = {
        promptId,
        analysisId,
        effectiveness,
        patterns,
        metrics,
        recommendations,
        trends,
        securityIssues,
        timestamp: new Date()
      };

      // Store analysis result
      await this.eventStore.recordEvent({
        event_type: 'prompt_analysis',
        entity_id: promptId,
        entity_type: 'prompt',
        data: result,
        timestamp: new Date()
      });

      return result;
    } catch (error) {
      console.error('Error analyzing prompt:', error);
      throw new Error(`Prompt analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compare two prompts and determine which performs better
   */
  async comparePrompts(
    promptA: string,
    promptB: string,
    testCases: Array<{ input: string; expectedOutput: string }>,
    model: string = 'llama3'
  ): Promise<PromptComparisonResult> {
    try {
      const resultsA = await this.testPromptPerformance(promptA, testCases, model);
      const resultsB = await this.testPromptPerformance(promptB, testCases, model);
      
      const metricsA = this.calculateTestMetrics(resultsA);
      const metricsB = this.calculateTestMetrics(resultsB);
      
      // Determine winner based on weighted scoring
      const scoreA = this.calculateWeightedScore(metricsA);
      const scoreB = this.calculateWeightedScore(metricsB);
      
      let winner: 'A' | 'B' | 'tie';
      let confidence: number;
      
      if (Math.abs(scoreA - scoreB) < 0.1) {
        winner = 'tie';
        confidence = 1 - Math.abs(scoreA - scoreB);
      } else if (scoreA > scoreB) {
        winner = 'A';
        confidence = (scoreA - scoreB) / Math.max(scoreA, scoreB);
      } else {
        winner = 'B';
        confidence = (scoreB - scoreA) / Math.max(scoreA, scoreB);
      }
      
      // Generate AI analysis
      const analysisPrompt = `
        Compare these two prompts and their performance:
        
        Prompt A: "${promptA}"
        Metrics A: Response Time: ${metricsA.responseTime}ms, Success Rate: ${metricsA.successRate}%, Quality: ${metricsA.qualityScore}
        
        Prompt B: "${promptB}"  
        Metrics B: Response Time: ${metricsB.responseTime}ms, Success Rate: ${metricsB.successRate}%, Quality: ${metricsB.qualityScore}
        
        Provide a detailed analysis of the differences and why one performs better.
      `;
      
      const analysis = await llmService.generate(analysisPrompt, model);
      
      return {
        promptA,
        promptB,
        winner,
        confidence,
        metrics: {
          responseTime: { A: metricsA.responseTime, B: metricsB.responseTime },
          successRate: { A: metricsA.successRate, B: metricsB.successRate },
          qualityScore: { A: metricsA.qualityScore, B: metricsB.qualityScore }
        },
        analysis: analysis.response
      };
    } catch (error) {
      console.error('Error comparing prompts:', error);
      throw new Error(`Prompt comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get evolution history of a prompt
   */
  async getPromptEvolution(promptId: string): Promise<Array<{
    version: string;
    timestamp: Date;
    changes: string[];
    performance: {
      successRate: number;
      responseTime: number;
      qualityScore: number;
    };
    reasoning: string;
  }>> {
    const evolutionEvents = await this.eventStore.getEvents({
      event_type: 'prompt_evolution',
      entity_id: promptId
    });
    
    return evolutionEvents.map(event => event.data);
  }

  /**
   * Calculate basic metrics from execution events
   */
  private calculatePromptMetrics(executionEvents: any[]): PromptAnalysisResult['metrics'] {
    if (executionEvents.length === 0) {
      return {
        averageResponseTime: 0,
        successRate: 0,
        totalExecutions: 0,
        consistencyScore: 0
      };
    }

    const totalExecutions = executionEvents.length;
    const successfulExecutions = executionEvents.filter(e => e.data.passed).length;
    const averageResponseTime = executionEvents.reduce((sum, e) => sum + e.data.execution_time, 0) / totalExecutions;
    
    // Calculate consistency score based on response time variance
    const responseTimes = executionEvents.map(e => e.data.execution_time);
    const variance = this.calculateVariance(responseTimes);
    const consistencyScore = Math.max(0, 100 - (variance / averageResponseTime) * 100);
    
    return {
      averageResponseTime,
      successRate: (successfulExecutions / totalExecutions) * 100,
      totalExecutions,
      consistencyScore
    };
  }

  /**
   * Analyze execution patterns using AI
   */
  private async analyzeExecutionPatterns(
    executionEvents: any[], 
    promptText: string
  ): Promise<PromptAnalysisResult['patterns']> {
    const successfulEvents = executionEvents.filter(e => e.data.passed);
    const failedEvents = executionEvents.filter(e => !e.data.passed);
    
    const analysisPrompt = `
      Analyze this prompt and its execution patterns:
      
      Prompt: "${promptText}"
      
      Successful executions: ${successfulEvents.length}
      Failed executions: ${failedEvents.length}
      
      Based on this data, identify:
      1. Patterns that lead to success
      2. Patterns that lead to failure  
      3. Common errors or issues
      
      Return a JSON object with arrays for successPatterns, failurePatterns, and commonErrors.
    `;
    
    try {
      const analysis = await llmService.generate(analysisPrompt);
      const patterns = JSON.parse(analysis.response);
      
      return {
        successPatterns: patterns.successPatterns || [],
        failurePatterns: patterns.failurePatterns || [],
        commonErrors: patterns.commonErrors || []
      };
    } catch (error) {
      console.error('Error analyzing patterns:', error);
      return {
        successPatterns: [],
        failurePatterns: [],
        commonErrors: []
      };
    }
  }

  /**
   * Calculate effectiveness score
   */
  private calculateEffectivenessScore(
    metrics: PromptAnalysisResult['metrics'],
    patterns: PromptAnalysisResult['patterns']
  ): PromptAnalysisResult['effectiveness'] {
    // Weighted scoring: Success Rate (40%), Response Time (30%), Consistency (20%), Pattern Quality (10%)
    const successScore = metrics.successRate; // 0-100
    const responseTimeScore = Math.max(0, 100 - (metrics.averageResponseTime / 1000) * 10); // Penalize slow responses
    const consistencyScore = metrics.consistencyScore; // 0-100
    const patternScore = Math.max(0, 100 - patterns.failurePatterns.length * 10); // Penalize failure patterns
    
    const weightedScore = (
      successScore * 0.4 + 
      responseTimeScore * 0.3 + 
      consistencyScore * 0.2 + 
      patternScore * 0.1
    );
    
    let category: 'poor' | 'fair' | 'good' | 'excellent';
    let reasoning: string;
    
    if (weightedScore >= 85) {
      category = 'excellent';
      reasoning = 'High success rate with consistent performance and minimal failure patterns';
    } else if (weightedScore >= 70) {
      category = 'good';
      reasoning = 'Good performance with room for minor improvements';
    } else if (weightedScore >= 50) {
      category = 'fair';
      reasoning = 'Average performance with noticeable issues that need attention';
    } else {
      category = 'poor';
      reasoning = 'Poor performance with significant issues requiring immediate attention';
    }
    
    return {
      score: Math.round(weightedScore),
      category,
      reasoning
    };
  }

  /**
   * Generate AI-powered recommendations
   */
  private async generateRecommendations(
    promptText: string,
    metrics: PromptAnalysisResult['metrics'],
    patterns: PromptAnalysisResult['patterns'],
    effectiveness: PromptAnalysisResult['effectiveness']
  ): Promise<PromptAnalysisResult['recommendations']> {
    const recommendationPrompt = `
      Analyze this prompt and provide improvement recommendations:
      
      Prompt: "${promptText}"
      
      Current Performance:
      - Success Rate: ${metrics.successRate}%
      - Average Response Time: ${metrics.averageResponseTime}ms
      - Consistency Score: ${metrics.consistencyScore}%
      - Effectiveness: ${effectiveness.score}/100 (${effectiveness.category})
      
      Failure Patterns: ${patterns.failurePatterns.join(', ')}
      Common Errors: ${patterns.commonErrors.join(', ')}
      
      Provide specific, actionable recommendations to improve this prompt.
      Return a JSON array with objects containing: priority, type, suggestion, expectedImprovement.
    `;
    
    try {
      const response = await llmService.generate(recommendationPrompt);
      const recommendations = JSON.parse(response.response);
      
      return recommendations.map((rec: any) => ({
        priority: rec.priority || 'medium',
        type: rec.type || 'structure',
        suggestion: rec.suggestion || 'No specific suggestion provided',
        expectedImprovement: rec.expectedImprovement || 5
      }));
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [
        {
          priority: 'medium' as const,
          type: 'structure' as const,
          suggestion: 'Consider adding more specific instructions and examples',
          expectedImprovement: 10
        }
      ];
    }
  }

  /**
   * Calculate trends from execution data
   */
  private calculateTrends(executionEvents: any[]): PromptAnalysisResult['trends'] {
    const groupedByHour = this.groupEventsByHour(executionEvents);
    
    const performanceOverTime = groupedByHour.map(group => ({
      timestamp: group.timestamp,
      score: group.events.length > 0 ? 
        group.events.reduce((sum, e) => sum + (e.data.passed ? 100 : 0), 0) / group.events.length : 0
    }));
    
    const successRateOverTime = groupedByHour.map(group => ({
      timestamp: group.timestamp,
      rate: group.events.length > 0 ? 
        group.events.filter(e => e.data.passed).length / group.events.length : 0
    }));
    
    return {
      performanceOverTime,
      successRateOverTime
    };
  }

  /**
   * Analyze security issues in prompt
   */
  private async analyzeSecurityIssues(promptText: string): Promise<PromptAnalysisResult['securityIssues']> {
    const securityIssues: PromptAnalysisResult['securityIssues'] = [];
    
    // Check for prompt injection patterns
    const injectionPatterns = [
      /ignore.*previous.*instructions/i,
      /system.*prompt/i,
      /role.*play/i,
      /jailbreak/i,
      /pretend.*you.*are/i,
      /forget.*everything/i,
      /new.*instructions/i,
      /override.*safety/i
    ];
    
    for (const pattern of injectionPatterns) {
      if (pattern.test(promptText)) {
        securityIssues.push({
          severity: 'high',
          type: 'injection',
          description: `Potential prompt injection pattern detected: ${pattern.source}`,
          recommendation: 'Review and sanitize prompt to prevent injection attacks'
        });
      }
    }
    
    // Check for sensitive information leakage
    const sensitivePatterns = [
      /password/i,
      /api.*key/i,
      /secret/i,
      /token/i,
      /credential/i,
      /private.*key/i
    ];
    
    for (const pattern of sensitivePatterns) {
      if (pattern.test(promptText)) {
        securityIssues.push({
          severity: 'critical',
          type: 'leakage',
          description: `Potential sensitive information detected: ${pattern.source}`,
          recommendation: 'Remove or mask sensitive information from prompt'
        });
      }
    }
    
    // Check for manipulation attempts
    const manipulationPatterns = [
      /you.*must/i,
      /you.*have.*to/i,
      /required.*to/i,
      /bypass.*restrictions/i,
      /special.*permissions/i
    ];
    
    for (const pattern of manipulationPatterns) {
      if (pattern.test(promptText)) {
        securityIssues.push({
          severity: 'medium',
          type: 'manipulation',
          description: `Potential manipulation attempt detected: ${pattern.source}`,
          recommendation: 'Review prompt for manipulative language'
        });
      }
    }
    
    return securityIssues;
  }

  /**
   * Test prompt performance with given test cases
   */
  private async testPromptPerformance(
    prompt: string,
    testCases: Array<{ input: string; expectedOutput: string }>,
    model: string
  ): Promise<Array<{ responseTime: number; success: boolean; quality: number }>> {
    const results = [];
    
    for (const testCase of testCases) {
      const startTime = Date.now();
      const fullPrompt = `${prompt}\n\nInput: ${testCase.input}`;
      
      try {
        const response = await llmService.generate(fullPrompt, model);
        const responseTime = Date.now() - startTime;
        
        // Simple quality scoring based on similarity to expected output
        const quality = this.calculateResponseQuality(response.response, testCase.expectedOutput);
        const success = quality > 0.7; // Consider success if quality > 70%
        
        results.push({ responseTime, success, quality });
      } catch (error) {
        results.push({ responseTime: Date.now() - startTime, success: false, quality: 0 });
      }
    }
    
    return results;
  }

  /**
   * Calculate metrics from test results
   */
  private calculateTestMetrics(results: Array<{ responseTime: number; success: boolean; quality: number }>) {
    const totalTests = results.length;
    const successfulTests = results.filter(r => r.success).length;
    const averageResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / totalTests;
    const averageQuality = results.reduce((sum, r) => sum + r.quality, 0) / totalTests;
    
    return {
      responseTime: averageResponseTime,
      successRate: (successfulTests / totalTests) * 100,
      qualityScore: averageQuality * 100
    };
  }

  /**
   * Calculate weighted score for comparison
   */
  private calculateWeightedScore(metrics: { responseTime: number; successRate: number; qualityScore: number }) {
    // Normalize response time (lower is better)
    const normalizedResponseTime = Math.max(0, 100 - (metrics.responseTime / 1000) * 10);
    
    // Weighted scoring: Success Rate (40%), Quality (40%), Response Time (20%)
    return (
      metrics.successRate * 0.4 + 
      metrics.qualityScore * 0.4 + 
      normalizedResponseTime * 0.2
    ) / 100;
  }

  /**
   * Calculate response quality using simple similarity
   */
  private calculateResponseQuality(response: string, expected: string): number {
    const responseWords = response.toLowerCase().split(/\s+/);
    const expectedWords = expected.toLowerCase().split(/\s+/);
    
    const commonWords = responseWords.filter(word => expectedWords.includes(word));
    const similarity = commonWords.length / Math.max(responseWords.length, expectedWords.length);
    
    return Math.min(1, similarity * 2); // Boost similarity score
  }

  /**
   * Group events by hour
   */
  private groupEventsByHour(events: any[]): Array<{ timestamp: Date; events: any[] }> {
    const groups = new Map<string, any[]>();
    
    events.forEach(event => {
      const timestamp = new Date(event.timestamp);
      const hourKey = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()}-${timestamp.getHours()}`;
      
      if (!groups.has(hourKey)) {
        groups.set(hourKey, []);
      }
      groups.get(hourKey)!.push(event);
    });
    
    return Array.from(groups.entries())
      .map(([key, events]) => {
        const parts = key.split('-').map(Number);
        const timestamp = new Date(parts[0], parts[1], parts[2], parts[3]);
        return { timestamp, events };
      })
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Calculate variance of an array of numbers
   */
  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  /**
   * Get default time range (last 7 days)
   */
  private getDefaultTimeRange(): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    return { start, end };
  }
}

// Export singleton instance
export const promptAnalyzer = new PromptAnalyzer();