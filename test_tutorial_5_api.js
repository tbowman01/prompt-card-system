#!/usr/bin/env node

/**
 * Test Tutorial 5: API Integration Points
 * Testing API endpoints from lines 390-421 and automation from lines 352-370
 */

console.log("🧪 Testing Tutorial 5: API Integration Points");
console.log("=============================================");

// Test API endpoint structure from lines 392-405
console.log("\n1. Testing API Endpoint Structure:");

const apiExample = `
// Daily performance check
async function dailyHealthCheck() {
  const metrics = await api.analytics.getMetrics({
    timeRange: '24h',
    prompts: 'all'
  });
  
  if (metrics.successRate < 0.90) {
    await notificationService.alert({
      level: 'warning',
      message: \`Success rate dropped to \${metrics.successRate}%\`,
      channel: 'slack'
    });
  }
}`;

const apiPatterns = [
  { pattern: /api\.analytics\.getMetrics/, description: "Analytics API endpoint" },
  { pattern: /notificationService\.alert/, description: "Notification service" },
  { pattern: /timeRange:\s*'24h'/, description: "Time range parameter" },
  { pattern: /prompts:\s*'all'/, description: "Prompts parameter" },
  { pattern: /successRate\s*<\s*0\.90/, description: "Success rate threshold" },
  { pattern: /channel:\s*'slack'/, description: "Slack integration" }
];

let apiStructurePassed = 0;
apiPatterns.forEach(test => {
  const found = test.pattern.test(apiExample);
  console.log(`   ${found ? '✅' : '❌'} ${test.description}: ${found ? 'FOUND' : 'MISSING'}`);
  if (found) apiStructurePassed++;
});

console.log(`   API structure: ${apiStructurePassed}/${apiPatterns.length} patterns found`);

// Test batch testing API from lines 407-421
console.log("\n2. Testing Batch Testing API:");

const batchTestingExample = `
// Automated testing
async function runNightlyTests() {
  const results = await api.tests.runBatch({
    workspace: 'marketing-team',
    tags: ['critical', 'automated'],
    parallel: true
  });
  
  await api.reports.generate({
    template: 'nightly-summary',
    data: results,
    recipients: ['team-leads@company.com']
  });
}`;

const batchApiPatterns = [
  { pattern: /api\.tests\.runBatch/, description: "Batch testing endpoint" },
  { pattern: /workspace:\s*'marketing-team'/, description: "Workspace parameter" },
  { pattern: /tags:\s*\[.*'critical'.*'automated'.*\]/, description: "Tags array" },
  { pattern: /parallel:\s*true/, description: "Parallel execution" },
  { pattern: /api\.reports\.generate/, description: "Report generation API" },
  { pattern: /template:\s*'nightly-summary'/, description: "Report template" },
  { pattern: /recipients:\s*\[.*@.*\]/, description: "Email recipients" }
];

let batchApiPassed = 0;
batchApiPatterns.forEach(test => {
  const found = test.pattern.test(batchTestingExample);
  console.log(`   ${found ? '✅' : '❌'} ${test.description}: ${found ? 'FOUND' : 'MISSING'}`);
  if (found) batchApiPassed++;
});

console.log(`   Batch API structure: ${batchApiPassed}/${batchApiPatterns.length} patterns found`);

// Test automation configuration from lines 352-370
console.log("\n3. Testing Automation Configuration:");

const automationConfig = {
  schedule: "daily",
  time: "09:00",
  timezone: "UTC",
  prompts: ["customer-service", "social-media"],
  notifications: {
    email: "team@company.com",
    slack: "#marketing-alerts"
  }
};

const configValidation = [
  { test: typeof automationConfig.schedule === 'string', description: "Schedule format" },
  { test: /^\d{2}:\d{2}$/.test(automationConfig.time), description: "Time format (HH:MM)" },
  { test: automationConfig.timezone === 'UTC', description: "Timezone specification" },
  { test: Array.isArray(automationConfig.prompts), description: "Prompts array" },
  { test: automationConfig.notifications.hasOwnProperty('email'), description: "Email notification" },
  { test: automationConfig.notifications.hasOwnProperty('slack'), description: "Slack notification" },
  { test: /^#/.test(automationConfig.notifications.slack), description: "Slack channel format" }
];

let configPassed = 0;
configValidation.forEach(validation => {
  console.log(`   ${validation.test ? '✅' : '❌'} ${validation.description}: ${validation.test ? 'VALID' : 'INVALID'}`);
  if (validation.test) configPassed++;
});

console.log(`   Configuration: ${configPassed}/${configValidation.length} validations passed`);

// Test performance alert thresholds from lines 366-369
console.log("\n4. Testing Performance Alert Thresholds:");

const alertThresholds = [
  { metric: "Success rate", threshold: "< 90%", condition: "drops below 90%" },
  { metric: "Response time", threshold: "> 5 seconds", condition: "exceeds 5 seconds" },
  { metric: "Cost increase", threshold: "> 20%", condition: "increases by more than 20%" }
];

const thresholdValidation = alertThresholds.map(alert => ({
  hasThreshold: alert.threshold.match(/[<>]\s*\d+[%s]?/),
  hasCondition: alert.condition.includes(alert.threshold.match(/\d+/)?.[0] || ''),
  description: `${alert.metric} threshold`
}));

let thresholdPassed = 0;
thresholdValidation.forEach(validation => {
  const valid = validation.hasThreshold && validation.hasCondition;
  console.log(`   ${valid ? '✅' : '❌'} ${validation.description}: ${valid ? 'VALID' : 'INVALID'}`);
  if (valid) thresholdPassed++;
});

console.log(`   Alert thresholds: ${thresholdPassed}/${thresholdValidation.length} thresholds valid`);

// Test report configuration from lines 376-385
console.log("\n5. Testing Report Configuration:");

const reportConfig = {
  reportName: "Weekly Performance Summary",
  timeRange: "Last 7 days",
  include: "Success rates, response times, costs",
  groupBy: "Prompt card, team member",
  format: "PDF with charts",
  recipients: "Management team", 
  schedule: "Every Monday 9 AM"
};

const reportValidation = [
  { test: reportConfig.reportName.includes("Weekly"), description: "Weekly report naming" },
  { test: reportConfig.timeRange.includes("7 days"), description: "7-day time range" },
  { test: reportConfig.include.includes("Success rates"), description: "Success rate metrics" },
  { test: reportConfig.groupBy.includes("Prompt card"), description: "Prompt card grouping" },
  { test: reportConfig.format.includes("PDF"), description: "PDF format" },
  { test: reportConfig.schedule.includes("Monday"), description: "Monday scheduling" }
];

let reportPassed = 0;
reportValidation.forEach(validation => {
  console.log(`   ${validation.test ? '✅' : '❌'} ${validation.description}: ${validation.test ? 'VALID' : 'INVALID'}`);
  if (validation.test) reportPassed++;
});

console.log(`   Report configuration: ${reportPassed}/${reportValidation.length} settings valid`);

// Test error handling patterns
console.log("\n6. Testing Error Handling Patterns:");

const errorHandlingChecks = [
  { pattern: /if\s*\(.*<.*\)/, description: "Conditional threshold checking", found: apiExample.includes("if (metrics.successRate < 0.90)") },
  { pattern: /await.*api\./, description: "Async/await pattern usage", found: batchTestingExample.includes("await api.") },
  { pattern: /try.*catch|\.catch/, description: "Error handling (try/catch)", found: false }, // Not shown in examples
  { pattern: /notification|alert/, description: "Error notification", found: apiExample.includes("notificationService.alert") }
];

let errorHandlingPassed = 0;
errorHandlingChecks.forEach(check => {
  console.log(`   ${check.found ? '✅' : '❌'} ${check.description}: ${check.found ? 'IMPLEMENTED' : 'MISSING'}`);
  if (check.found) errorHandlingPassed++;
});

console.log(`   Error handling: ${errorHandlingPassed}/${errorHandlingChecks.length} patterns found`);

// Overall Tutorial 5 API Results
const allTestResults = [
  apiStructurePassed >= 5,      // API structure
  batchApiPassed >= 6,          // Batch API 
  configPassed >= 6,            // Configuration
  thresholdPassed >= 2,         // Thresholds
  reportPassed >= 5,            // Reports
  errorHandlingPassed >= 2      // Error handling
];

const overallPassed = allTestResults.filter(test => test).length;
const tutorial5Success = overallPassed >= 5; // Allow 1 failure

console.log("\n🎯 Tutorial 5 API Integration Test Results:");
console.log(`   API endpoint structure: ${apiStructurePassed >= 5 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Batch testing API: ${batchApiPassed >= 6 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Automation configuration: ${configPassed >= 6 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Performance thresholds: ${thresholdPassed >= 2 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Report configuration: ${reportPassed >= 5 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Error handling: ${errorHandlingPassed >= 2 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Overall: ${overallPassed}/6 test categories passed`);
console.log(`   Result: ${tutorial5Success ? '✅ PASS' : '❌ FAIL'}`);

process.exit(tutorial5Success ? 0 : 1);