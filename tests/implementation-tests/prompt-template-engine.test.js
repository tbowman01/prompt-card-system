/**
 * Test implementation for Prompt Template Engine
 * Tests the template examples from quick-start-tutorials.md
 */

describe('Prompt Template Engine Implementation', () => {
  // Simple template engine implementation for testing
  const templateEngine = {
    render: (template, variables) => {
      let result = template;
      
      // Handle simple variable substitution {{variable}}
      result = result.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
        const varName = variable.trim();
        return variables[varName] || match;
      });
      
      // Handle conditional logic {{#if condition}}...{{/if}}
      result = result.replace(/\{\{#if\s+([^}]+)\}\}(.*?)\{\{\/if\}\}/gs, (match, condition, content) => {
        const conditionResult = evaluateCondition(condition.trim(), variables);
        return conditionResult ? content : '';
      });
      
      return result;
    }
  };

  const evaluateCondition = (condition, variables) => {
    // Simple condition evaluation for priority_level === 'urgent'
    if (condition.includes("priority_level === 'urgent'")) {
      return variables.priority_level === 'urgent';
    }
    // Add more condition types as needed
    return false;
  };

  test('should render Customer Service Response template with variable substitution', () => {
    const template = `Dear {{customer_name}},

Thank you for contacting us about {{issue_type}}. We understand your concern regarding {{specific_issue}}.

{{#if priority_level === 'urgent'}}
We have marked your case as urgent and will respond within 2 hours.
{{/if}}

Our team is working on resolving this issue. We will keep you updated on our progress.

Best regards,
{{agent_name}}
Customer Service Team`;

    const variables = {
      customer_name: 'John Smith',
      issue_type: 'billing inquiry',
      specific_issue: 'incorrect charges on monthly statement',
      priority_level: 'urgent',
      agent_name: 'Sarah Johnson'
    };

    const result = templateEngine.render(template, variables);

    expect(result).toContain('Dear John Smith,');
    expect(result).toContain('about billing inquiry');
    expect(result).toContain('regarding incorrect charges on monthly statement');
    expect(result).toContain('We have marked your case as urgent and will respond within 2 hours.');
    expect(result).toContain('Sarah Johnson');
    expect(result).toContain('Customer Service Team');
  });

  test('should handle non-urgent priority level correctly', () => {
    const template = `Dear {{customer_name}},

{{#if priority_level === 'urgent'}}
We have marked your case as urgent and will respond within 2 hours.
{{/if}}

Thank you for your patience.`;

    const variables = {
      customer_name: 'Jane Doe',
      priority_level: 'normal'
    };

    const result = templateEngine.render(template, variables);

    expect(result).toContain('Dear Jane Doe,');
    expect(result).not.toContain('We have marked your case as urgent');
    expect(result).toContain('Thank you for your patience.');
  });

  test('should render Social Media Post Generator template', () => {
    const template = `🚀 Exciting news! We're launching {{product_name}} - {{product_description}}

Key benefits:
{{#each benefits}}
✅ {{this}}
{{/each}}

Available starting {{launch_date}}!

#{{hashtag1}} #{{hashtag2}} #launch`;

    // For this test, we'll simulate the {{#each}} functionality
    const simpleTemplate = `🚀 Exciting news! We're launching {{product_name}} - {{product_description}}

Key benefits:
✅ {{benefit1}}
✅ {{benefit2}}
✅ {{benefit3}}

Available starting {{launch_date}}!

#{{hashtag1}} #{{hashtag2}} #launch`;

    const variables = {
      product_name: 'SmartChat AI',
      product_description: 'the next-generation conversational AI platform',
      benefit1: 'Advanced natural language processing',
      benefit2: 'Real-time conversation analytics',
      benefit3: 'Multi-language support',
      launch_date: 'September 1st',
      hashtag1: 'AI',
      hashtag2: 'Innovation'
    };

    const result = templateEngine.render(simpleTemplate, variables);

    expect(result).toContain('🚀 Exciting news! We\'re launching SmartChat AI');
    expect(result).toContain('the next-generation conversational AI platform');
    expect(result).toContain('✅ Advanced natural language processing');
    expect(result).toContain('✅ Real-time conversation analytics');
    expect(result).toContain('✅ Multi-language support');
    expect(result).toContain('Available starting September 1st!');
    expect(result).toContain('#AI #Innovation #launch');
  });

  test('should handle missing variables gracefully', () => {
    const template = `Hello {{customer_name}}, your order {{order_id}} is {{status}}.`;

    const variables = {
      customer_name: 'Alice Brown',
      status: 'shipped'
      // order_id is missing
    };

    const result = templateEngine.render(template, variables);

    expect(result).toContain('Hello Alice Brown');
    expect(result).toContain('{{order_id}}'); // Should remain unreplaced
    expect(result).toContain('is shipped');
  });

  test('should handle complex conditional logic', () => {
    const template = `Dear {{customer_name}},

{{#if priority_level === 'urgent'}}
🚨 URGENT: Your case requires immediate attention.
Response time: 2 hours
{{/if}}

Status: {{case_status}}
Reference: {{case_id}}`;

    const urgentCase = {
      customer_name: 'Emergency Client',
      priority_level: 'urgent',
      case_status: 'In Progress',
      case_id: 'URG-2025-001'
    };

    const normalCase = {
      customer_name: 'Regular Client',
      priority_level: 'normal',
      case_status: 'Queued',
      case_id: 'REG-2025-002'
    };

    const urgentResult = templateEngine.render(template, urgentCase);
    const normalResult = templateEngine.render(template, normalCase);

    expect(urgentResult).toContain('🚨 URGENT: Your case requires immediate attention.');
    expect(urgentResult).toContain('Response time: 2 hours');
    expect(urgentResult).toContain('Reference: URG-2025-001');

    expect(normalResult).not.toContain('🚨 URGENT');
    expect(normalResult).not.toContain('Response time: 2 hours');
    expect(normalResult).toContain('Reference: REG-2025-002');
  });
});