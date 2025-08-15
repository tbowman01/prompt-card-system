import { BaseAgent } from '../core/BaseAgent';
import { Octokit } from '@octokit/rest';
import natural from 'natural';
import { EventEmitter } from 'events';

interface DuplicateConfig {
  repository: string;
  owner: string;
  similarityThreshold: number;
  autoClose: boolean;
  excludeLabels?: string[];
  includeOnlyLabels?: string[];
  maxDaysOld?: number;
  closeMessage?: string;
}

interface IssueSimilarity {
  issue1: number;
  issue2: number;
  similarity: number;
  titleSimilarity: number;
  bodySimilarity: number;
  labelOverlap: number;
}

interface DuplicateGroup {
  primary: number;
  duplicates: number[];
  similarities: IssueSimilarity[];
}

export class IssueDuplicateAgent extends BaseAgent {
  private octokit: Octokit;
  private config: DuplicateConfig;
  private tfidf: natural.TfIdf;
  private tokenizer: natural.WordTokenizer;

  constructor(config: DuplicateConfig, githubToken: string) {
    super('IssueDuplicateAgent', 'github-duplicate-detector');
    
    this.config = {
      similarityThreshold: 0.8,
      autoClose: false,
      closeMessage: 'This issue appears to be a duplicate of #{primary}. Closing to keep discussions consolidated.',
      ...config
    };

    this.octokit = new Octokit({
      auth: githubToken
    });

    this.tfidf = new natural.TfIdf();
    this.tokenizer = new natural.WordTokenizer();
  }

  async execute(): Promise<any> {
    try {
      this.logger.info('Starting duplicate issue detection', {
        repository: `${this.config.owner}/${this.config.repository}`,
        threshold: this.config.similarityThreshold
      });

      // Fetch all open issues
      const issues = await this.fetchOpenIssues();
      this.logger.info(`Found ${issues.length} open issues to analyze`);

      // Build TF-IDF model
      this.buildTfIdfModel(issues);

      // Find duplicates
      const duplicateGroups = this.findDuplicates(issues);
      
      // Process duplicates
      const results = await this.processDuplicates(duplicateGroups, issues);

      this.emit('duplicates-found', results);
      return results;
    } catch (error) {
      this.logger.error('Error detecting duplicates', error);
      throw error;
    }
  }

  private async fetchOpenIssues(): Promise<any[]> {
    const allIssues: any[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const { data } = await this.octokit.issues.listForRepo({
        owner: this.config.owner,
        repo: this.config.repository,
        state: 'open',
        per_page: perPage,
        page
      });

      if (data.length === 0) break;

      // Filter based on configuration
      const filteredIssues = data.filter(issue => {
        // Skip pull requests
        if (issue.pull_request) return false;

        // Check age if configured
        if (this.config.maxDaysOld) {
          const createdDate = new Date(issue.created_at);
          const daysOld = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysOld > this.config.maxDaysOld) return false;
        }

        // Check labels
        const labels = issue.labels.map((l: any) => 
          typeof l === 'string' ? l : l.name
        );

        if (this.config.excludeLabels?.some(label => labels.includes(label))) {
          return false;
        }

        if (this.config.includeOnlyLabels?.length > 0) {
          return this.config.includeOnlyLabels.some(label => labels.includes(label));
        }

        return true;
      });

      allIssues.push(...filteredIssues);
      
      if (data.length < perPage) break;
      page++;
    }

    return allIssues;
  }

  private buildTfIdfModel(issues: any[]): void {
    issues.forEach(issue => {
      const text = this.preprocessText(
        `${issue.title} ${issue.body || ''}`
      );
      this.tfidf.addDocument(text);
    });
  }

  private preprocessText(text: string): string {
    // Remove URLs
    text = text.replace(/https?:\/\/[^\s]+/g, '');
    
    // Remove code blocks
    text = text.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/`[^`]+`/g, '');
    
    // Remove HTML tags
    text = text.replace(/<[^>]*>/g, '');
    
    // Convert to lowercase and tokenize
    const tokens = this.tokenizer.tokenize(text.toLowerCase());
    
    // Remove stop words (basic implementation)
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are', 'was',
      'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'can', 'could'
    ]);
    
    return tokens
      ?.filter(token => !stopWords.has(token) && token.length > 2)
      .join(' ') || '';
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const tokens1 = new Set(this.tokenizer.tokenize(text1.toLowerCase()));
    const tokens2 = new Set(this.tokenizer.tokenize(text2.toLowerCase()));
    
    if (tokens1.size === 0 || tokens2.size === 0) return 0;
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    
    // Jaccard similarity
    const jaccard = intersection.size / union.size;
    
    // Cosine similarity using TF-IDF
    const cosine = this.calculateCosineSimilarity(text1, text2);
    
    // Weighted average
    return (jaccard * 0.3 + cosine * 0.7);
  }

  private calculateCosineSimilarity(text1: string, text2: string): number {
    const doc1 = this.tfidf.documents[0];
    const doc2 = this.tfidf.documents[1];
    
    if (!doc1 || !doc2) return 0;
    
    const terms = new Set([...Object.keys(doc1), ...Object.keys(doc2)]);
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    terms.forEach(term => {
      const val1 = doc1[term] || 0;
      const val2 = doc2[term] || 0;
      dotProduct += val1 * val2;
      magnitude1 += val1 * val1;
      magnitude2 += val2 * val2;
    });
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
  }

  private findDuplicates(issues: any[]): DuplicateGroup[] {
    const duplicateGroups: DuplicateGroup[] = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < issues.length; i++) {
      if (processed.has(issues[i].number)) continue;
      
      const group: DuplicateGroup = {
        primary: issues[i].number,
        duplicates: [],
        similarities: []
      };
      
      for (let j = i + 1; j < issues.length; j++) {
        if (processed.has(issues[j].number)) continue;
        
        const titleSim = this.calculateSimilarity(
          issues[i].title,
          issues[j].title
        );
        
        const bodySim = this.calculateSimilarity(
          issues[i].body || '',
          issues[j].body || ''
        );
        
        // Calculate label overlap
        const labels1 = new Set(issues[i].labels.map((l: any) => 
          typeof l === 'string' ? l : l.name
        ));
        const labels2 = new Set(issues[j].labels.map((l: any) => 
          typeof l === 'string' ? l : l.name
        ));
        
        const labelOverlap = labels1.size > 0 && labels2.size > 0
          ? [...labels1].filter(l => labels2.has(l)).length / 
            Math.max(labels1.size, labels2.size)
          : 0;
        
        // Combined similarity score
        const combinedSimilarity = (
          titleSim * 0.4 + 
          bodySim * 0.4 + 
          labelOverlap * 0.2
        );
        
        if (combinedSimilarity >= this.config.similarityThreshold) {
          group.duplicates.push(issues[j].number);
          group.similarities.push({
            issue1: issues[i].number,
            issue2: issues[j].number,
            similarity: combinedSimilarity,
            titleSimilarity: titleSim,
            bodySimilarity: bodySim,
            labelOverlap
          });
          processed.add(issues[j].number);
        }
      }
      
      if (group.duplicates.length > 0) {
        duplicateGroups.push(group);
        processed.add(issues[i].number);
      }
    }
    
    return duplicateGroups;
  }

  private async processDuplicates(
    groups: DuplicateGroup[], 
    issues: any[]
  ): Promise<any> {
    const results = {
      totalGroups: groups.length,
      totalDuplicates: groups.reduce((sum, g) => sum + g.duplicates.length, 0),
      processed: [] as any[],
      errors: [] as any[]
    };
    
    for (const group of groups) {
      const primaryIssue = issues.find(i => i.number === group.primary);
      
      for (const duplicateNum of group.duplicates) {
        const duplicateIssue = issues.find(i => i.number === duplicateNum);
        const similarity = group.similarities.find(
          s => s.issue2 === duplicateNum
        );
        
        const result = {
          primary: {
            number: group.primary,
            title: primaryIssue?.title,
            url: primaryIssue?.html_url
          },
          duplicate: {
            number: duplicateNum,
            title: duplicateIssue?.title,
            url: duplicateIssue?.html_url
          },
          similarity: similarity?.similarity,
          titleSimilarity: similarity?.titleSimilarity,
          bodySimilarity: similarity?.bodySimilarity,
          labelOverlap: similarity?.labelOverlap,
          action: 'none' as string
        };
        
        if (this.config.autoClose) {
          try {
            // Add comment explaining the duplicate
            await this.octokit.issues.createComment({
              owner: this.config.owner,
              repo: this.config.repository,
              issue_number: duplicateNum,
              body: this.config.closeMessage!.replace(
                '{primary}', 
                `#${group.primary}`
              )
            });
            
            // Add duplicate label if it exists
            try {
              await this.octokit.issues.addLabels({
                owner: this.config.owner,
                repo: this.config.repository,
                issue_number: duplicateNum,
                labels: ['duplicate']
              });
            } catch (e) {
              // Label might not exist
            }
            
            // Close the issue
            await this.octokit.issues.update({
              owner: this.config.owner,
              repo: this.config.repository,
              issue_number: duplicateNum,
              state: 'closed'
            });
            
            result.action = 'closed';
            this.logger.info(`Closed duplicate issue #${duplicateNum}`);
          } catch (error) {
            this.logger.error(`Failed to close issue #${duplicateNum}`, error);
            results.errors.push({
              issue: duplicateNum,
              error: (error as Error).message
            });
            result.action = 'error';
          }
        }
        
        results.processed.push(result);
      }
    }
    
    return results;
  }

  async findSimilarIssues(issueNumber: number): Promise<any> {
    // Find issues similar to a specific issue
    const { data: targetIssue } = await this.octokit.issues.get({
      owner: this.config.owner,
      repo: this.config.repository,
      issue_number: issueNumber
    });
    
    const allIssues = await this.fetchOpenIssues();
    const similarities: any[] = [];
    
    for (const issue of allIssues) {
      if (issue.number === issueNumber) continue;
      
      const similarity = this.calculateSimilarity(
        `${targetIssue.title} ${targetIssue.body || ''}`,
        `${issue.title} ${issue.body || ''}`
      );
      
      if (similarity > 0.5) {
        similarities.push({
          issue: {
            number: issue.number,
            title: issue.title,
            url: issue.html_url
          },
          similarity
        });
      }
    }
    
    return similarities.sort((a, b) => b.similarity - a.similarity);
  }
}