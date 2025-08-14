#!/usr/bin/env node

/**
 * Test Tutorial 1: Customer Service Response Template
 * Testing all variables and template structure from lines 38-51
 */

const tutorialTemplate = `You are a helpful customer service representative for {{company_name}}.

Customer Issue: {{customer_issue}}
Customer Name: {{customer_name}}
Priority Level: {{priority_level}}

Please provide a {{response_style}} response that:
- Acknowledges the customer's concern
- Provides a helpful solution or next steps
- Maintains a {{tone}} tone
- Includes an appropriate closing`;

// Test variables from lines 54-59
const testVariables = {
  company_name: "Acme Corp", // default value
  customer_issue: "The customer's problem or question",
  customer_name: "Customer's name for personalization", 
  priority_level: "urgent, high, normal, low",
  response_style: "formal, friendly, brief, detailed",
  tone: "professional, empathetic, solution-focused"
};

// Test Case from lines 67-78
const testCaseInputs = {
  company_name: "TechFlow Solutions",
  customer_issue: "I was charged twice for my monthly subscription",
  customer_name: "Sarah",
  priority_level: "high",
  response_style: "detailed",
  tone: "empathetic"
};

console.log("🧪 Testing Tutorial 1: Customer Service Response Template");
console.log("===============================================");

// Test 1: Template Variable Substitution
console.log("\n1. Testing Template Variables:");
let populatedTemplate = tutorialTemplate;
Object.keys(testCaseInputs).forEach(key => {
  const placeholder = `{{${key}}}`;
  if (populatedTemplate.includes(placeholder)) {
    populatedTemplate = populatedTemplate.replace(new RegExp(placeholder, 'g'), testCaseInputs[key]);
    console.log(`   ✅ Variable ${key}: Found and replaceable`);
  } else {
    console.log(`   ❌ Variable ${key}: Not found in template`);
  }
});

console.log("\n📝 Populated Template:");
console.log(populatedTemplate);

// Test 2: Assertion Logic from lines 82-85
console.log("\n2. Testing Assertion Logic:");

const mockLLMResponse = `Dear Sarah,

I sincerely apologize for the billing error you've experienced. I understand how frustrating it must be to see duplicate charges on your account. 

I've reviewed your account and can see that you were indeed charged twice for your monthly subscription on the same date. This appears to be a system error on our end. I'm immediately processing a refund for the duplicate charge, which should appear in your account within 2-3 business days.

To prevent this from happening again, I've also added a note to your account and escalated this issue to our billing team for investigation.

Please don't hesitate to reach out if you have any questions or if you don't see the refund within the expected timeframe.

Best regards,
Customer Service Team
TechFlow Solutions`;

// Test assertions from lines 82-85
const assertions = [
  {
    type: "contains",
    value: "Sarah",
    description: "personalization check"
  },
  {
    type: "contains_or", 
    values: ["billing", "charge"],
    description: "relevance check"
  },
  {
    type: "contains_or",
    values: ["apologize", "sorry"],
    description: "empathy check"
  },
  {
    type: "length_min",
    value: 100,
    description: "completeness check"
  }
];

let passedAssertions = 0;
assertions.forEach((assertion, index) => {
  let passed = false;
  
  switch(assertion.type) {
    case "contains":
      passed = mockLLMResponse.toLowerCase().includes(assertion.value.toLowerCase());
      break;
    case "contains_or":
      passed = assertion.values.some(val => 
        mockLLMResponse.toLowerCase().includes(val.toLowerCase())
      );
      break;
    case "length_min":
      passed = mockLLMResponse.length >= assertion.value;
      break;
  }
  
  if (passed) {
    console.log(`   ✅ Assertion ${index + 1}: ${assertion.description} - PASSED`);
    passedAssertions++;
  } else {
    console.log(`   ❌ Assertion ${index + 1}: ${assertion.description} - FAILED`);
  }
});

console.log(`\n📊 Assertion Results: ${passedAssertions}/${assertions.length} passed`);

// Test 3: Variable Validation
console.log("\n3. Testing Variable Validation:");
const requiredVariables = ['company_name', 'customer_issue', 'customer_name', 'priority_level', 'response_style', 'tone'];
const foundVariables = [];

requiredVariables.forEach(variable => {
  if (tutorialTemplate.includes(`{{${variable}}}`)) {
    foundVariables.push(variable);
    console.log(`   ✅ Required variable ${variable}: Found`);
  } else {
    console.log(`   ❌ Required variable ${variable}: Missing`);
  }
});

console.log(`\n📊 Variable Coverage: ${foundVariables.length}/${requiredVariables.length} variables present`);

// Test Results Summary
const templateTest = foundVariables.length === requiredVariables.length;
const assertionTest = passedAssertions === assertions.length;
const overallResult = templateTest && assertionTest;

console.log("\n🎯 Tutorial 1 Test Results:");
console.log(`   Template Variables: ${templateTest ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Assertion Logic: ${assertionTest ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Overall: ${overallResult ? '✅ PASS' : '❌ FAIL'}`);

process.exit(overallResult ? 0 : 1);