#!/usr/bin/env node

/**
 * Test Tutorial 2: Advanced Test Cases
 * Testing multiple assertion types from lines 113-165
 */

console.log("🧪 Testing Tutorial 2: Advanced Test Cases");
console.log("==========================================");

// Test Case 1: Technical Support Issue (lines 113-129)
console.log("\n1. Testing Technical Support Test Case:");

const techSupportCase = {
  name: "Technical Support Response",
  inputs: {
    company_name: "TechFlow Solutions",
    customer_issue: "My software keeps crashing when I try to export reports",
    customer_name: "Mike",
    priority_level: "urgent",
    response_style: "detailed",
    tone: "solution-focused"
  },
  assertions: [
    { type: "contains", value: "Mike", description: "personalization" },
    { type: "contains_or", values: ["crash", "export", "report"], description: "issue understanding" },
    { type: "contains_or", values: ["troubleshooting", "steps", "solution"], description: "helpful response" },
    { type: "regex", pattern: ".*\\b(step|follow|try)\\b.*", description: "actionable guidance" },
    { type: "length_range", min: 150, max: 500, description: "appropriate detail level" }
  ]
};

const mockTechResponse = `Hi Mike,

I understand how frustrating it must be when the software crashes during report exports. Let me help you troubleshoot this issue step by step.

First, please try these troubleshooting steps:
1. Clear your browser cache and cookies
2. Try exporting a smaller report to test if it's a data volume issue
3. Check if the problem occurs with different report formats

If the crashes continue, please follow these additional steps:
- Update to the latest version of the software
- Try using a different browser
- Contact our technical team with the specific error message

I'll also escalate this to our development team to investigate potential solutions for the export functionality.

Please let me know if these steps resolve the issue or if you need further assistance.

Best regards,
Technical Support Team`;

// Test assertions for tech support case
let techPassed = 0;
techSupportCase.assertions.forEach((assertion, index) => {
  let passed = false;
  
  switch(assertion.type) {
    case "contains":
      passed = mockTechResponse.toLowerCase().includes(assertion.value.toLowerCase());
      break;
    case "contains_or":
      passed = assertion.values.some(val => 
        mockTechResponse.toLowerCase().includes(val.toLowerCase())
      );
      break;
    case "regex":
      const regex = new RegExp(assertion.pattern, 'gi');
      passed = regex.test(mockTechResponse);
      break;
    case "length_range":
      passed = mockTechResponse.length >= assertion.min && mockTechResponse.length <= assertion.max;
      break;
  }
  
  if (passed) {
    console.log(`   ✅ ${assertion.description}: PASSED`);
    techPassed++;
  } else {
    console.log(`   ❌ ${assertion.description}: FAILED`);
  }
});

console.log(`   📊 Results: ${techPassed}/${techSupportCase.assertions.length} assertions passed`);

// Test Case 2: Positive Feedback (lines 132-147)
console.log("\n2. Testing Positive Feedback Test Case:");

const positiveFeedbackCase = {
  name: "Positive Customer Feedback",
  inputs: {
    customer_issue: "I wanted to thank you for the excellent service last week",
    customer_name: "Jennifer",
    priority_level: "normal",
    response_style: "friendly",
    tone: "professional"
  },
  assertions: [
    { type: "contains", value: "Jennifer", description: "personalization" },
    { type: "contains_or", values: ["thank", "appreciate"], description: "acknowledgment" },
    { type: "contains_or", values: ["team", "pleasure", "glad"], description: "positive response" },
    { type: "sentiment", value: "positive", confidence: 0.8, description: "positive sentiment" },
    { type: "length_range", min: 50, max: 200, description: "appropriate for positive feedback" }
  ]
};

const mockPositiveResponse = `Hi Jennifer,

Thank you so much for taking the time to share your positive feedback! It's always a pleasure to hear when our team has provided excellent service. 

I'll make sure to pass along your kind words to the team members who assisted you last week. Your appreciation means a lot to all of us and motivates us to continue delivering great service.

Please don't hesitate to reach out if you need anything else in the future.

Best regards,
Customer Service Team`;

// Test assertions for positive feedback case
let positivePassed = 0;
positiveFeedbackCase.assertions.forEach((assertion, index) => {
  let passed = false;
  
  switch(assertion.type) {
    case "contains":
      passed = mockPositiveResponse.toLowerCase().includes(assertion.value.toLowerCase());
      break;
    case "contains_or":
      passed = assertion.values.some(val => 
        mockPositiveResponse.toLowerCase().includes(val.toLowerCase())
      );
      break;
    case "sentiment":
      // Mock sentiment analysis - in real implementation would use AI service
      const positiveWords = ["thank", "excellent", "pleasure", "great", "appreciate", "kind"];
      const wordCount = positiveWords.filter(word => 
        mockPositiveResponse.toLowerCase().includes(word)
      ).length;
      const confidence = wordCount / positiveWords.length;
      passed = confidence >= assertion.confidence;
      break;
    case "length_range":
      passed = mockPositiveResponse.length >= assertion.min && mockPositiveResponse.length <= assertion.max;
      break;
  }
  
  if (passed) {
    console.log(`   ✅ ${assertion.description}: PASSED`);
    positivePassed++;
  } else {
    console.log(`   ❌ ${assertion.description}: FAILED`);
  }
});

console.log(`   📊 Results: ${positivePassed}/${positiveFeedbackCase.assertions.length} assertions passed`);

// Test Case 3: Edge Case - Angry Customer (lines 149-165)
console.log("\n3. Testing Angry Customer Edge Case:");

const angryCustomerCase = {
  name: "Escalated Customer Issue", 
  inputs: {
    customer_issue: "This is the third time I'm contacting you about this problem and no one has helped me!",
    customer_name: "Robert",
    priority_level: "urgent", 
    response_style: "formal",
    tone: "empathetic"
  },
  assertions: [
    { type: "contains", value: "Robert", description: "personalization" },
    { type: "contains_or", values: ["understand", "frustrat", "apologize"], description: "empathy" },
    { type: "contains_or", values: ["escalate", "manager", "resolve"], description: "appropriate action" },
    { type: "sentiment", value: "empathetic", description: "empathetic sentiment" },
    { type: "length_min", value: 200, description: "thorough response needed" }
  ]
};

const mockAngryResponse = `Dear Robert,

I sincerely apologize for the frustration you've experienced and for the fact that this is your third attempt to get this issue resolved. I completely understand how disappointing and frustrating this must be for you.

Your concern is absolutely valid, and I want to ensure we resolve this properly this time. I'm immediately escalating your case to our senior support manager who will personally oversee the resolution process.

Here's what I'm doing right now:
1. Escalating to Senior Manager Sarah Johnson (she'll contact you within 2 hours)
2. Creating a priority case file with full history of your previous contacts
3. Ensuring this receives urgent attention until fully resolved

You should receive a call from Sarah Johnson before end of business today. She has the authority to resolve this issue and will ensure you receive the service level you deserve.

Thank you for your patience, and I apologize again for the inconvenience.

Sincerely,
Robert Chen
Senior Customer Service Representative`;

// Test assertions for angry customer case
let angryPassed = 0;
angryCustomerCase.assertions.forEach((assertion, index) => {
  let passed = false;
  
  switch(assertion.type) {
    case "contains":
      passed = mockAngryResponse.toLowerCase().includes(assertion.value.toLowerCase());
      break;
    case "contains_or":
      passed = assertion.values.some(val => 
        mockAngryResponse.toLowerCase().includes(val.toLowerCase())
      );
      break;
    case "sentiment":
      // Mock empathetic sentiment analysis
      const empatheticWords = ["apologize", "understand", "frustrat", "sincerely", "disappointing"];
      const empathyCount = empatheticWords.filter(word => 
        mockAngryResponse.toLowerCase().includes(word)
      ).length;
      passed = empathyCount >= 3; // High empathy threshold
      break;
    case "length_min":
      passed = mockAngryResponse.length >= assertion.value;
      break;
  }
  
  if (passed) {
    console.log(`   ✅ ${assertion.description}: PASSED`);
    angryPassed++;
  } else {
    console.log(`   ❌ ${assertion.description}: FAILED`);
  }
});

console.log(`   📊 Results: ${angryPassed}/${angryCustomerCase.assertions.length} assertions passed`);

// Overall Tutorial 2 Results
const totalAssertions = techSupportCase.assertions.length + positiveFeedbackCase.assertions.length + angryCustomerCase.assertions.length;
const totalPassed = techPassed + positivePassed + angryPassed;

console.log("\n🎯 Tutorial 2 Test Results:");
console.log(`   Technical Support Case: ${techPassed}/${techSupportCase.assertions.length} assertions passed`);
console.log(`   Positive Feedback Case: ${positivePassed}/${positiveFeedbackCase.assertions.length} assertions passed`);
console.log(`   Angry Customer Case: ${angryPassed}/${angryCustomerCase.assertions.length} assertions passed`);
console.log(`   Overall: ${totalPassed}/${totalAssertions} assertions passed (${Math.round(totalPassed/totalAssertions*100)}%)`);

const tutorial2Success = totalPassed === totalAssertions;
console.log(`   Result: ${tutorial2Success ? '✅ PASS' : '❌ FAIL'}`);

process.exit(tutorial2Success ? 0 : 1);