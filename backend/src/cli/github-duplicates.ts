#!/usr/bin/env node

import { Command } from 'commander';
import { DuplicateManager, DuplicateManagementConfig } from '../services/github/DuplicateManager';
import { IssueDuplicateAgent } from '../agents/github/IssueDuplicateAgent';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';

const program = new Command();

program
  .name('github-duplicates')
  .description('Detect and manage duplicate GitHub issues')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze repository for duplicate issues')
  .requiredOption('-o, --owner <owner>', 'Repository owner')
  .requiredOption('-r, --repo <repo>', 'Repository name')
  .requiredOption('-t, --token <token>', 'GitHub token', process.env.GITHUB_TOKEN)
  .option('-th, --threshold <number>', 'Similarity threshold (0-1)', '0.85')
  .option('--dry-run', 'Run without making changes', true)
  .option('--auto-close', 'Automatically close duplicates')
  .option('--max-days <number>', 'Only analyze issues created within N days')
  .option('--exclude-labels <labels>', 'Comma-separated labels to exclude')
  .option('--include-labels <labels>', 'Only analyze issues with these labels')
  .option('--output <file>', 'Save report to file')
  .option('--format <format>', 'Output format (json|markdown|html)', 'markdown')
  .action(async (options) => {
    const spinner = ora('Initializing duplicate detection...').start();
    
    try {
      const config: DuplicateManagementConfig = {
        owner: options.owner,
        repo: options.repo,
        githubToken: options.token,
        similarityThreshold: parseFloat(options.threshold),
        dryRun: options.dryRun && !options.autoClose,
        autoClose: options.autoClose,
        maxDaysOld: options.maxDays ? parseInt(options.maxDays) : undefined,
        excludeLabels: options.excludeLabels?.split(',').map((l: string) => l.trim()) || [],
        includeOnlyLabels: options.includeLabels?.split(',').map((l: string) => l.trim()) || []
      };

      spinner.text = 'Analyzing repository for duplicates...';
      
      const manager = new DuplicateManager(config);
      const report = await manager.analyzeDuplicates();
      
      spinner.succeed('Analysis complete!');
      
      // Display results
      console.log(chalk.bold('\n📊 Analysis Results:'));
      console.log(chalk.cyan(`Total Issues Analyzed: ${report.totalIssuesAnalyzed}`));
      console.log(chalk.yellow(`Duplicate Groups Found: ${report.duplicateGroups.length}`));
      console.log(chalk.red(`Total Duplicates: ${report.totalDuplicatesFound}`));
      
      if (report.totalDuplicatesClosed > 0) {
        console.log(chalk.green(`Duplicates Closed: ${report.totalDuplicatesClosed}`));
      }
      
      // Display duplicate groups
      if (report.duplicateGroups.length > 0) {
        console.log(chalk.bold('\n🔍 Duplicate Groups:'));
        
        report.duplicateGroups.forEach((group, index) => {
          console.log(chalk.bold(`\n${index + 1}. Primary: #${group.primary.number} - ${group.primary.title}`));
          console.log(chalk.dim(`   URL: ${group.primary.url}`));
          console.log(chalk.dim(`   Action: ${group.action || 'none'}`));
          
          group.duplicates.forEach(dup => {
            const similarity = (dup.similarity.overall * 100).toFixed(1);
            console.log(chalk.gray(`   └─ #${dup.number} (${similarity}% similar) - ${dup.title}`));
          });
        });
      }
      
      // Save report if requested
      if (options.output) {
        let content: string;
        
        switch (options.format) {
          case 'json':
            content = JSON.stringify(report, null, 2);
            break;
          case 'html':
            content = await generateHtmlReport(report);
            break;
          case 'markdown':
          default:
            content = await manager.generateReport(report);
            break;
        }
        
        await fs.writeFile(options.output, content);
        console.log(chalk.green(`\n✅ Report saved to ${options.output}`));
      }
      
      // Show errors if any
      if (report.errors.length > 0) {
        console.log(chalk.red('\n⚠️ Errors encountered:'));
        report.errors.forEach(error => {
          console.log(chalk.red(`   - ${JSON.stringify(error)}`));
        });
      }
      
    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program
  .command('check <issue>')
  .description('Check if a specific issue has duplicates')
  .requiredOption('-o, --owner <owner>', 'Repository owner')
  .requiredOption('-r, --repo <repo>', 'Repository name')
  .requiredOption('-t, --token <token>', 'GitHub token', process.env.GITHUB_TOKEN)
  .option('-th, --threshold <number>', 'Similarity threshold (0-1)', '0.7')
  .action(async (issueNumber: string, options) => {
    const spinner = ora('Checking for duplicates...').start();
    
    try {
      const agent = new IssueDuplicateAgent(
        {
          owner: options.owner,
          repository: options.repo,
          similarityThreshold: parseFloat(options.threshold),
          autoClose: false
        },
        options.token
      );
      
      const similarIssues = await agent.findSimilarIssues(parseInt(issueNumber));
      
      spinner.succeed('Check complete!');
      
      if (similarIssues.length === 0) {
        console.log(chalk.green(`\n✅ No potential duplicates found for issue #${issueNumber}`));
      } else {
        console.log(chalk.yellow(`\n⚠️ Found ${similarIssues.length} potential duplicates:`));
        
        similarIssues.forEach((item, index) => {
          const similarity = (item.similarity * 100).toFixed(1);
          console.log(chalk.cyan(`\n${index + 1}. Issue #${item.issue.number} (${similarity}% similar)`));
          console.log(chalk.dim(`   Title: ${item.issue.title}`));
          console.log(chalk.dim(`   URL: ${item.issue.url}`));
        });
      }
    } catch (error) {
      spinner.fail('Check failed');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program
  .command('interactive')
  .description('Interactive duplicate management')
  .requiredOption('-o, --owner <owner>', 'Repository owner')
  .requiredOption('-r, --repo <repo>', 'Repository name')
  .requiredOption('-t, --token <token>', 'GitHub token', process.env.GITHUB_TOKEN)
  .action(async (options) => {
    try {
      const answers = await inquirer.prompt([
        {
          type: 'number',
          name: 'threshold',
          message: 'Similarity threshold (0-1):',
          default: 0.85,
          validate: (value) => value >= 0 && value <= 1
        },
        {
          type: 'number',
          name: 'maxDays',
          message: 'Max age of issues to analyze (days):',
          default: 90
        },
        {
          type: 'confirm',
          name: 'dryRun',
          message: 'Run in dry-run mode (no changes)?',
          default: true
        }
      ]);
      
      const config: DuplicateManagementConfig = {
        owner: options.owner,
        repo: options.repo,
        githubToken: options.token,
        similarityThreshold: answers.threshold,
        dryRun: answers.dryRun,
        maxDaysOld: answers.maxDays,
        autoClose: false
      };
      
      const spinner = ora('Analyzing repository...').start();
      const manager = new DuplicateManager(config);
      const report = await manager.analyzeDuplicates();
      spinner.succeed('Analysis complete!');
      
      if (report.duplicateGroups.length === 0) {
        console.log(chalk.green('\n✅ No duplicates found!'));
        return;
      }
      
      // Process each duplicate group interactively
      for (const group of report.duplicateGroups) {
        console.log(chalk.bold(`\n\nPrimary Issue: #${group.primary.number}`));
        console.log(chalk.cyan(`Title: ${group.primary.title}`));
        console.log(chalk.dim(`URL: ${group.primary.url}`));
        
        console.log(chalk.yellow('\nPotential Duplicates:'));
        group.duplicates.forEach((dup, index) => {
          const similarity = (dup.similarity.overall * 100).toFixed(1);
          console.log(`${index + 1}. #${dup.number} (${similarity}%) - ${dup.title}`);
        });
        
        if (!answers.dryRun) {
          const action = await inquirer.prompt([
            {
              type: 'list',
              name: 'action',
              message: 'What would you like to do?',
              choices: [
                { name: 'Close all duplicates', value: 'close' },
                { name: 'Label as duplicates', value: 'label' },
                { name: 'Skip this group', value: 'skip' },
                { name: 'Review individually', value: 'review' }
              ]
            }
          ]);
          
          if (action.action === 'review') {
            for (const dup of group.duplicates) {
              const dupAction = await inquirer.prompt([
                {
                  type: 'list',
                  name: 'action',
                  message: `Action for #${dup.number}?`,
                  choices: [
                    { name: 'Close as duplicate', value: 'close' },
                    { name: 'Label as duplicate', value: 'label' },
                    { name: 'Skip', value: 'skip' }
                  ]
                }
              ]);
              
              // Process individual action
              console.log(chalk.dim(`Would ${dupAction.action} issue #${dup.number}`));
            }
          } else {
            console.log(chalk.dim(`Would ${action.action} all duplicates in this group`));
          }
        }
      }
      
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Generate configuration file')
  .option('-o, --output <file>', 'Output file', '.duplicate-config.json')
  .action(async (options) => {
    const config = {
      owner: 'your-org',
      repo: 'your-repo',
      githubToken: '${GITHUB_TOKEN}',
      similarityThreshold: 0.85,
      autoClose: false,
      dryRun: true,
      closeMessage: 'This issue appears to be a duplicate of #{primary}. Closing to consolidate discussion.',
      duplicateLabel: 'duplicate',
      excludeLabels: ['wontfix', 'invalid'],
      includeOnlyLabels: [],
      maxDaysOld: 90,
      requireManualReview: true,
      reviewers: [],
      notifyOnClose: true,
      batchSize: 100
    };
    
    await fs.writeFile(options.output, JSON.stringify(config, null, 2));
    console.log(chalk.green(`✅ Configuration template saved to ${options.output}`));
    console.log(chalk.dim('Edit this file with your settings and use with --config flag'));
  });

// Helper function to generate HTML report
async function generateHtmlReport(report: any): Promise<string> {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Duplicate Issue Report - ${report.repository}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
        }
        .duplicate-group {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .primary-issue {
            border-left: 4px solid #667eea;
            padding-left: 15px;
            margin-bottom: 15px;
        }
        .duplicate-item {
            border-left: 4px solid #ffa500;
            padding-left: 15px;
            margin: 10px 0;
            background: #f9f9f9;
            padding: 10px 15px;
            border-radius: 4px;
        }
        .similarity-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: bold;
            color: white;
        }
        .high-similarity { background: #d32f2f; }
        .medium-similarity { background: #ffa500; }
        .low-similarity { background: #4caf50; }
        a {
            color: #667eea;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .timestamp {
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Duplicate Issue Analysis Report</h1>
        <p>Repository: ${report.repository}</p>
        <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
    </div>
    
    <div class="summary">
        <div class="stat-card">
            <div class="stat-value">${report.totalIssuesAnalyzed}</div>
            <div class="stat-label">Issues Analyzed</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${report.duplicateGroups.length}</div>
            <div class="stat-label">Duplicate Groups</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${report.totalDuplicatesFound}</div>
            <div class="stat-label">Total Duplicates</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${report.totalDuplicatesClosed}</div>
            <div class="stat-label">Closed</div>
        </div>
    </div>
    
    <h2>Duplicate Groups</h2>
    ${report.duplicateGroups.map((group: any) => `
        <div class="duplicate-group">
            <div class="primary-issue">
                <h3>Primary: <a href="${group.primary.url}">#${group.primary.number}</a> - ${group.primary.title}</h3>
                <p class="timestamp">Created: ${new Date(group.primary.created_at).toLocaleDateString()} by ${group.primary.author}</p>
                ${group.action ? `<p>Action: <strong>${group.action}</strong></p>` : ''}
            </div>
            
            <h4>Duplicates:</h4>
            ${group.duplicates.map((dup: any) => {
                const simPercent = (dup.similarity.overall * 100).toFixed(1);
                const simClass = dup.similarity.overall >= 0.9 ? 'high-similarity' : 
                               dup.similarity.overall >= 0.8 ? 'medium-similarity' : 'low-similarity';
                return `
                <div class="duplicate-item">
                    <a href="${dup.url}">#${dup.number}</a> - ${dup.title}
                    <span class="similarity-badge ${simClass}">${simPercent}% Similar</span>
                    <p class="timestamp">Created: ${new Date(dup.created_at).toLocaleDateString()} by ${dup.author}</p>
                    <details>
                        <summary>Similarity Details</summary>
                        <ul>
                            <li>Title: ${(dup.similarity.title * 100).toFixed(1)}%</li>
                            <li>Body: ${(dup.similarity.body * 100).toFixed(1)}%</li>
                            <li>Labels: ${(dup.similarity.labels * 100).toFixed(1)}%</li>
                            <li>Metadata: ${(dup.similarity.metadata * 100).toFixed(1)}%</li>
                        </ul>
                    </details>
                </div>`;
            }).join('')}
        </div>
    `).join('')}
    
    ${report.errors.length > 0 ? `
        <div class="duplicate-group" style="border-left: 4px solid #d32f2f;">
            <h3>⚠️ Errors</h3>
            <ul>
                ${report.errors.map((e: any) => `<li>${JSON.stringify(e)}</li>`).join('')}
            </ul>
        </div>
    ` : ''}
    
    <div class="timestamp" style="text-align: center; margin-top: 40px;">
        <p>Execution time: ${(report.executionTime / 1000).toFixed(2)} seconds</p>
    </div>
</body>
</html>`;
}

program.parse(process.argv);