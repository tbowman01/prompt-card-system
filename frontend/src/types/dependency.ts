/**
 * Dependency Dashboard Types
 * Comprehensive type definitions for dependency management system
 */

export interface DependencyInfo {
  id: string;
  name: string;
  version: string;
  latestVersion?: string;
  type: DependencyType;
  location: DependencyLocation;
  description?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  size?: number;
  installationDate?: string;
  lastUpdated?: string;
  maintainers?: string[];
  downloadCount?: number;
  severity?: SeverityLevel;
}

export type DependencyType = 
  | 'production' 
  | 'development' 
  | 'peer' 
  | 'optional' 
  | 'bundled';

export type DependencyLocation = 
  | 'frontend' 
  | 'backend' 
  | 'root' 
  | 'docker' 
  | 'github-actions';

export type SeverityLevel = 'critical' | 'high' | 'moderate' | 'low' | 'info';

export interface VulnerabilityInfo {
  id: string;
  dependencyId: string;
  cveId?: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  cvssScore?: number;
  publishedDate: string;
  patchedVersions?: string[];
  recommendations: string[];
  exploitAvailable: boolean;
  references: string[];
}

export interface UpdateInfo {
  dependencyId: string;
  currentVersion: string;
  targetVersion: string;
  updateType: UpdateType;
  changelogUrl?: string;
  releaseDate?: string;
  breakingChanges: boolean;
  securityFix: boolean;
  size: number;
  requiredBy: string[];
  blockedBy: string[];
}

export type UpdateType = 'major' | 'minor' | 'patch' | 'prerelease';

export interface RiskAssessment {
  dependencyId: string;
  score: number; // 0-100
  factors: RiskFactor[];
  recommendation: RiskRecommendation;
  impactAnalysis: ImpactAnalysis;
  testRecommendations: string[];
}

export interface RiskFactor {
  type: string;
  description: string;
  weight: number;
  score: number;
}

export type RiskRecommendation = 'immediate' | 'scheduled' | 'monitor' | 'defer';

export interface ImpactAnalysis {
  breakingChanges: boolean;
  apiChanges: string[];
  dependentComponents: string[];
  testCoverage: number;
  rollbackComplexity: 'low' | 'medium' | 'high';
}

export interface LicenseInfo {
  spdxId: string;
  name: string;
  url?: string;
  category: LicenseCategory;
  permissions: string[];
  conditions: string[];
  limitations: string[];
  riskLevel: SeverityLevel;
}

export type LicenseCategory = 
  | 'permissive' 
  | 'copyleft' 
  | 'proprietary' 
  | 'public-domain' 
  | 'unknown';

export interface ComplianceCheck {
  dependencyId: string;
  licenseCompatible: boolean;
  organizationPolicy: PolicyViolation[];
  securityCompliant: boolean;
  lastChecked: string;
}

export interface PolicyViolation {
  type: string;
  severity: SeverityLevel;
  description: string;
  resolution: string;
}

export interface DependencyTreeNode {
  id: string;
  name: string;
  version: string;
  depth: number;
  children: DependencyTreeNode[];
  vulnerabilities: number;
  outdated: boolean;
  size: number;
  optional: boolean;
}

export interface UpdateApproval {
  id: string;
  dependencyId: string;
  requestedVersion: string;
  status: ApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  approver?: string;
  approvedAt?: string;
  comments: ApprovalComment[];
  testResults?: TestResult[];
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ApprovalComment {
  id: string;
  author: string;
  message: string;
  timestamp: string;
  type: 'comment' | 'approval' | 'rejection';
}

export interface TestResult {
  id: string;
  type: TestType;
  status: 'passed' | 'failed' | 'pending' | 'skipped';
  duration?: number;
  coverage?: number;
  details?: string;
  timestamp: string;
}

export type TestType = 'unit' | 'integration' | 'e2e' | 'security' | 'performance';

export interface DashboardMetrics {
  totalDependencies: number;
  outdatedDependencies: number;
  vulnerabilities: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
  licenseIssues: number;
  pendingUpdates: number;
  riskScore: number;
  lastScan: string;
  nextScheduledScan: string;
}

export interface RenovateConfig {
  enabled: boolean;
  schedule: string[];
  automerge: boolean;
  major: { automerge: boolean };
  minor: { automerge: boolean };
  patch: { automerge: boolean };
  prConcurrentLimit: number;
  prHourlyLimit: number;
  extends: string[];
  packageRules: PackageRule[];
}

export interface PackageRule {
  matchPackagePatterns?: string[];
  matchDatasources?: string[];
  automerge?: boolean;
  schedule?: string[];
  groupName?: string;
  labels?: string[];
  reviewers?: string[];
}

export interface ScanConfiguration {
  vulnerabilityScanning: boolean;
  licenseScanning: boolean;
  dependencyTracking: boolean;
  automatedUpdates: boolean;
  scanFrequency: string;
  excludePatterns: string[];
  includeDevDependencies: boolean;
  notificationChannels: NotificationChannel[];
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook' | 'github';
  enabled: boolean;
  configuration: Record<string, any>;
  events: NotificationEvent[];
}

export type NotificationEvent = 
  | 'vulnerability-found' 
  | 'update-available' 
  | 'license-issue' 
  | 'scan-completed'
  | 'approval-needed';

export interface DependencyFilter {
  type?: DependencyType[];
  location?: DependencyLocation[];
  hasVulnerabilities?: boolean;
  outdated?: boolean;
  licenseCategory?: LicenseCategory[];
  riskLevel?: SeverityLevel[];
  searchTerm?: string;
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}