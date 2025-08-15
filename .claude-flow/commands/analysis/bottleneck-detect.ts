#!/usr/bin/env node

import { Command } from 'commander';
import { BottleneckDetector } from '../../agents/bottleneck-detector';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';

const program = new Command();

program
  .name('bottleneck-detect')
  .description('Analyze performance bottlenecks in swarm operations')
  .option('-s, --swarm-id <id>', 'Analyze specific swarm', 'github-automation-swarm')
  .option('-t, --time-range <range>', 'Analysis period: 1h, 24h, 7d, all', '1h')
  .option('--threshold <percent>', 'Bottleneck threshold percentage', '20')
  .option('-e, --export <file>', 'Export analysis to file')
  .option('--fix', 'Apply automatic optimizations')
  .action(async (options) => {
    const spinner = ora('Analyzing performance bottlenecks...').start();
    
    try {
      const detector = new BottleneckDetector(parseInt(options.threshold));
      
      // Perform analysis
      const analysis = await detector.analyzeBottlenecks(options.timeRange);
      
      spinner.succeed('Bottleneck analysis complete!');
      
      // Display formatted report
      console.log(detector.formatReport(analysis));
      
      // Export if requested
      if (options.export) {
        const exportPath = path.resolve(options.export);
        await detector.exportAnalysis(analysis, exportPath);
        console.log(chalk.green(`\n📁 Analysis exported to: ${exportPath}`));
      }
      
      // Apply fixes if requested
      if (options.fix && analysis.autoFixes.length > 0) {
        const fixSpinner = ora('Applying automatic fixes...').start();
        
        try {
          const fixResults = await detector.applyAutoFixes();
          fixSpinner.succeed('Fixes applied successfully!');
          
          console.log(chalk.bold('\n🔧 Applied Fixes:'));
          fixResults.forEach(fix => {
            console.log(chalk.green(`✓ ${fix.component}: ${fix.improvement} improvement expected`));
          });
          
          console.log(chalk.yellow('\n⚠️  Please restart affected services for changes to take effect.'));
        } catch (error) {
          fixSpinner.fail('Failed to apply some fixes');
          console.error(chalk.red('Error:'), error);
        }
      }
      
      // Show performance score with color coding
      const score = analysis.performanceScore;
      let scoreColor = chalk.green;
      if (score < 50) scoreColor = chalk.red;
      else if (score < 75) scoreColor = chalk.yellow;
      
      console.log(chalk.bold('\n📈 Performance Score: ') + scoreColor(`${score}/100`));
      
      // Provide actionable next steps
      if (analysis.bottlenecks.length > 0) {
        console.log(chalk.bold('\n🎯 Next Steps:'));
        
        const critical = analysis.bottlenecks.filter(b => b.type === 'critical');
        if (critical.length > 0) {
          console.log(chalk.red('1. Address critical bottlenecks immediately'));
          critical.slice(0, 3).forEach(b => {
            console.log(chalk.dim(`   - ${b.component}: ${b.recommendation}`));
          });
        }
        
        if (!options.fix && analysis.autoFixes.length > 0) {
          console.log(chalk.yellow(`2. Run with --fix to apply ${analysis.autoFixes.length} automatic optimizations`));
        }
        
        console.log(chalk.cyan('3. Monitor performance after changes'));
        console.log(chalk.dim('   npx claude-flow performance report'));
      } else {
        console.log(chalk.green('\n✨ No significant bottlenecks detected! System is performing well.'));
      }
      
    } catch (error) {
      spinner.fail('Bottleneck analysis failed');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program.parse(process.argv);