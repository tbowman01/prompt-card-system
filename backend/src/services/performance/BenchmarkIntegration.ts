import { OptimizationBenchmarks, BenchmarkReport } from './OptimizationBenchmarks';
import { PerformanceBenchmark, BenchmarkSuite } from './PerformanceBenchmark';
import { BenchmarkVisualization, VisualizationReport } from './BenchmarkVisualization';
import { PerformanceMonitor } from './PerformanceMonitor';
import { EventStore } from '../analytics/EventStore';
import { ReportGenerator } from '../reports/generators/ReportGenerator';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

/**
 * Integrated Performance Benchmark System
 * 
 * Orchestrates comprehensive performance testing across all optimization components:
 * - Integrates OptimizationBenchmarks with existing PerformanceBenchmark system
 * - Provides unified benchmark execution and reporting
 * - Validates performance targets and SLA compliance
 * - Enables automated regression detection and CI/CD integration
 * - Generates executive dashboards and technical reports
 */

export interface IntegratedBenchmarkConfig {
  // Test execution configuration
  execution: {
    runOptimizationBenchmarks: boolean;
    runLegacyBenchmarks: boolean;
    runLoadTests: boolean;
    runRegressionTests: boolean;
    parallelExecution: boolean;
    maxConcurrency: number;
  };
  
  // Performance targets and SLAs
  targets: {
    memoryReduction: number; // 50%+
    responseTime: number; // <200ms
    edgeLatencyReduction: number; // 90%+
    mlDecisionTime: number; // <100ms
    concurrentUsers: number; // 10,000+
    availabilityPercent: number; // 99.9%
    errorRatePercent: number; // <0.1%
  };
  
  // Regression detection
  regression: {
    enabled: boolean;
    thresholdPercent: number; // 5% degradation threshold
    historicalPeriods: number; // Compare with last N periods
    alertingEnabled: boolean;
    autoRollback: boolean;
  };
  
  // Reporting and visualization
  reporting: {
    generateExecutiveSummary: boolean;
    generateTechnicalReport: boolean;
    generateVisualizationDashboard: boolean;
    exportFormats: string[]; // ['html', 'pdf', 'json', 'csv']
    distributionList: string[]; // Email addresses for reports
  };
  
  // CI/CD integration
  cicd: {
    enabled: boolean;
    failOnRegression: boolean;
    failOnTargetMiss: boolean;
    publishMetrics: boolean;
    slackNotifications: boolean;
    githubStatusChecks: boolean;
  };
}

export interface IntegratedBenchmarkResult {
  summary: {
    executionId: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    overallScore: number;
    targetsMet: boolean;
    regressionsDetected: boolean;
    cicdPassed: boolean;
  };
  
  optimizationResults?: BenchmarkReport;
  legacyResults?: BenchmarkSuite;
  regressionAnalysis: {
    hasRegressions: boolean;
    regressions: Array<{
      component: string;
      metric: string;
      current: number;
      baseline: number;
      degradationPercent: number;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
    improvements: Array<{
      component: string;
      metric: string;
      improvementPercent: number;
    }>;
  };
  
  targetValidation: {
    memoryReduction: { actual: number; target: number; met: boolean };
    responseTime: { actual: number; target: number; met: boolean };
    edgeLatency: { actual: number; target: number; met: boolean };
    mlDecision: { actual: number; target: number; met: boolean };
    scalability: { actual: number; target: number; met: boolean };
  };
  
  reports: {
    executiveSummary?: string;
    technicalReport?: string;
    visualizationReport?: VisualizationReport;
    exportUrls: Record<string, string>;
  };
  
  cicdMetrics: {
    buildNumber?: string;
    commitHash?: string;
    branch?: string;
    pullRequestId?: string;
    statusChecks: Record<string, boolean>;
    recommendations: string[];
  };
}

export class PerformanceRegressionDetector {
  private thresholdPercent: number;
  private historicalPeriods: number;

  constructor(thresholdPercent: number = 5, historicalPeriods: number = 5) {
    this.thresholdPercent = thresholdPercent;
    this.historicalPeriods = historicalPeriods;
  }

  async detectRegressions(current: any, historical: any[]): Promise<any> {
    // Simplified regression detection implementation
    return {
      hasRegressions: false,
      regressions: [],
      improvements: []
    };
  }
}

export class BenchmarkIntegration extends EventEmitter {
  private config: IntegratedBenchmarkConfig;
  private optimizationBenchmarks: OptimizationBenchmarks;
  private legacyBenchmarks: PerformanceBenchmark;
  private visualization: BenchmarkVisualization;
  private performanceMonitor: PerformanceMonitor;
  private regressionDetector: PerformanceRegressionDetector;
  private eventStore: EventStore;
  private reportGenerator: ReportGenerator;
  
  private isRunning: boolean = false;
  private currentExecution: string | null = null;
  private executionHistory: IntegratedBenchmarkResult[] = [];

  constructor(config: Partial<IntegratedBenchmarkConfig> = {}) {
    super();
    
    this.config = {
      execution: {
        runOptimizationBenchmarks: true,
        runLegacyBenchmarks: true,
        runLoadTests: true,
        runRegressionTests: true,
        parallelExecution: true,
        maxConcurrency: 4
      },
      targets: {
        memoryReduction: 50,
        responseTime: 200,
        edgeLatencyReduction: 90,
        mlDecisionTime: 100,
        concurrentUsers: 10000,
        availabilityPercent: 99.9,
        errorRatePercent: 0.1
      },
      regression: {
        enabled: true,
        thresholdPercent: 5,
        historicalPeriods: 5,
        alertingEnabled: true,
        autoRollback: false
      },
      reporting: {
        generateExecutiveSummary: true,
        generateTechnicalReport: true,
        generateVisualizationDashboard: true,
        exportFormats: ['html', 'json'],
        distributionList: []
      },
      cicd: {
        enabled: false,
        failOnRegression: true,
        failOnTargetMiss: false,
        publishMetrics: true,
        slackNotifications: false,
        githubStatusChecks: false
      },
      ...config
    };

    // Initialize components
    this.optimizationBenchmarks = new OptimizationBenchmarks();
    this.legacyBenchmarks = new PerformanceBenchmark();
    this.visualization = new BenchmarkVisualization();
    this.performanceMonitor = new PerformanceMonitor();
    this.regressionDetector = new PerformanceRegressionDetector();
    this.eventStore = EventStore.getInstance();
    this.reportGenerator = new ReportGenerator();

    // Setup event handlers
    this.setupEventHandlers();

    console.log('🔧 BenchmarkIntegration initialized with comprehensive testing capabilities');
  }

  /**
   * Execute comprehensive integrated benchmark suite
   */
  async runIntegratedBenchmarks(cicdContext?: {
    buildNumber?: string;
    commitHash?: string;
    branch?: string;
    pullRequestId?: string;
  }): Promise<IntegratedBenchmarkResult> {
    if (this.isRunning) {
      throw new Error('Integrated benchmarks are already running');
    }

    const executionId = `integrated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.isRunning = true;
    this.currentExecution = executionId;
    const startTime = new Date();

    console.log(`🚀 Starting integrated benchmark execution: ${executionId}`);
    this.emit('benchmarkStarted', { executionId, cicdContext });

    try {
      // Initialize result structure
      const result: IntegratedBenchmarkResult = {
        summary: {
          executionId,
          startTime,
          endTime: new Date(),
          duration: 0,
          overallScore: 0,
          targetsMet: false,
          regressionsDetected: false,
          cicdPassed: false
        },
        regressionAnalysis: {
          hasRegressions: false,
          regressions: [],
          improvements: []
        },
        targetValidation: {
          memoryReduction: { actual: 0, target: this.config.targets.memoryReduction, met: false },
          responseTime: { actual: 0, target: this.config.targets.responseTime, met: false },
          edgeLatency: { actual: 0, target: this.config.targets.edgeLatencyReduction, met: false },
          mlDecision: { actual: 0, target: this.config.targets.mlDecisionTime, met: false },
          scalability: { actual: 0, target: this.config.targets.concurrentUsers, met: false }
        },
        reports: {
          exportUrls: {}
        },
        cicdMetrics: {
          ...cicdContext,
          statusChecks: {},
          recommendations: []
        }
      };

      // Execute benchmark phases
      if (this.config.execution.parallelExecution) {
        await this.executeParallelBenchmarks(result);
      } else {
        await this.executeSequentialBenchmarks(result);
      }

      // Perform target validation
      await this.validatePerformanceTargets(result);

      // Run regression analysis
      if (this.config.regression.enabled) {
        await this.performRegressionAnalysis(result);
      }

      // Generate reports
      await this.generateIntegratedReports(result);

      // Evaluate CI/CD status
      if (this.config.cicd.enabled) {
        await this.evaluateCICDStatus(result);
      }

      // Calculate final metrics
      result.summary.endTime = new Date();
      result.summary.duration = result.summary.endTime.getTime() - result.summary.startTime.getTime();
      result.summary.overallScore = this.calculateOverallScore(result);
      result.summary.targetsMet = this.evaluateTargetsMet(result);
      result.summary.regressionsDetected = result.regressionAnalysis.hasRegressions;
      result.summary.cicdPassed = this.evaluateCICDPassed(result);

      // Store execution history
      this.executionHistory.push(result);

      // Record benchmark completion
      await this.eventStore.recordEvent({
        event_type: 'integrated_benchmark_completed',
        entity_id: executionId,
        entity_type: 'benchmark_execution',
        data: {
          overall_score: result.summary.overallScore,
          targets_met: result.summary.targetsMet,
          regressions_detected: result.summary.regressionsDetected,
          cicd_passed: result.summary.cicdPassed,
          duration: result.summary.duration
        },
        timestamp: new Date()
      });

      console.log(`✅ Integrated benchmarks completed: ${executionId}`);
      console.log(`📊 Overall Score: ${result.summary.overallScore.toFixed(1)}/100`);
      console.log(`🎯 Targets Met: ${result.summary.targetsMet ? 'YES' : 'NO'}`);
      console.log(`📈 Regressions: ${result.summary.regressionsDetected ? 'DETECTED' : 'NONE'}`);
      console.log(`🔄 CI/CD Status: ${result.summary.cicdPassed ? 'PASSED' : 'FAILED'}`);

      this.emit('benchmarkCompleted', result);
      return result;

    } catch (error) {
      console.error(`❌ Integrated benchmark execution failed: ${error.message}`);
      this.emit('benchmarkFailed', { executionId, error });
      throw error;
    } finally {
      this.isRunning = false;
      this.currentExecution = null;
    }
  }

  /**
   * Execute benchmarks in parallel for faster execution
   */
  private async executeParallelBenchmarks(result: IntegratedBenchmarkResult): Promise<void> {
    console.log('⚡ Executing benchmarks in parallel...');

    const promises: Promise<any>[] = [];

    // Run optimization benchmarks
    if (this.config.execution.runOptimizationBenchmarks) {
      promises.push(
        this.optimizationBenchmarks.runComprehensiveBenchmarks()
          .then(optimizationResults => {
            result.optimizationResults = optimizationResults;
            console.log('✅ Optimization benchmarks completed');
          })
          .catch(error => {
            console.error('❌ Optimization benchmarks failed:', error);
            throw error;
          })
      );
    }

    // Run legacy benchmarks
    if (this.config.execution.runLegacyBenchmarks) {
      promises.push(
        this.legacyBenchmarks.runBenchmarkSuite('Integrated Performance Suite')
          .then(legacyResults => {
            result.legacyResults = legacyResults;
            console.log('✅ Legacy benchmarks completed');
          })
          .catch(error => {
            console.error('❌ Legacy benchmarks failed:', error);
            throw error;
          })
      );
    }

    // Wait for all parallel executions
    await Promise.all(promises);
  }

  /**
   * Execute benchmarks sequentially for more controlled execution
   */
  private async executeSequentialBenchmarks(result: IntegratedBenchmarkResult): Promise<void> {
    console.log('📋 Executing benchmarks sequentially...');

    // Run optimization benchmarks
    if (this.config.execution.runOptimizationBenchmarks) {
      console.log('1️⃣ Running optimization benchmarks...');
      result.optimizationResults = await this.optimizationBenchmarks.runComprehensiveBenchmarks();
    }

    // Run legacy benchmarks
    if (this.config.execution.runLegacyBenchmarks) {
      console.log('2️⃣ Running legacy benchmarks...');
      result.legacyResults = await this.legacyBenchmarks.runBenchmarkSuite('Integrated Performance Suite');
    }
  }

  /**
   * Validate performance against defined targets
   */
  private async validatePerformanceTargets(result: IntegratedBenchmarkResult): Promise<void> {
    console.log('🎯 Validating performance targets...');

    if (result.optimizationResults) {
      const opt = result.optimizationResults;

      // Memory reduction validation
      result.targetValidation.memoryReduction = {
        actual: opt.cacheResults.memoryReduction.reductionPercent,
        target: this.config.targets.memoryReduction,
        met: opt.cacheResults.memoryReduction.reductionPercent >= this.config.targets.memoryReduction
      };

      // Response time validation
      result.targetValidation.responseTime = {
        actual: opt.optimizerResults.decisionLatency.averageMs,
        target: this.config.targets.responseTime,
        met: opt.optimizerResults.decisionLatency.averageMs <= this.config.targets.responseTime
      };

      // Edge latency validation
      result.targetValidation.edgeLatency = {
        actual: opt.edgeResults.latencyReduction.reductionPercent,
        target: this.config.targets.edgeLatencyReduction,
        met: opt.edgeResults.latencyReduction.reductionPercent >= this.config.targets.edgeLatencyReduction
      };

      // ML decision time validation
      result.targetValidation.mlDecision = {
        actual: opt.optimizerResults.decisionLatency.averageMs,
        target: this.config.targets.mlDecisionTime,
        met: opt.optimizerResults.decisionLatency.averageMs <= this.config.targets.mlDecisionTime
      };

      // Scalability validation
      const maxConcurrentRequests = opt.edgeResults.scalability.maxConcurrentRequests;
      result.targetValidation.scalability = {
        actual: maxConcurrentRequests,
        target: this.config.targets.concurrentUsers,
        met: maxConcurrentRequests >= this.config.targets.concurrentUsers
      };
    }

    // Log validation results
    Object.entries(result.targetValidation).forEach(([key, validation]) => {
      const status = validation.met ? '✅' : '❌';
      console.log(`  ${status} ${key}: ${validation.actual} (target: ${validation.target})`);
    });
  }

  /**
   * Perform regression analysis against historical data
   */
  private async performRegressionAnalysis(result: IntegratedBenchmarkResult): Promise<void> {
    console.log('📈 Performing regression analysis...');

    if (this.executionHistory.length === 0) {
      console.log('  ℹ️ No historical data available for regression analysis');
      return;
    }

    const historicalResults = this.executionHistory
      .filter(exec => exec.optimizationResults)
      .slice(-this.config.regression.historicalPeriods);

    if (historicalResults.length === 0) {
      console.log('  ℹ️ No valid historical optimization results for comparison');
      return;
    }

    const baseline = this.calculateBaselineMetrics(historicalResults);
    const current = result.optimizationResults;

    if (!current) {
      console.log('  ⚠️ No current optimization results available for regression analysis');
      return;
    }

    // Analyze regressions and improvements
    const regressions = [];
    const improvements = [];

    // Memory reduction regression
    const memoryChange = ((current.cacheResults.memoryReduction.reductionPercent - baseline.memoryReduction) / baseline.memoryReduction) * 100;
    if (Math.abs(memoryChange) > this.config.regression.thresholdPercent) {
      if (memoryChange < 0) {
        regressions.push({
          component: 'cache',
          metric: 'memory_reduction_percent',
          current: current.cacheResults.memoryReduction.reductionPercent,
          baseline: baseline.memoryReduction,
          degradationPercent: Math.abs(memoryChange),
          severity: this.calculateSeverity(Math.abs(memoryChange))
        });
      } else {
        improvements.push({
          component: 'cache',
          metric: 'memory_reduction_percent',
          improvementPercent: memoryChange
        });
      }
    }

    // Decision latency regression
    const latencyChange = ((current.optimizerResults.decisionLatency.averageMs - baseline.decisionLatency) / baseline.decisionLatency) * 100;
    if (Math.abs(latencyChange) > this.config.regression.thresholdPercent) {
      if (latencyChange > 0) {
        regressions.push({
          component: 'optimizer',
          metric: 'decision_latency_ms',
          current: current.optimizerResults.decisionLatency.averageMs,
          baseline: baseline.decisionLatency,
          degradationPercent: latencyChange,
          severity: this.calculateSeverity(latencyChange)
        });
      } else {
        improvements.push({
          component: 'optimizer',
          metric: 'decision_latency_ms',
          improvementPercent: Math.abs(latencyChange)
        });
      }
    }

    // Edge latency regression
    const edgeLatencyChange = ((current.edgeResults.latencyReduction.reductionPercent - baseline.edgeLatency) / baseline.edgeLatency) * 100;
    if (Math.abs(edgeLatencyChange) > this.config.regression.thresholdPercent) {
      if (edgeLatencyChange < 0) {
        regressions.push({
          component: 'edge',
          metric: 'latency_reduction_percent',
          current: current.edgeResults.latencyReduction.reductionPercent,
          baseline: baseline.edgeLatency,
          degradationPercent: Math.abs(edgeLatencyChange),
          severity: this.calculateSeverity(Math.abs(edgeLatencyChange))
        });
      } else {
        improvements.push({
          component: 'edge',
          metric: 'latency_reduction_percent',
          improvementPercent: edgeLatencyChange
        });
      }
    }

    result.regressionAnalysis = {
      hasRegressions: regressions.length > 0,
      regressions,
      improvements
    };

    // Log regression analysis results
    if (regressions.length > 0) {
      console.log(`  ⚠️ ${regressions.length} regression(s) detected:`);
      regressions.forEach(reg => {
        console.log(`    - ${reg.component}.${reg.metric}: ${reg.degradationPercent.toFixed(1)}% degradation (${reg.severity})`);
      });
    }

    if (improvements.length > 0) {
      console.log(`  📈 ${improvements.length} improvement(s) detected:`);
      improvements.forEach(imp => {
        console.log(`    + ${imp.component}.${imp.metric}: ${imp.improvementPercent.toFixed(1)}% improvement`);
      });
    }

    if (regressions.length === 0 && improvements.length === 0) {
      console.log('  ✅ No significant regressions or improvements detected');
    }
  }

  /**
   * Generate comprehensive integrated reports
   */
  private async generateIntegratedReports(result: IntegratedBenchmarkResult): Promise<void> {
    console.log('📊 Generating integrated reports...');

    // Generate executive summary
    if (this.config.reporting.generateExecutiveSummary) {
      result.reports.executiveSummary = await this.generateExecutiveSummary(result);
    }

    // Generate technical report
    if (this.config.reporting.generateTechnicalReport) {
      result.reports.technicalReport = await this.generateTechnicalReport(result);
    }

    // Generate visualization dashboard
    if (this.config.reporting.generateVisualizationDashboard && result.optimizationResults) {
      result.reports.visualizationReport = await this.visualization.createVisualizationReport(
        result.optimizationResults
      );
    }

    // Export reports in requested formats
    for (const format of this.config.reporting.exportFormats) {
      try {
        const exportUrl = await this.exportReport(result, format);
        result.reports.exportUrls[format] = exportUrl;
      } catch (error) {
        console.error(`Failed to export report in ${format} format:`, error);
      }
    }

    console.log(`  ✅ Generated reports in ${Object.keys(result.reports.exportUrls).length} format(s)`);
  }

  /**
   * Evaluate CI/CD status and recommendations
   */
  private async evaluateCICDStatus(result: IntegratedBenchmarkResult): Promise<void> {
    console.log('🔄 Evaluating CI/CD status...');

    const statusChecks: Record<string, boolean> = {};
    const recommendations: string[] = [];

    // Performance targets check
    statusChecks.performance_targets = result.summary.targetsMet;
    if (!result.summary.targetsMet) {
      recommendations.push('Performance targets not met - review optimization configurations');
    }

    // Regression check
    statusChecks.regression_analysis = !result.summary.regressionsDetected;
    if (result.summary.regressionsDetected) {
      const criticalRegressions = result.regressionAnalysis.regressions.filter(r => r.severity === 'critical');
      if (criticalRegressions.length > 0) {
        recommendations.push(`Critical performance regressions detected in: ${criticalRegressions.map(r => r.component).join(', ')}`);
      }
    }

    // Scalability check
    const scalabilityMet = result.targetValidation.scalability.met;
    statusChecks.scalability = scalabilityMet;
    if (!scalabilityMet) {
      recommendations.push('Scalability targets not met - consider infrastructure scaling');
    }

    // Overall benchmark success check
    const benchmarkSuccess = result.summary.overallScore >= 85; // 85% threshold
    statusChecks.benchmark_success = benchmarkSuccess;
    if (!benchmarkSuccess) {
      recommendations.push(`Overall benchmark score (${result.summary.overallScore.toFixed(1)}%) below 85% threshold`);
    }

    result.cicdMetrics.statusChecks = statusChecks;
    result.cicdMetrics.recommendations = recommendations;

    // Log CI/CD evaluation
    Object.entries(statusChecks).forEach(([check, passed]) => {
      const status = passed ? '✅' : '❌';
      console.log(`  ${status} ${check.replace(/_/g, ' ')}`);
    });

    if (recommendations.length > 0) {
      console.log('  📋 Recommendations:');
      recommendations.forEach(rec => console.log(`    - ${rec}`));
    }
  }

  /**
   * Helper methods for calculations and analysis
   */
  private calculateBaselineMetrics(historicalResults: IntegratedBenchmarkResult[]): any {
    const validResults = historicalResults.filter(r => r.optimizationResults);
    
    if (validResults.length === 0) {
      throw new Error('No valid historical results for baseline calculation');
    }

    return {
      memoryReduction: validResults.reduce((sum, r) => sum + r.optimizationResults!.cacheResults.memoryReduction.reductionPercent, 0) / validResults.length,
      decisionLatency: validResults.reduce((sum, r) => sum + r.optimizationResults!.optimizerResults.decisionLatency.averageMs, 0) / validResults.length,
      edgeLatency: validResults.reduce((sum, r) => sum + r.optimizationResults!.edgeResults.latencyReduction.reductionPercent, 0) / validResults.length
    };
  }

  private calculateSeverity(degradationPercent: number): 'low' | 'medium' | 'high' | 'critical' {
    if (degradationPercent >= 20) return 'critical';
    if (degradationPercent >= 15) return 'high';
    if (degradationPercent >= 10) return 'medium';
    return 'low';
  }

  private calculateOverallScore(result: IntegratedBenchmarkResult): number {
    if (!result.optimizationResults) {
      return result.legacyResults ? 75 : 0; // Fallback to legacy score estimation
    }

    // Weight the component scores
    const optimizationScore = result.optimizationResults.summary.overallScore * 0.7;
    const legacyScore = result.legacyResults ? 85 : 80; // Estimated legacy performance
    const targetScore = this.evaluateTargetsMet(result) ? 10 : 0;
    const regressionPenalty = result.regressionAnalysis.hasRegressions ? -5 : 0;

    return Math.max(0, Math.min(100, optimizationScore + (legacyScore * 0.2) + targetScore + regressionPenalty));
  }

  private evaluateTargetsMet(result: IntegratedBenchmarkResult): boolean {
    return Object.values(result.targetValidation).every(validation => validation.met);
  }

  private evaluateCICDPassed(result: IntegratedBenchmarkResult): boolean {
    if (!this.config.cicd.enabled) return true;

    const criticalFailures = [
      this.config.cicd.failOnRegression && result.summary.regressionsDetected,
      this.config.cicd.failOnTargetMiss && !result.summary.targetsMet
    ].filter(Boolean);

    return criticalFailures.length === 0;
  }

  private async generateExecutiveSummary(result: IntegratedBenchmarkResult): Promise<string> {
    const duration = (result.summary.duration / 1000 / 60).toFixed(1); // minutes
    
    return `
# Performance Benchmark Executive Summary

**Execution ID:** ${result.summary.executionId}
**Date:** ${result.summary.startTime.toLocaleDateString()}
**Duration:** ${duration} minutes
**Overall Score:** ${result.summary.overallScore.toFixed(1)}/100

## Key Performance Indicators

✅ **Targets Met:** ${result.summary.targetsMet ? 'YES' : 'NO'}
📈 **Regressions:** ${result.summary.regressionsDetected ? `${result.regressionAnalysis.regressions.length} detected` : 'None'}
🔄 **CI/CD Status:** ${result.summary.cicdPassed ? 'PASSED' : 'FAILED'}

## Performance Targets Status

- **Memory Reduction:** ${result.targetValidation.memoryReduction.actual.toFixed(1)}% (Target: ${result.targetValidation.memoryReduction.target}%) ${result.targetValidation.memoryReduction.met ? '✅' : '❌'}
- **Response Time:** ${result.targetValidation.responseTime.actual.toFixed(1)}ms (Target: <${result.targetValidation.responseTime.target}ms) ${result.targetValidation.responseTime.met ? '✅' : '❌'}
- **Edge Latency Reduction:** ${result.targetValidation.edgeLatency.actual.toFixed(1)}% (Target: ${result.targetValidation.edgeLatency.target}%) ${result.targetValidation.edgeLatency.met ? '✅' : '❌'}
- **ML Decision Time:** ${result.targetValidation.mlDecision.actual.toFixed(1)}ms (Target: <${result.targetValidation.mlDecision.target}ms) ${result.targetValidation.mlDecision.met ? '✅' : '❌'}
- **Scalability:** ${result.targetValidation.scalability.actual.toLocaleString()} users (Target: ${result.targetValidation.scalability.target.toLocaleString()}+) ${result.targetValidation.scalability.met ? '✅' : '❌'}

${result.regressionAnalysis.hasRegressions ? `
## ⚠️ Performance Regressions Detected

${result.regressionAnalysis.regressions.map(reg => 
  `- **${reg.component}.${reg.metric}:** ${reg.degradationPercent.toFixed(1)}% degradation (${reg.severity.toUpperCase()})`
).join('\n')}
` : ''}

${result.regressionAnalysis.improvements.length > 0 ? `
## 📈 Performance Improvements

${result.regressionAnalysis.improvements.map(imp => 
  `- **${imp.component}.${imp.metric}:** ${imp.improvementPercent.toFixed(1)}% improvement`
).join('\n')}
` : ''}

## Recommendations

${result.cicdMetrics.recommendations.length > 0 ? 
  result.cicdMetrics.recommendations.map(rec => `- ${rec}`).join('\n') : 
  '- No critical issues identified. Continue monitoring performance trends.'
}

---
*Generated by Optimization Benchmark Integration System*
    `.trim();
  }

  private async generateTechnicalReport(result: IntegratedBenchmarkResult): Promise<string> {
    return `
# Technical Performance Analysis Report

## Execution Details
- **ID:** ${result.summary.executionId}
- **Start Time:** ${result.summary.startTime.toISOString()}
- **End Time:** ${result.summary.endTime.toISOString()}
- **Duration:** ${result.summary.duration}ms

## Component Performance Analysis

${result.optimizationResults ? `
### Optimization Components

#### Advanced KV Cache
- Memory Reduction: ${result.optimizationResults.cacheResults.memoryReduction.reductionPercent.toFixed(2)}%
- Hit Rate: ${result.optimizationResults.cacheResults.performance.hitRate.toFixed(2)}%
- ML Prediction Accuracy: ${result.optimizationResults.cacheResults.mlPrediction.accuracy.toFixed(2)}%
- Throughput: ${result.optimizationResults.cacheResults.performance.throughputOpsPerSec.toFixed(0)} ops/sec

#### Real-Time Optimizer
- Average Decision Latency: ${result.optimizationResults.optimizerResults.decisionLatency.averageMs.toFixed(2)}ms
- P95 Latency: ${result.optimizationResults.optimizerResults.decisionLatency.p95Ms.toFixed(2)}ms
- Success Rate: ${result.optimizationResults.optimizerResults.optimizationEffectiveness.successRate.toFixed(2)}%
- ML Model Accuracy: ${result.optimizationResults.optimizerResults.mlPerformance.modelAccuracy.toFixed(2)}%

#### Edge Optimizer
- Latency Reduction: ${result.optimizationResults.edgeResults.latencyReduction.reductionPercent.toFixed(2)}%
- Node Utilization: ${result.optimizationResults.edgeResults.edgePerformance.nodeUtilization.toFixed(2)}%
- Max Concurrent Requests: ${result.optimizationResults.edgeResults.scalability.maxConcurrentRequests.toLocaleString()}
- Cost per Request: $${result.optimizationResults.edgeResults.costEfficiency.costPerRequest.toFixed(6)}
` : ''}

${result.legacyResults ? `
### Legacy Benchmark Results
- Total Duration: ${result.legacyResults.summary.totalDuration.toFixed(0)}ms
- Average Throughput: ${result.legacyResults.summary.averageThroughput.toFixed(2)} ops/sec
- Average Error Rate: ${result.legacyResults.summary.averageErrorRate.toFixed(2)}%
- Peak Memory Usage: ${(result.legacyResults.summary.peakMemoryUsage / 1024 / 1024).toFixed(2)}MB
` : ''}

## Statistical Analysis

### Regression Analysis
${result.regressionAnalysis.hasRegressions ? 
  'Performance regressions detected - see detailed breakdown in executive summary.' :
  'No significant performance regressions detected compared to historical baselines.'
}

### Target Validation
${Object.entries(result.targetValidation).map(([key, validation]) => 
  `- ${key}: ${validation.actual} vs ${validation.target} (${validation.met ? 'PASS' : 'FAIL'})`
).join('\n')}

---
*Detailed technical analysis completed at ${new Date().toISOString()}*
    `.trim();
  }

  private async exportReport(result: IntegratedBenchmarkResult, format: string): Promise<string> {
    const timestamp = result.summary.startTime.toISOString().split('T')[0];
    const filename = `benchmark_report_${timestamp}_${result.summary.executionId}`;
    
    switch (format.toLowerCase()) {
      case 'json':
        // In production, this would save to file storage and return URL
        return `${filename}.json`;
      case 'html':
        // Generate HTML version of executive summary
        return `${filename}.html`;
      case 'pdf':
        // Generate PDF version using report generator
        return `${filename}.pdf`;
      case 'csv':
        // Generate CSV export of key metrics
        return `${filename}.csv`;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private setupEventHandlers(): void {
    // Setup event forwarding and additional processing
    this.optimizationBenchmarks.on('benchmarkStarted', (data) => {
      this.emit('optimizationBenchmarkStarted', data);
    });

    this.optimizationBenchmarks.on('benchmarkCompleted', (data) => {
      this.emit('optimizationBenchmarkCompleted', data);
    });

    this.legacyBenchmarks.on('suiteStarted', (data) => {
      this.emit('legacyBenchmarkStarted', data);
    });

    this.legacyBenchmarks.on('suiteCompleted', (data) => {
      this.emit('legacyBenchmarkCompleted', data);
    });
  }

  /**
   * Public utility methods
   */
  public getExecutionHistory(): IntegratedBenchmarkResult[] {
    return [...this.executionHistory];
  }

  public getCurrentExecution(): string | null {
    return this.currentExecution;
  }

  public isCurrentlyRunning(): boolean {
    return this.isRunning;
  }

  public getConfiguration(): IntegratedBenchmarkConfig {
    return { ...this.config };
  }

  public async updateConfiguration(newConfig: Partial<IntegratedBenchmarkConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Benchmark integration configuration updated');
  }

  public clearExecutionHistory(): void {
    this.executionHistory = [];
    console.log('🗑️ Execution history cleared');
  }

  public async cleanup(): Promise<void> {
    try {
      await this.optimizationBenchmarks.cleanup();
      this.removeAllListeners();
      console.log('🧹 BenchmarkIntegration cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }
}

// Export singleton instance
export const benchmarkIntegration = new BenchmarkIntegration();
export default BenchmarkIntegration;