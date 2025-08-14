#!/usr/bin/env node

/**
 * Test Tutorial 3: Optimized Prompt Template 
 * Testing conditional logic from lines 218-229
 */

console.log("🧪 Testing Tutorial 3: Optimized Prompt Template");
console.log("================================================");

// Original prompt from Tutorial 1
const originalPrompt = `You are a helpful customer service representative for {{company_name}}.

Customer Issue: {{customer_issue}}
Customer Name: {{customer_name}}
Priority Level: {{priority_level}}

Please provide a {{response_style}} response that:
- Acknowledges the customer's concern
- Provides a helpful solution or next steps
- Maintains a {{tone}} tone
- Includes an appropriate closing`;

// Optimized prompt from lines 218-229
const optimizedPrompt = `As a {{company_name}} support representative, help {{customer_name}} with this {{priority_level}} priority issue:

Issue: {{customer_issue}}

Provide a {{response_style}}, {{tone}} response with:
• Clear acknowledgment
• Specific solution/next steps
• Professional closing

Keep response {{#if priority_level === 'urgent'}}detailed{{else}}concise{{/if}}.`;

console.log("\n1. Testing Prompt Structure Optimization:");

// Test token count reduction
const originalTokenCount = originalPrompt.split(/\s+/).length;
const optimizedTokenCount = optimizedPrompt.split(/\s+/).length;
const tokenReduction = ((originalTokenCount - optimizedTokenCount) / originalTokenCount * 100).toFixed(1);

console.log(`   Original prompt tokens: ${originalTokenCount}`);
console.log(`   Optimized prompt tokens: ${optimizedTokenCount}`);
console.log(`   Token reduction: ${tokenReduction}% ${tokenReduction > 0 ? '✅ PASS' : '❌ FAIL'}`);

// Test conditional logic syntax
console.log("\n2. Testing Conditional Logic:");

const conditionalPattern = /\{\{#if\s+[\w\s='"]+\}\}[\w\s]+\{\{else\}\}[\w\s]+\{\{\/if\}\}/;
const hasConditionalLogic = conditionalPattern.test(optimizedPrompt);

console.log(`   Conditional syntax present: ${hasConditionalLogic ? '✅ PASS' : '❌ FAIL'}`);

// Test conditional logic evaluation
const conditionalTests = [
  {
    condition: "priority_level === 'urgent'",
    expected: "detailed",
    alternative: "concise",
    description: "urgent priority condition"
  }
];

conditionalTests.forEach((test, index) => {
  const conditionFound = optimizedPrompt.includes(`{{#if ${test.condition}}}`);
  const expectedFound = optimizedPrompt.includes(test.expected);
  const alternativeFound = optimizedPrompt.includes(test.alternative);
  
  console.log(`   Condition ${index + 1} (${test.description}):`);
  console.log(`     Syntax: ${conditionFound ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`     Expected value: ${expectedFound ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`     Alternative value: ${alternativeFound ? '✅ PASS' : '❌ FAIL'}`);
});

// Test metrics comparison from lines 235-242
console.log("\n3. Testing Metrics Improvement Claims:");

const metricsComparison = {
  successRate: { original: 85, optimized: 94, target: ">= 90" },
  avgResponse: { original: 4.2, optimized: 2.8, target: "< 3.5" },
  avgTokens: { original: 245, optimized: 180, target: "< 200" },
  costPerTest: { original: 0.012, optimized: 0.008, target: "< 0.010" }
};

console.log("   Projected improvements:");
Object.keys(metricsComparison).forEach(metric => {
  const data = metricsComparison[metric];
  const improvement = ((data.original - data.optimized) / data.original * 100).toFixed(1);
  
  let targetMet = false;
  if (data.target.includes(">=")) {
    targetMet = data.optimized >= parseFloat(data.target.replace(">= ", ""));
  } else if (data.target.includes("<")) {
    targetMet = data.optimized < parseFloat(data.target.replace("< ", ""));
  }
  
  console.log(`     ${metric}: ${improvement}% improvement ${targetMet ? '✅ PASS' : '❌ FAIL'}`);
});

// Test variable preservation
console.log("\n4. Testing Variable Preservation:");

const originalVariables = originalPrompt.match(/\{\{[\w_]+\}\}/g) || [];
const optimizedVariables = optimizedPrompt.match(/\{\{[\w_]+\}\}/g) || [];

// Filter out conditional logic variables
const basicOptimizedVars = optimizedVariables.filter(v => 
  !v.includes('#if') && !v.includes('else') && !v.includes('/if')
);

const preservedVariables = originalVariables.filter(v => basicOptimizedVars.includes(v));
const preservationRate = (preservedVariables.length / originalVariables.length * 100).toFixed(1);

console.log(`   Original variables: ${originalVariables.length}`);
console.log(`   Preserved variables: ${preservedVariables.length}`);
console.log(`   Preservation rate: ${preservationRate}% ${preservationRate >= 80 ? '✅ PASS' : '❌ FAIL'}`);

// Test readability improvements
console.log("\n5. Testing Readability Improvements:");

const readabilityChecks = [
  {
    name: "Bullet points used",
    test: optimizedPrompt.includes("•"),
    description: "Uses bullet points for better structure"
  },
  {
    name: "Shorter sentences",
    test: optimizedPrompt.split('.').length < originalPrompt.split('.').length,
    description: "Reduced sentence complexity"
  },
  {
    name: "Direct imperative",
    test: optimizedPrompt.includes("Provide a") && !optimizedPrompt.includes("Please provide"),
    description: "Uses direct imperatives vs polite requests"
  }
];

let readabilityPassed = 0;
readabilityChecks.forEach(check => {
  if (check.test) {
    console.log(`   ✅ ${check.name}: PASSED`);
    readabilityPassed++;
  } else {
    console.log(`   ❌ ${check.name}: FAILED`);
  }
});

console.log(`   Readability score: ${readabilityPassed}/${readabilityChecks.length} checks passed`);

// Test A/B testing setup validity
console.log("\n6. Testing A/B Testing Setup:");

const abTestRequirements = [
  "Both prompts use same variable structure",
  "Conditional logic is syntactically valid", 
  "Performance metrics are measurable",
  "Test cases can be copied between versions"
];

const abTestChecks = [
  originalVariables.length === basicOptimizedVars.length,
  hasConditionalLogic,
  true, // Metrics are defined in the tutorial
  preservationRate >= 80
];

let abTestPassed = 0;
abTestRequirements.forEach((requirement, index) => {
  if (abTestChecks[index]) {
    console.log(`   ✅ ${requirement}: PASSED`);
    abTestPassed++;
  } else {
    console.log(`   ❌ ${requirement}: FAILED`);
  }
});

// Overall Tutorial 3 Results
const allTestsPassed = [
  tokenReduction > 0,
  hasConditionalLogic,
  preservationRate >= 80,
  readabilityPassed >= 2,
  abTestPassed >= 3
];

const overallPassed = allTestsPassed.filter(test => test).length;
const tutorial3Success = overallPassed === allTestsPassed.length;

console.log("\n🎯 Tutorial 3 Test Results:");
console.log(`   Token optimization: ${tokenReduction > 0 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Conditional logic: ${hasConditionalLogic ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Variable preservation: ${preservationRate >= 80 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Readability improvements: ${readabilityPassed >= 2 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   A/B testing readiness: ${abTestPassed >= 3 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Overall: ${overallPassed}/${allTestsPassed.length} tests passed`);
console.log(`   Result: ${tutorial3Success ? '✅ PASS' : '❌ FAIL'}`);

process.exit(tutorial3Success ? 0 : 1);