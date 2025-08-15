import { Octokit } from '@octokit/rest';
import { SimilarityScorer, SimilarityResult } from './SimilarityScorer';
import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';

export interface DuplicateManagementConfig {
  owner: string;
  repo: string;
  githubToken: string;
  similarityThreshold?: number;
  autoClose?: boolean;
  dryRun?: boolean;
  closeMessage?: string;
  duplicateLabel?: string;
  excludeLabels?: string[];
  includeOnlyLabels?: string[];
  maxDaysOld?: number;
  requireManualReview?: boolean;
  reviewers?: string[];
  notifyOnClose?: boolean;
  batchSize?: number;
}

export interface DuplicateGroup {
  primary: {
    number: number;
    title: string;
    url: string;
    created_at: string;
    author: string;
  };
  duplicates: Array<{
    number: number;
    title: string;
    url: string;
    similarity: SimilarityResult;
    created_at: string;
    author: string;
  }>;
  action?: 'closed' | 'labeled' | 'commented' | 'skipped';
  reason?: string;
}

export interface DuplicateReport {
  timestamp: string;
  repository: string;
  totalIssuesAnalyzed: number;
  duplicateGroups: DuplicateGroup[];
  totalDuplicatesFound: number;
  totalDuplicatesClosed: number;
  errors: any[];
  executionTime: number;
}

export class DuplicateManager extends EventEmitter {
  private octokit: Octokit;
  private config: Required<DuplicateManagementConfig>;
  private scorer: SimilarityScorer;
  private logger: any;
  private processedIssues: Set<number> = new Set();

  constructor(config: DuplicateManagementConfig) {
    super();
    
    this.config = {
      similarityThreshold: 0.85,
      autoClose: false,
      dryRun: true,
      closeMessage: 'This issue appears to be a duplicate of #{primary}.\n\n' +
                   'Closing this issue to consolidate discussion. ' +
                   'Please continue the conversation in the original issue.',
      duplicateLabel: 'duplicate',
      excludeLabels: [],
      includeOnlyLabels: [],
      maxDaysOld: 90,
      requireManualReview: true,
      reviewers: [],
      notifyOnClose: true,
      batchSize: 100,
      ...config
    };

    this.octokit = new Octokit({
      auth: config.githubToken
    });

    this.scorer = new SimilarityScorer({
      algorithm: 'combined',
      weights: {
        title: 0.35,
        body: 0.35,
        labels: 0.15,
        metadata: 0.15
      },
      removeStopWords: true,
      stemming: true
    });

    this.logger = createLogger('DuplicateManager');
  }

  public async analyzeDuplicates(): Promise<DuplicateReport> {
    const startTime = Date.now();
    const report: DuplicateReport = {
      timestamp: new Date().toISOString(),
      repository: `${this.config.owner}/${this.config.repo}`,
      totalIssuesAnalyzed: 0,
      duplicateGroups: [],
      totalDuplicatesFound: 0,
      totalDuplicatesClosed: 0,
      errors: [],
      executionTime: 0
    };

    try {
      this.logger.info('Starting duplicate analysis', {
        repository: report.repository,
        threshold: this.config.similarityThreshold,
        dryRun: this.config.dryRun
      });

      // Fetch issues
      const issues = await this.fetchIssues();
      report.totalIssuesAnalyzed = issues.length;

      // Find duplicates
      const duplicateGroups = await this.findDuplicateGroups(issues);
      
      // Process each group
      for (const group of duplicateGroups) {
        try {
          const processedGroup = await this.processDuplicateGroup(group);
          report.duplicateGroups.push(processedGroup);
          
          if (processedGroup.action === 'closed') {
            report.totalDuplicatesClosed += processedGroup.duplicates.length;
          }
          report.totalDuplicatesFound += processedGroup.duplicates.length;
        } catch (error) {
          this.logger.error('Error processing duplicate group', error);
          report.errors.push({
            group: group.primary.number,
            error: (error as Error).message
          });
        }
      }

      report.executionTime = Date.now() - startTime;
      
      this.emit('analysis-complete', report);
      return report;
    } catch (error) {
      this.logger.error('Fatal error during duplicate analysis', error);
      report.errors.push({
        fatal: true,
        error: (error as Error).message
      });
      report.executionTime = Date.now() - startTime;
      return report;
    }
  }

  private async fetchIssues(): Promise<any[]> {
    const allIssues: any[] = [];
    let page = 1;
    
    while (true) {
      const { data } = await this.octokit.issues.listForRepo({
        owner: this.config.owner,
        repo: this.config.repo,
        state: 'open',
        per_page: this.config.batchSize,
        page,
        sort: 'created',
        direction: 'desc'
      });

      if (data.length === 0) break;

      const filteredIssues = data.filter(issue => {
        // Skip pull requests
        if (issue.pull_request) return false;

        // Check age
        if (this.config.maxDaysOld) {
          const ageInDays = (Date.now() - new Date(issue.created_at).getTime()) / 
                           (1000 * 60 * 60 * 24);
          if (ageInDays > this.config.maxDaysOld) return false;
        }

        // Check labels
        const labels = issue.labels.map((l: any) => 
          typeof l === 'string' ? l : l.name
        );

        // Skip if has exclude labels
        if (this.config.excludeLabels.some(label => labels.includes(label))) {
          return false;
        }

        // Skip if doesn't have required labels
        if (this.config.includeOnlyLabels.length > 0 &&
            !this.config.includeOnlyLabels.some(label => labels.includes(label))) {
          return false;
        }

        return true;
      });

      allIssues.push(...filteredIssues);
      
      if (data.length < this.config.batchSize) break;
      page++;
    }

    this.logger.info(`Fetched ${allIssues.length} issues for analysis`);
    return allIssues;
  }

  private async findDuplicateGroups(issues: any[]): Promise<DuplicateGroup[]> {
    const groups: DuplicateGroup[] = [];
    this.processedIssues.clear();

    for (let i = 0; i < issues.length; i++) {
      if (this.processedIssues.has(issues[i].number)) continue;

      const duplicates: any[] = [];
      
      for (let j = i + 1; j < issues.length; j++) {
        if (this.processedIssues.has(issues[j].number)) continue;

        const similarity = this.scorer.calculateSimilarity(
          issues[i], 
          issues[j]
        );

        if (similarity.overall >= this.config.similarityThreshold) {
          duplicates.push({
            number: issues[j].number,
            title: issues[j].title,
            url: issues[j].html_url,
            similarity,
            created_at: issues[j].created_at,
            author: issues[j].user?.login || 'unknown'
          });
          this.processedIssues.add(issues[j].number);
        }
      }

      if (duplicates.length > 0) {
        groups.push({
          primary: {
            number: issues[i].number,
            title: issues[i].title,
            url: issues[i].html_url,
            created_at: issues[i].created_at,
            author: issues[i].user?.login || 'unknown'
          },
          duplicates
        });
        this.processedIssues.add(issues[i].number);
      }
    }

    this.logger.info(`Found ${groups.length} duplicate groups`);
    return groups;
  }

  private async processDuplicateGroup(
    group: DuplicateGroup
  ): Promise<DuplicateGroup> {
    // Sort duplicates by similarity score
    group.duplicates.sort((a, b) => 
      b.similarity.overall - a.similarity.overall
    );

    // Check if manual review is required
    if (this.config.requireManualReview && !this.config.dryRun) {
      await this.requestManualReview(group);
      group.action = 'commented';
      group.reason = 'Manual review requested';
      return group;
    }

    // Process based on configuration
    if (this.config.dryRun) {
      group.action = 'skipped';
      group.reason = 'Dry run mode';
      this.logger.info('Dry run - would process duplicate group', {
        primary: group.primary.number,
        duplicates: group.duplicates.map(d => d.number)
      });
    } else if (this.config.autoClose) {
      await this.closeDuplicates(group);
      group.action = 'closed';
      group.reason = 'Auto-closed as duplicate';
    } else {
      await this.labelDuplicates(group);
      group.action = 'labeled';
      group.reason = 'Labeled as duplicate for review';
    }

    return group;
  }

  private async closeDuplicates(group: DuplicateGroup): Promise<void> {
    for (const duplicate of group.duplicates) {
      try {
        // Add comment
        const commentBody = this.config.closeMessage
          .replace('{primary}', `#${group.primary.number}`)
          .replace('{primary_url}', group.primary.url)
          .replace('{similarity}', (duplicate.similarity.overall * 100).toFixed(1));

        await this.octokit.issues.createComment({
          owner: this.config.owner,
          repo: this.config.repo,
          issue_number: duplicate.number,
          body: commentBody + '\n\n' +
                `**Similarity Score:** ${(duplicate.similarity.overall * 100).toFixed(1)}%\n` +
                `- Title similarity: ${(duplicate.similarity.title * 100).toFixed(1)}%\n` +
                `- Body similarity: ${(duplicate.similarity.body * 100).toFixed(1)}%\n` +
                `- Label overlap: ${(duplicate.similarity.labels * 100).toFixed(1)}%`
        });

        // Add duplicate label
        if (this.config.duplicateLabel) {
          try {
            await this.octokit.issues.addLabels({
              owner: this.config.owner,
              repo: this.config.repo,
              issue_number: duplicate.number,
              labels: [this.config.duplicateLabel]
            });
          } catch (e) {
            // Label might not exist
            this.logger.warn(`Failed to add label: ${e}`);
          }
        }

        // Close the issue
        await this.octokit.issues.update({
          owner: this.config.owner,
          repo: this.config.repo,
          issue_number: duplicate.number,
          state: 'closed',
          state_reason: 'not_planned'
        });

        // Notify if configured
        if (this.config.notifyOnClose) {
          await this.notifyClosedDuplicate(duplicate, group.primary);
        }

        this.logger.info(`Closed duplicate issue #${duplicate.number}`);
      } catch (error) {
        this.logger.error(`Failed to close issue #${duplicate.number}`, error);
        throw error;
      }
    }
  }

  private async labelDuplicates(group: DuplicateGroup): Promise<void> {
    for (const duplicate of group.duplicates) {
      try {
        // Add duplicate label
        if (this.config.duplicateLabel) {
          await this.octokit.issues.addLabels({
            owner: this.config.owner,
            repo: this.config.repo,
            issue_number: duplicate.number,
            labels: [this.config.duplicateLabel]
          });
        }

        // Add comment about potential duplicate
        await this.octokit.issues.createComment({
          owner: this.config.owner,
          repo: this.config.repo,
          issue_number: duplicate.number,
          body: `⚠️ **Potential Duplicate Detected**\n\n` +
                `This issue may be a duplicate of #${group.primary.number}.\n` +
                `**Similarity Score:** ${(duplicate.similarity.overall * 100).toFixed(1)}%\n\n` +
                `Please review and consider closing if this is indeed a duplicate.`
        });

        this.logger.info(`Labeled potential duplicate #${duplicate.number}`);
      } catch (error) {
        this.logger.error(`Failed to label issue #${duplicate.number}`, error);
        throw error;
      }
    }
  }

  private async requestManualReview(group: DuplicateGroup): Promise<void> {
    // Create a review issue or comment
    const reviewBody = `## 🔍 Duplicate Issues Detected - Manual Review Required\n\n` +
      `**Primary Issue:** #${group.primary.number} - ${group.primary.title}\n` +
      `**URL:** ${group.primary.url}\n\n` +
      `### Potential Duplicates:\n` +
      group.duplicates.map(d => 
        `- #${d.number} - ${d.title} (${(d.similarity.overall * 100).toFixed(1)}% similarity)\n` +
        `  - URL: ${d.url}\n` +
        `  - Created: ${d.created_at}\n` +
        `  - Author: @${d.author}`
      ).join('\n\n') +
      `\n\n### Review Actions:\n` +
      `- [ ] Confirm these are duplicates\n` +
      `- [ ] Close duplicate issues\n` +
      `- [ ] Merge relevant information\n` +
      `- [ ] Update labels\n\n` +
      `cc: ${this.config.reviewers.map(r => `@${r}`).join(' ')}`;

    // Post to primary issue
    await this.octokit.issues.createComment({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: group.primary.number,
      body: reviewBody
    });
  }

  private async notifyClosedDuplicate(
    duplicate: any, 
    primary: any
  ): Promise<void> {
    // Notification logic can be extended here
    this.emit('duplicate-closed', {
      duplicate,
      primary,
      timestamp: new Date().toISOString()
    });
  }

  public async generateReport(report: DuplicateReport): Promise<string> {
    const markdown = `# Duplicate Issue Analysis Report

**Repository:** ${report.repository}  
**Date:** ${new Date(report.timestamp).toLocaleString()}  
**Execution Time:** ${(report.executionTime / 1000).toFixed(2)}s  

## Summary
- **Total Issues Analyzed:** ${report.totalIssuesAnalyzed}
- **Duplicate Groups Found:** ${report.duplicateGroups.length}
- **Total Duplicates:** ${report.totalDuplicatesFound}
- **Duplicates Closed:** ${report.totalDuplicatesClosed}
- **Errors:** ${report.errors.length}

## Duplicate Groups

${report.duplicateGroups.map(group => `
### Group: #${group.primary.number}
**Primary Issue:** [${group.primary.title}](${group.primary.url})  
**Action:** ${group.action || 'none'}  
**Reason:** ${group.reason || 'N/A'}  

#### Duplicates:
${group.duplicates.map(d => `
- [#${d.number}](${d.url}) - ${d.title}
  - Similarity: ${(d.similarity.overall * 100).toFixed(1)}%
  - Created: ${new Date(d.created_at).toLocaleDateString()}
  - Author: ${d.author}
`).join('')}
`).join('\n---\n')}

${report.errors.length > 0 ? `
## Errors
${report.errors.map(e => `- ${JSON.stringify(e)}`).join('\n')}
` : ''}
`;

    return markdown;
  }
}