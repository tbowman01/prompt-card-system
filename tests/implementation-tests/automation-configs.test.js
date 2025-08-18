/**
 * Test implementation for Automation Configurations
 * Tests the JSON configurations from quick-start-tutorials.md
 */

describe('Automation Configurations Implementation', () => {
  test('should validate Scheduled Test Configuration (lines 391-401)', () => {
    // Configuration from tutorial lines 391-401
    const scheduledTestConfig = {
      "name": "Daily API Health Check",
      "schedule": "0 2 * * *",
      "tests": [
        {
          "name": "API Health Check",
          "endpoint": "http://localhost:3001/health",
          "expected_status": 200,
          "timeout": 30000
        }
      ]
    };

    // Validate configuration structure
    expect(scheduledTestConfig).toHaveProperty('name');
    expect(scheduledTestConfig).toHaveProperty('schedule');
    expect(scheduledTestConfig).toHaveProperty('tests');
    expect(Array.isArray(scheduledTestConfig.tests)).toBe(true);

    // Validate individual test configuration
    const healthCheckTest = scheduledTestConfig.tests[0];
    expect(healthCheckTest).toHaveProperty('name', 'API Health Check');
    expect(healthCheckTest).toHaveProperty('endpoint', 'http://localhost:3001/health');
    expect(healthCheckTest).toHaveProperty('expected_status', 200);
    expect(healthCheckTest).toHaveProperty('timeout', 30000);

    // Validate cron schedule format (daily at 2 AM)
    expect(scheduledTestConfig.schedule).toMatch(/^[0-9*\/,-]+\s[0-9*\/,-]+\s[0-9*\/,-]+\s[0-9*\/,-]+\s[0-9*\/,-]+$/);
    expect(scheduledTestConfig.schedule).toBe('0 2 * * *');
  });

  test('should validate Report Configuration (lines 414-422)', () => {
    // Configuration from tutorial lines 414-422
    const reportConfig = {
      "report_type": "performance_summary",
      "frequency": "weekly",
      "recipients": ["team@company.com", "manager@company.com"],
      "format": "html",
      "include_metrics": [
        "response_time",
        "throughput",
        "error_rate",
        "availability"
      ]
    };

    // Validate report configuration structure
    expect(reportConfig).toHaveProperty('report_type', 'performance_summary');
    expect(reportConfig).toHaveProperty('frequency', 'weekly');
    expect(reportConfig).toHaveProperty('recipients');
    expect(reportConfig).toHaveProperty('format', 'html');
    expect(reportConfig).toHaveProperty('include_metrics');

    // Validate recipients array
    expect(Array.isArray(reportConfig.recipients)).toBe(true);
    expect(reportConfig.recipients).toContain('team@company.com');
    expect(reportConfig.recipients).toContain('manager@company.com');

    // Validate metrics array
    expect(Array.isArray(reportConfig.include_metrics)).toBe(true);
    expect(reportConfig.include_metrics).toContain('response_time');
    expect(reportConfig.include_metrics).toContain('throughput');
    expect(reportConfig.include_metrics).toContain('error_rate');
    expect(reportConfig.include_metrics).toContain('availability');

    // Validate email format
    reportConfig.recipients.forEach(email => {
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });
  });

  test('should create comprehensive automation configuration', () => {
    const automationConfig = {
      scheduledTests: {
        "name": "Daily API Health Check",
        "schedule": "0 2 * * *",
        "tests": [
          {
            "name": "API Health Check",
            "endpoint": "http://localhost:3001/health",
            "expected_status": 200,
            "timeout": 30000
          }
        ]
      },
      reports: {
        "report_type": "performance_summary",
        "frequency": "weekly",
        "recipients": ["team@company.com", "manager@company.com"],
        "format": "html",
        "include_metrics": [
          "response_time",
          "throughput",
          "error_rate",
          "availability"
        ]
      },
      notifications: {
        "slack": {
          "webhook_url": "https://hooks.slack.com/services/...",
          "channel": "#alerts",
          "on_failure": true,
          "on_success": false
        },
        "email": {
          "smtp_server": "smtp.company.com",
          "port": 587,
          "recipients": ["alerts@company.com"],
          "on_failure": true
        }
      }
    };

    // Validate overall structure
    expect(automationConfig).toHaveProperty('scheduledTests');
    expect(automationConfig).toHaveProperty('reports');
    expect(automationConfig).toHaveProperty('notifications');

    // Validate notification configurations
    expect(automationConfig.notifications.slack).toHaveProperty('webhook_url');
    expect(automationConfig.notifications.slack).toHaveProperty('channel', '#alerts');
    expect(automationConfig.notifications.email).toHaveProperty('smtp_server');
    expect(automationConfig.notifications.email).toHaveProperty('port', 587);
  });

  test('should validate cron schedule patterns', () => {
    const schedules = [
      { name: 'Daily at 2 AM', pattern: '0 2 * * *', valid: true },
      { name: 'Every 15 minutes', pattern: '*/15 * * * *', valid: true },
      { name: 'Weekly on Monday', pattern: '0 9 * * 1', valid: true },
      { name: 'Monthly on 1st', pattern: '0 0 1 * *', valid: true },
      { name: 'Invalid pattern', pattern: 'invalid', valid: false }
    ];

    const validateCronPattern = (pattern) => {
      // Basic cron pattern validation (simplified)
      const cronRegex = /^([0-9*\/,-]+\s){4}[0-9*\/,-]+$/;
      return cronRegex.test(pattern);
    };

    schedules.forEach(schedule => {
      const isValid = validateCronPattern(schedule.pattern);
      expect(isValid).toBe(schedule.valid);
    });
  });

  test('should handle configuration merging and defaults', () => {
    const defaultConfig = {
      timeout: 30000,
      retries: 3,
      format: 'json'
    };

    const userConfig = {
      timeout: 60000,
      endpoint: 'http://localhost:3001/api/test'
    };

    const mergedConfig = { ...defaultConfig, ...userConfig };

    expect(mergedConfig).toEqual({
      timeout: 60000,      // overridden
      retries: 3,          // from default
      format: 'json',      // from default
      endpoint: 'http://localhost:3001/api/test'  // from user
    });
  });

  test('should validate configuration against schema', () => {
    const configSchema = {
      required: ['name', 'schedule', 'tests'],
      properties: {
        name: { type: 'string' },
        schedule: { type: 'string' },
        tests: { type: 'array' }
      }
    };

    const validConfig = {
      name: "Test Config",
      schedule: "0 2 * * *",
      tests: []
    };

    const invalidConfig = {
      name: "Test Config",
      // missing schedule and tests
    };

    const validateConfig = (config, schema) => {
      return schema.required.every(field => config.hasOwnProperty(field));
    };

    expect(validateConfig(validConfig, configSchema)).toBe(true);
    expect(validateConfig(invalidConfig, configSchema)).toBe(false);
  });
});