#!/usr/bin/env node

import { Command } from 'commander';
import { DuplicateWorkflowAgent } from '../../../backend/src/agents/github/DuplicateWorkflowAgent';
import chalk from 'chalk';
import ora from 'ora';

const program = new Command();

program
  .name('issue-triage')
  .description('Intelligent GitHub issue triage and duplicate detection')
  .version('1.0.0');

// Close duplicates command
program
  .command('close-duplicates')
  .alias('close')
  .description('Detect and close duplicate issues')
  .requiredOption('-r, --repository <repo>', 'Repository in format owner/repo')
  .option('-t, --token <token>', 'GitHub token', process.env.GITHUB_TOKEN)
  .option('-p, --profile <profile>', 'Configuration profile', 'moderate')
  .option('--dry-run', 'Preview actions without making changes', false)
  .option('--auto-close', 'Enable automatic closing of duplicates')
  .option('--threshold <number>', 'Similarity threshold override')
  .action(async (options) => {
    const spinner = ora('Initializing duplicate detection...').start();
    
    try {
      if (!options.token) {
        throw new Error('GitHub token is required. Set GITHUB_TOKEN environment variable or use --token');
      }

      const [owner, repo] = options.repository.split('/');
      if (!owner || !repo) {
        throw new Error('Repository must be in format "owner/repo"');
      }

      spinner.text = 'Analyzing repository for duplicates...';
      
      const result = await DuplicateWorkflowAgent.runWorkflow({
        owner,
        repo,
        token: options.token,
        profile: options.profile
      });

      if (result.success) {
        spinner.succeed('Duplicate detection complete!');
        
        console.log(chalk.bold('\n📊 Results:'));
        console.log(chalk.cyan(`Repository: ${result.repository}`));
        console.log(chalk.yellow(`Duplicates Found: ${result.duplicatesProcessed}`));
        console.log(chalk.green(`Execution Time: ${(result.executionTime / 1000).toFixed(2)}s`));
        
        if (result.report?.duplicateGroups?.length > 0) {
          console.log(chalk.bold('\n🔍 Duplicate Groups:'));
          
          result.report.duplicateGroups.slice(0, 5).forEach((group: any, index: number) => {
            console.log(chalk.bold(`\n${index + 1}. Primary: #${group.primary.number}`));
            console.log(chalk.dim(`   ${group.primary.title}`));
            
            group.duplicates.forEach((dup: any) => {
              const similarity = (dup.similarity.overall * 100).toFixed(1);
              console.log(chalk.gray(`   └─ #${dup.number} (${similarity}% similar)`));
            });
          });
          
          if (result.report.duplicateGroups.length > 5) {
            console.log(chalk.dim(`\n... and ${result.report.duplicateGroups.length - 5} more groups`));
          }
        } else {
          console.log(chalk.green('\n✅ No duplicates detected!'));
        }
      } else {
        spinner.fail('Duplicate detection failed');
        console.error(chalk.red('Error:'), result.error);
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Operation failed');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Check specific issue
program
  .command('check-issue <issue>')
  .description('Check if a specific issue has duplicates')
  .requiredOption('-r, --repository <repo>', 'Repository in format owner/repo')
  .option('-t, --token <token>', 'GitHub token', process.env.GITHUB_TOKEN)
  .option('-p, --profile <profile>', 'Configuration profile', 'moderate')
  .action(async (issueNumber: string, options) => {
    const spinner = ora('Checking for duplicates...').start();
    
    try {
      const [owner, repo] = options.repository.split('/');
      const result = await DuplicateWorkflowAgent.runWorkflow({
        owner,
        repo,
        token: options.token,
        profile: options.profile,
        issueNumber: parseInt(issueNumber)
      });

      if (result.success) {
        spinner.succeed('Check complete!');
        
        const similarIssues = result.report?.similarIssues || [];
        
        if (similarIssues.length === 0) {
          console.log(chalk.green(`\n✅ No potential duplicates found for issue #${issueNumber}`));
        } else {
          console.log(chalk.yellow(`\n⚠️ Found ${similarIssues.length} potential duplicates:`));
          
          similarIssues.forEach((item: any, index: number) => {
            const similarity = (item.similarity * 100).toFixed(1);
            console.log(chalk.cyan(`\n${index + 1}. Issue #${item.issue.number} (${similarity}% similar)`));
            console.log(chalk.dim(`   ${item.issue.title}`));
          });
        }
      } else {
        spinner.fail('Check failed');
        console.error(chalk.red('Error:'), result.error);
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Check failed');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Auto-label duplicates
program
  .command('auto-label')
  .description('Automatically label potential duplicates for review')
  .requiredOption('-r, --repository <repo>', 'Repository in format owner/repo')
  .option('-t, --token <token>', 'GitHub token', process.env.GITHUB_TOKEN)
  .option('-p, --profile <profile>', 'Configuration profile', 'relaxed')
  .action(async (options) => {
    const spinner = ora('Labeling potential duplicates...').start();
    
    try {
      const [owner, repo] = options.repository.split('/');
      const result = await DuplicateWorkflowAgent.runWorkflow({
        owner,
        repo,
        token: options.token,
        profile: options.profile
      });

      if (result.success) {
        spinner.succeed('Labeling complete!');
        console.log(chalk.green(`\n✅ Labeled ${result.duplicatesProcessed} potential duplicates`));
      } else {
        spinner.fail('Labeling failed');
        console.error(chalk.red('Error:'), result.error);
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Labeling failed');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Schedule analysis
program
  .command('schedule')
  .description('Run scheduled duplicate analysis')
  .requiredOption('-r, --repository <repo>', 'Repository in format owner/repo')
  .option('-t, --token <token>', 'GitHub token', process.env.GITHUB_TOKEN)
  .option('-p, --profile <profile>', 'Configuration profile', 'moderate')
  .action(async (options) => {
    const spinner = ora('Running scheduled analysis...').start();
    
    try {
      const [owner, repo] = options.repository.split('/');
      const result = await DuplicateWorkflowAgent.runWorkflow({
        owner,
        repo,
        token: options.token,
        profile: options.profile,
        scheduled: true
      });

      if (result.success) {
        spinner.succeed('Scheduled analysis complete!');
        
        console.log(chalk.bold('\n📊 Scheduled Analysis Results:'));
        console.log(chalk.cyan(`Repository: ${result.repository}`));
        console.log(chalk.yellow(`Duplicates Found: ${result.duplicatesProcessed}`));
        console.log(chalk.green(`Execution Time: ${(result.executionTime / 1000).toFixed(2)}s`));
        
        // Report saved automatically
        console.log(chalk.dim('\n📄 Report saved to .claude-flow/reports/duplicates/'));
      } else {
        spinner.fail('Scheduled analysis failed');
        console.error(chalk.red('Error:'), result.error);
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Scheduled analysis failed');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Configure profiles
program
  .command('configure')
  .description('Configure duplicate detection profiles')
  .option('--list', 'List available profiles')
  .option('--create <name>', 'Create new profile')
  .option('--edit <name>', 'Edit existing profile')
  .action(async (options) => {
    if (options.list) {
      console.log(chalk.bold('Available Profiles:'));
      console.log(chalk.cyan('• strict') + ' - High confidence, manual review required');
      console.log(chalk.yellow('• moderate') + ' - Balanced approach with review');
      console.log(chalk.green('• relaxed') + ' - Lower threshold, label only');
      console.log(chalk.red('• aggressive') + ' - Auto-close with notifications');
    } else {
      console.log(chalk.dim('Profile configuration UI would go here'));
    }
  });

program.parse(process.argv);

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}