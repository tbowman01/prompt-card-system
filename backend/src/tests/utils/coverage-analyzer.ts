import fs from 'fs';
import path from 'path';

export interface CoverageReport {
  total: CoverageMetrics;
  byDirectory: Record<string, CoverageMetrics>;
  byFile: Record<string, CoverageMetrics>;
  uncoveredLines: Array<{
    file: string;
    lines: number[];
  }>;
  recommendations: string[];
}

export interface CoverageMetrics {
  lines: { covered: number; total: number; percentage: number };
  functions: { covered: number; total: number; percentage: number };
  branches: { covered: number; total: number; percentage: number };
  statements: { covered: number; total: number; percentage: number };
}

export class CoverageAnalyzer {
  private srcDir: string;
  private coverageDir: string;

  constructor(srcDir: string = 'src', coverageDir: string = 'coverage') {
    this.srcDir = srcDir;
    this.coverageDir = coverageDir;
  }

  async analyzeCoverage(): Promise<CoverageReport> {
    const coverageSummary = this.loadCoverageSummary();
    const sourceFiles = this.getSourceFiles();
    
    return {
      total: this.calculateTotalMetrics(coverageSummary),
      byDirectory: this.calculateDirectoryMetrics(coverageSummary),
      byFile: this.calculateFileMetrics(coverageSummary),
      uncoveredLines: this.findUncoveredLines(coverageSummary),
      recommendations: this.generateRecommendations(coverageSummary, sourceFiles)
    };
  }

  private loadCoverageSummary(): any {
    const summaryPath = path.join(this.coverageDir, 'coverage-summary.json');
    
    if (!fs.existsSync(summaryPath)) {
      throw new Error(`Coverage summary not found at ${summaryPath}. Run tests with coverage first.`);
    }
    
    return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  }

  private getSourceFiles(): string[] {
    return this.walkDirectory(this.srcDir)
      .filter(file => file.endsWith('.ts') && !file.includes('.test.') && !file.includes('.spec.'))
      .filter(file => !file.includes('/tests/'));
  }

  private walkDirectory(dir: string): string[] {
    const files: string[] = [];
    
    try {
      const entries = fs.readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && entry !== 'node_modules' && entry !== '.git') {
          files.push(...this.walkDirectory(fullPath));
        } else if (stat.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dir}:`, error);
    }
    
    return files;
  }

  private calculateTotalMetrics(summary: any): CoverageMetrics {
    const total = summary.total;
    
    return {
      lines: {
        covered: total.lines.covered,
        total: total.lines.total,
        percentage: total.lines.pct
      },
      functions: {
        covered: total.functions.covered,
        total: total.functions.total,
        percentage: total.functions.pct
      },
      branches: {
        covered: total.branches.covered,
        total: total.branches.total,
        percentage: total.branches.pct
      },
      statements: {
        covered: total.statements.covered,
        total: total.statements.total,
        percentage: total.statements.pct
      }
    };
  }

  private calculateDirectoryMetrics(summary: any): Record<string, CoverageMetrics> {
    const directoryMetrics: Record<string, CoverageMetrics> = {};
    
    for (const [filePath, metrics] of Object.entries(summary)) {
      if (filePath === 'total') continue;
      
      const directory = path.dirname(filePath);
      
      if (!directoryMetrics[directory]) {
        directoryMetrics[directory] = {
          lines: { covered: 0, total: 0, percentage: 0 },
          functions: { covered: 0, total: 0, percentage: 0 },
          branches: { covered: 0, total: 0, percentage: 0 },
          statements: { covered: 0, total: 0, percentage: 0 }
        };
      }
      
      const fileMetrics = metrics as any;
      this.addToMetrics(directoryMetrics[directory], fileMetrics);
    }
    
    // Calculate percentages
    for (const metrics of Object.values(directoryMetrics)) {
      this.calculatePercentages(metrics);
    }
    
    return directoryMetrics;
  }

  private calculateFileMetrics(summary: any): Record<string, CoverageMetrics> {
    const fileMetrics: Record<string, CoverageMetrics> = {};
    
    for (const [filePath, metrics] of Object.entries(summary)) {
      if (filePath === 'total') continue;
      
      const fileMetrics_ = metrics as any;
      fileMetrics[filePath] = {
        lines: {
          covered: fileMetrics_.lines.covered,
          total: fileMetrics_.lines.total,
          percentage: fileMetrics_.lines.pct
        },
        functions: {
          covered: fileMetrics_.functions.covered,
          total: fileMetrics_.functions.total,
          percentage: fileMetrics_.functions.pct
        },
        branches: {
          covered: fileMetrics_.branches.covered,
          total: fileMetrics_.branches.total,
          percentage: fileMetrics_.branches.pct
        },
        statements: {
          covered: fileMetrics_.statements.covered,
          total: fileMetrics_.statements.total,
          percentage: fileMetrics_.statements.pct
        }
      };
    }
    
    return fileMetrics;
  }

  private findUncoveredLines(summary: any): Array<{ file: string; lines: number[] }> {
    const uncoveredLines: Array<{ file: string; lines: number[] }> = [];
    
    // This would require parsing the lcov file for detailed line information
    // For now, identify files with low coverage
    for (const [filePath, metrics] of Object.entries(summary)) {
      if (filePath === 'total') continue;
      
      const fileMetrics = metrics as any;
      if (fileMetrics.lines.pct < 80) {
        uncoveredLines.push({
          file: filePath,
          lines: [] // Would be populated from lcov data
        });
      }
    }
    
    return uncoveredLines;
  }

  private generateRecommendations(summary: any, sourceFiles: string[]): string[] {
    const recommendations: string[] = [];
    const total = summary.total;
    
    // Overall coverage recommendations
    if (total.lines.pct < 85) {
      recommendations.push(`Increase overall line coverage from ${total.lines.pct}% to 85%`);
    }
    
    if (total.functions.pct < 80) {
      recommendations.push(`Increase function coverage from ${total.functions.pct}% to 80%`);
    }
    
    if (total.branches.pct < 80) {
      recommendations.push(`Increase branch coverage from ${total.branches.pct}% to 80%`);
    }
    
    // File-specific recommendations
    const lowCoverageFiles = [];
    for (const [filePath, metrics] of Object.entries(summary)) {
      if (filePath === 'total') continue;
      
      const fileMetrics = metrics as any;
      if (fileMetrics.lines.pct < 70) {
        lowCoverageFiles.push({
          file: filePath,
          coverage: fileMetrics.lines.pct
        });
      }
    }
    
    if (lowCoverageFiles.length > 0) {
      recommendations.push(`Focus on files with low coverage: ${lowCoverageFiles.map(f => `${f.file} (${f.coverage}%)`).join(', ')}`);
    }
    
    // Identify untested files
    const testedFiles = new Set(Object.keys(summary).filter(f => f !== 'total'));
    const untestedFiles = sourceFiles.filter(file => !testedFiles.has(file));
    
    if (untestedFiles.length > 0) {
      recommendations.push(`Add tests for untested files: ${untestedFiles.slice(0, 5).join(', ')}${untestedFiles.length > 5 ? ' and others' : ''}`);
    }
    
    // Specific improvement suggestions
    const criticalPaths = [
      'src/services/',
      'src/database/',
      'src/middleware/',
      'src/routes/'
    ];
    
    for (const criticalPath of criticalPaths) {
      const pathFiles = Object.keys(summary).filter(f => f.startsWith(criticalPath));
      const avgCoverage = pathFiles.reduce((sum, file) => {
        return sum + (summary[file]?.lines?.pct || 0);
      }, 0) / Math.max(pathFiles.length, 1);
      
      if (avgCoverage < 90 && pathFiles.length > 0) {
        recommendations.push(`Increase coverage for critical path ${criticalPath} (current: ${avgCoverage.toFixed(1)}%)`);
      }
    }
    
    return recommendations;
  }

  private addToMetrics(target: CoverageMetrics, source: any): void {
    target.lines.covered += source.lines.covered;
    target.lines.total += source.lines.total;
    target.functions.covered += source.functions.covered;
    target.functions.total += source.functions.total;
    target.branches.covered += source.branches.covered;
    target.branches.total += source.branches.total;
    target.statements.covered += source.statements.covered;
    target.statements.total += source.statements.total;
  }

  private calculatePercentages(metrics: CoverageMetrics): void {
    metrics.lines.percentage = metrics.lines.total > 0 ? (metrics.lines.covered / metrics.lines.total) * 100 : 0;
    metrics.functions.percentage = metrics.functions.total > 0 ? (metrics.functions.covered / metrics.functions.total) * 100 : 0;
    metrics.branches.percentage = metrics.branches.total > 0 ? (metrics.branches.covered / metrics.branches.total) * 100 : 0;
    metrics.statements.percentage = metrics.statements.total > 0 ? (metrics.statements.covered / metrics.statements.total) * 100 : 0;
  }

  formatReport(report: CoverageReport): string {
    const lines = [
      '📊 Coverage Analysis Report',
      '=' .repeat(50),
      '',
      '📈 Overall Coverage:',
      `  Lines: ${report.total.lines.percentage.toFixed(1)}% (${report.total.lines.covered}/${report.total.lines.total})`,
      `  Functions: ${report.total.functions.percentage.toFixed(1)}% (${report.total.functions.covered}/${report.total.functions.total})`,
      `  Branches: ${report.total.branches.percentage.toFixed(1)}% (${report.total.branches.covered}/${report.total.branches.total})`,
      `  Statements: ${report.total.statements.percentage.toFixed(1)}% (${report.total.statements.covered}/${report.total.statements.total})`,
      ''
    ];
    
    if (Object.keys(report.byDirectory).length > 0) {
      lines.push('📁 Coverage by Directory:');
      for (const [dir, metrics] of Object.entries(report.byDirectory)) {
        lines.push(`  ${dir}: ${metrics.lines.percentage.toFixed(1)}% lines, ${metrics.functions.percentage.toFixed(1)}% functions`);
      }
      lines.push('');
    }
    
    if (report.uncoveredLines.length > 0) {
      lines.push('🔍 Files needing attention:');
      report.uncoveredLines.slice(0, 10).forEach(item => {
        lines.push(`  ${item.file}`);
      });
      lines.push('');
    }
    
    if (report.recommendations.length > 0) {
      lines.push('💡 Recommendations:');
      report.recommendations.forEach(rec => {
        lines.push(`  • ${rec}`);
      });
    }
    
    return lines.join('\n');
  }
}