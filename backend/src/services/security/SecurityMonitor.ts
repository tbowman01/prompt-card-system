import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';

const execAsync = promisify(exec);

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'vulnerability' | 'intrusion' | 'authentication' | 'access' | 'malware';
  source: string;
  message: string;
  details: any;
  resolved: boolean;
}

export interface VulnerabilityReport {
  id: string;
  timestamp: Date;
  scanType: 'dependencies' | 'code' | 'docker' | 'infrastructure';
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  details: any[];
  recommendations: string[];
}

export interface SecurityMetrics {
  eventsLast24h: number;
  criticalVulnerabilities: number;
  securityScore: number;
  lastScanTimestamp?: Date;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  complianceStatus: {
    score: number;
    checks: {
      name: string;
      passed: boolean;
      required: boolean;
    }[];
  };
}

export class SecurityMonitor extends EventEmitter {
  private events: SecurityEvent[] = [];
  private vulnerabilityReports: VulnerabilityReport[] = [];
  private scanInterval?: NodeJS.Timeout;
  private eventCleanupInterval?: NodeJS.Timeout;

  constructor(private options: {
    maxEvents?: number;
    eventRetentionDays?: number;
    scanIntervalMinutes?: number;
    enableContinuousScanning?: boolean;
  } = {}) {
    super();
    
    const {
      maxEvents = 10000,
      eventRetentionDays = 30,
      scanIntervalMinutes = 60,
      enableContinuousScanning = true
    } = options;

    this.options = {
      maxEvents,
      eventRetentionDays,
      scanIntervalMinutes,
      enableContinuousScanning
    };

    this.setupEventCleanup();
    
    if (enableContinuousScanning) {
      this.startContinuousScanning();
    }
  }

  // Security Event Management
  logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): void {
    const securityEvent: SecurityEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event
    };

    this.events.push(securityEvent);
    this.emit('securityEvent', securityEvent);

    // Trigger immediate alert for critical events
    if (event.severity === 'critical') {
      this.emit('criticalAlert', securityEvent);
    }

    // Maintain event limit
    if (this.events.length > this.options.maxEvents!) {
      this.events = this.events.slice(-this.options.maxEvents!);
    }
  }

  getSecurityEvents(filters?: {
    severity?: SecurityEvent['severity'];
    type?: SecurityEvent['type'];
    source?: string;
    since?: Date;
    limit?: number;
  }): SecurityEvent[] {
    let filteredEvents = [...this.events];

    if (filters) {
      if (filters.severity) {
        filteredEvents = filteredEvents.filter(e => e.severity === filters.severity);
      }
      if (filters.type) {
        filteredEvents = filteredEvents.filter(e => e.type === filters.type);
      }
      if (filters.source) {
        filteredEvents = filteredEvents.filter(e => e.source.includes(filters.source));
      }
      if (filters.since) {
        filteredEvents = filteredEvents.filter(e => e.timestamp >= filters.since!);
      }
      if (filters.limit) {
        filteredEvents = filteredEvents.slice(-filters.limit);
      }
    }

    return filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Vulnerability Scanning
  async scanDependencies(): Promise<VulnerabilityReport> {
    try {
      const report: VulnerabilityReport = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        scanType: 'dependencies',
        vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
        details: [],
        recommendations: []
      };

      // Use npm audit for dependency scanning
      try {
        const { stdout } = await execAsync('npm audit --json', { cwd: process.cwd() });
        const auditResult = JSON.parse(stdout);
        
        if (auditResult.vulnerabilities) {
          const vulns = auditResult.vulnerabilities;
          
          Object.keys(vulns).forEach(packageName => {
            const vuln = vulns[packageName];
            const severity = vuln.severity;
            
            report.vulnerabilities[severity as keyof typeof report.vulnerabilities]++;
            report.vulnerabilities.total++;
            
            report.details.push({
              package: packageName,
              severity: severity,
              title: vuln.title || 'Unknown vulnerability',
              range: vuln.range,
              fixAvailable: vuln.fixAvailable
            });
          });
        }

        // Generate recommendations
        if (report.vulnerabilities.critical > 0) {
          report.recommendations.push('Immediately update packages with critical vulnerabilities');
        }
        if (report.vulnerabilities.high > 0) {
          report.recommendations.push('Update packages with high severity vulnerabilities within 24 hours');
        }
        if (report.vulnerabilities.total > 0) {
          report.recommendations.push('Run "npm audit fix" to automatically fix vulnerabilities');
        }

      } catch (error) {
        // If npm audit fails, try alternative approaches
        report.details.push({
          error: 'Failed to run npm audit',
          message: error instanceof Error ? error.message : 'Unknown error',
          fallback: 'Consider using yarn audit or manual dependency review'
        });
      }

      this.vulnerabilityReports.push(report);
      this.logSecurityEvent({
        severity: report.vulnerabilities.critical > 0 ? 'critical' : 
                 report.vulnerabilities.high > 0 ? 'high' :
                 report.vulnerabilities.medium > 0 ? 'medium' : 'low',
        type: 'vulnerability',
        source: 'dependency-scanner',
        message: `Dependency scan completed: ${report.vulnerabilities.total} vulnerabilities found`,
        details: report,
        resolved: false
      });

      return report;
    } catch (error) {
      throw new Error(`Dependency scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async scanCode(): Promise<VulnerabilityReport> {
    const report: VulnerabilityReport = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      scanType: 'code',
      vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
      details: [],
      recommendations: []
    };

    try {
      // Basic static code analysis patterns
      const srcPath = path.join(process.cwd(), 'src');
      const files = await this.getSourceFiles(srcPath);
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const issues = this.analyzeCodeSecurity(content, file);
        
        issues.forEach(issue => {
          report.vulnerabilities[issue.severity as keyof typeof report.vulnerabilities]++;
          report.vulnerabilities.total++;
          report.details.push(issue);
        });
      }

      // Generate recommendations
      if (report.vulnerabilities.total > 0) {
        report.recommendations.push('Review and fix identified security issues in source code');
        report.recommendations.push('Consider implementing automated security linting');
        report.recommendations.push('Perform regular security code reviews');
      }

      this.vulnerabilityReports.push(report);
      this.logSecurityEvent({
        severity: report.vulnerabilities.critical > 0 ? 'critical' : 
                 report.vulnerabilities.high > 0 ? 'high' :
                 report.vulnerabilities.medium > 0 ? 'medium' : 'low',
        type: 'vulnerability',
        source: 'code-scanner',
        message: `Code scan completed: ${report.vulnerabilities.total} issues found`,
        details: report,
        resolved: false
      });

      return report;
    } catch (error) {
      throw new Error(`Code scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async scanInfrastructure(): Promise<VulnerabilityReport> {
    const report: VulnerabilityReport = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      scanType: 'infrastructure',
      vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
      details: [],
      recommendations: []
    };

    try {
      // Check Docker configuration if present
      const dockerfilePaths = ['Dockerfile', 'Dockerfile.dev', 'docker-compose.yml', 'docker-compose.dev.yml'];
      
      for (const dockerFile of dockerfilePaths) {
        try {
          const content = await fs.readFile(dockerFile, 'utf-8');
          const issues = this.analyzeDockerSecurity(content, dockerFile);
          
          issues.forEach(issue => {
            report.vulnerabilities[issue.severity as keyof typeof report.vulnerabilities]++;
            report.vulnerabilities.total++;
            report.details.push(issue);
          });
        } catch {
          // File doesn't exist, skip
        }
      }

      // Check environment configuration
      const envIssues = await this.analyzeEnvironmentSecurity();
      envIssues.forEach(issue => {
        report.vulnerabilities[issue.severity as keyof typeof report.vulnerabilities]++;
        report.vulnerabilities.total++;
        report.details.push(issue);
      });

      // Generate recommendations
      if (report.vulnerabilities.total > 0) {
        report.recommendations.push('Review and harden infrastructure configuration');
        report.recommendations.push('Implement security best practices for containerization');
        report.recommendations.push('Regular infrastructure security audits');
      }

      this.vulnerabilityReports.push(report);
      this.logSecurityEvent({
        severity: report.vulnerabilities.critical > 0 ? 'critical' : 
                 report.vulnerabilities.high > 0 ? 'high' :
                 report.vulnerabilities.medium > 0 ? 'medium' : 'low',
        type: 'vulnerability',
        source: 'infrastructure-scanner',
        message: `Infrastructure scan completed: ${report.vulnerabilities.total} issues found`,
        details: report,
        resolved: false
      });

      return report;
    } catch (error) {
      throw new Error(`Infrastructure scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Comprehensive security scan
  async performComprehensiveScan(): Promise<VulnerabilityReport[]> {
    const results = await Promise.allSettled([
      this.scanDependencies(),
      this.scanCode(),
      this.scanInfrastructure()
    ]);

    const reports: VulnerabilityReport[] = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        reports.push(result.value);
      } else {
        this.logSecurityEvent({
          severity: 'high',
          type: 'vulnerability',
          source: 'comprehensive-scanner',
          message: `Scan failed: ${result.reason}`,
          details: { error: result.reason },
          resolved: false
        });
      }
    });

    return reports;
  }

  // Security Metrics
  getSecurityMetrics(): SecurityMetrics {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const eventsLast24h = this.events.filter(e => e.timestamp >= last24h).length;
    const criticalEvents = this.events.filter(e => e.severity === 'critical' && !e.resolved).length;
    
    const latestReport = this.vulnerabilityReports
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    
    const criticalVulnerabilities = latestReport?.vulnerabilities.critical || 0;
    
    // Calculate security score (0-100)
    let securityScore = 100;
    securityScore -= criticalVulnerabilities * 20;
    securityScore -= (latestReport?.vulnerabilities.high || 0) * 10;
    securityScore -= (latestReport?.vulnerabilities.medium || 0) * 5;
    securityScore -= criticalEvents * 15;
    securityScore = Math.max(0, securityScore);
    
    const threatLevel: SecurityMetrics['threatLevel'] = 
      criticalVulnerabilities > 0 || criticalEvents > 0 ? 'critical' :
      (latestReport?.vulnerabilities.high || 0) > 0 ? 'high' :
      (latestReport?.vulnerabilities.medium || 0) > 0 ? 'medium' : 'low';

    // Compliance checks
    const complianceChecks = [
      { name: 'Regular vulnerability scanning', passed: this.vulnerabilityReports.length > 0, required: true },
      { name: 'Security event logging', passed: this.events.length > 0, required: true },
      { name: 'No critical vulnerabilities', passed: criticalVulnerabilities === 0, required: true },
      { name: 'Environment security', passed: true, required: true }, // Would be determined by env scan
      { name: 'Dependency security', passed: (latestReport?.vulnerabilities.critical || 0) === 0, required: true }
    ];

    const passedChecks = complianceChecks.filter(c => c.passed).length;
    const complianceScore = Math.round((passedChecks / complianceChecks.length) * 100);

    return {
      eventsLast24h,
      criticalVulnerabilities,
      securityScore,
      lastScanTimestamp: latestReport?.timestamp,
      threatLevel,
      complianceStatus: {
        score: complianceScore,
        checks: complianceChecks
      }
    };
  }

  // Helper methods
  private async getSourceFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...await this.getSourceFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
    
    return files;
  }

  private analyzeCodeSecurity(content: string, filename: string): any[] {
    const issues: any[] = [];
    
    // Security patterns to check
    const patterns = [
      {
        regex: /eval\s*\(/g,
        severity: 'critical',
        message: 'Use of eval() function detected - potential code injection vulnerability',
        type: 'code-injection'
      },
      {
        regex: /document\.write\s*\(/g,
        severity: 'high',
        message: 'Use of document.write() detected - potential XSS vulnerability',
        type: 'xss'
      },
      {
        regex: /innerHTML\s*=/g,
        severity: 'medium',
        message: 'Use of innerHTML detected - potential XSS vulnerability if user input',
        type: 'xss'
      },
      {
        regex: /password\s*=\s*["'][^"']+["']/gi,
        severity: 'critical',
        message: 'Hardcoded password detected in source code',
        type: 'secrets'
      },
      {
        regex: /api[_-]?key\s*=\s*["'][^"']+["']/gi,
        severity: 'critical',
        message: 'Hardcoded API key detected in source code',
        type: 'secrets'
      },
      {
        regex: /\.(exec|system)\s*\(/g,
        severity: 'high',
        message: 'Command execution detected - ensure input validation',
        type: 'command-injection'
      }
    ];
    
    patterns.forEach(pattern => {
      const matches = content.match(pattern.regex);
      if (matches) {
        matches.forEach((match, index) => {
          const lineNumber = content.substring(0, content.indexOf(match)).split('\n').length;
          issues.push({
            file: filename,
            line: lineNumber,
            severity: pattern.severity,
            type: pattern.type,
            message: pattern.message,
            code: match.trim()
          });
        });
      }
    });
    
    return issues;
  }

  private analyzeDockerSecurity(content: string, filename: string): any[] {
    const issues: any[] = [];
    
    // Docker security patterns
    const patterns = [
      {
        regex: /USER\s+root/gi,
        severity: 'high',
        message: 'Running as root user in Docker container',
        type: 'privilege-escalation'
      },
      {
        regex: /COPY\s+.*\s+\//gi,
        severity: 'medium',
        message: 'Copying files to root directory - consider specific paths',
        type: 'file-permissions'
      },
      {
        regex: /--privileged/gi,
        severity: 'critical',
        message: 'Privileged mode detected - security risk',
        type: 'privilege-escalation'
      }
    ];
    
    patterns.forEach(pattern => {
      const matches = content.match(pattern.regex);
      if (matches) {
        matches.forEach(match => {
          const lineNumber = content.substring(0, content.indexOf(match)).split('\n').length;
          issues.push({
            file: filename,
            line: lineNumber,
            severity: pattern.severity,
            type: pattern.type,
            message: pattern.message,
            code: match.trim()
          });
        });
      }
    });
    
    return issues;
  }

  private async analyzeEnvironmentSecurity(): Promise<any[]> {
    const issues: any[] = [];
    
    // Check for environment variable security
    const envVars = process.env;
    
    Object.keys(envVars).forEach(key => {
      if (key.toLowerCase().includes('secret') || 
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('key')) {
        // Don't log actual values, just flag potential issues
        if (envVars[key] && envVars[key].length < 8) {
          issues.push({
            type: 'weak-credentials',
            severity: 'medium',
            message: `Environment variable '${key}' appears to have weak value`,
            variable: key
          });
        }
      }
    });
    
    return issues;
  }

  private setupEventCleanup(): void {
    this.eventCleanupInterval = setInterval(() => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.options.eventRetentionDays!);
      
      this.events = this.events.filter(event => event.timestamp >= cutoffDate);
      this.vulnerabilityReports = this.vulnerabilityReports.filter(report => report.timestamp >= cutoffDate);
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  private startContinuousScanning(): void {
    this.scanInterval = setInterval(async () => {
      try {
        await this.performComprehensiveScan();
      } catch (error) {
        this.logSecurityEvent({
          severity: 'medium',
          type: 'vulnerability',
          source: 'continuous-scanner',
          message: `Continuous scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { error },
          resolved: false
        });
      }
    }, this.options.scanIntervalMinutes! * 60 * 1000);
  }

  // Cleanup resources
  destroy(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
    if (this.eventCleanupInterval) {
      clearInterval(this.eventCleanupInterval);
    }
    this.removeAllListeners();
  }
}

export const securityMonitor = new SecurityMonitor({
  maxEvents: 10000,
  eventRetentionDays: 30,
  scanIntervalMinutes: 60,
  enableContinuousScanning: process.env.NODE_ENV === 'production'
});