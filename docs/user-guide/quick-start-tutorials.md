# Quick Start Tutorials

Get up and running quickly with these step-by-step tutorials designed for beginners.

## 🎯 Tutorial Overview

These tutorials will help you:
- **Set up your first workspace** in under 5 minutes
- **Create your first prompt card** with practical examples
- **Write effective test cases** that validate your prompts
- **Run tests and interpret results** for continuous improvement
- **Use advanced features** to optimize performance

## 📚 Tutorial 1: Your First Prompt Card (10 minutes)

### What You'll Learn
- How to create a prompt card from scratch
- Understanding variables and templates
- Adding meaningful descriptions and tags
- Basic testing concepts

### Step 1: Access the System
1. **Open your browser** and navigate to the system URL
2. **Log in** with your credentials
3. **Click "Prompt Cards"** in the main navigation
4. **Select "Create New Card"**

### Step 2: Create a Simple Prompt Card
Let's create a customer service response generator:

1. **Fill in the basic information:**
   ```
   Title: Customer Service Response
   Description: Generates professional customer service responses
   Tags: customer-service, support, communication
   ```

2. **Create the prompt template:**
   ```
   You are a helpful customer service representative for {{company_name}}.
   
   Customer Issue: {{customer_issue}}
   Customer Name: {{customer_name}}
   Priority Level: {{priority_level}}
   
   Please provide a {{response_style}} response that:
   - Acknowledges the customer's concern
   - Provides a helpful solution or next steps
   - Maintains a {{tone}} tone
   - Includes an appropriate closing
   ```

3. **Define variables:**
   - `company_name`: Your company name (default: "Acme Corp")
   - `customer_issue`: The customer's problem or question
   - `customer_name`: Customer's name for personalization
   - `priority_level`: urgent, high, normal, low
   - `response_style`: formal, friendly, brief, detailed
   - `tone`: professional, empathetic, solution-focused

4. **Click "Save"** to create your prompt card

### Step 3: Test Your Prompt
1. **Click "Add Test Case"** on your new prompt card
2. **Enter test case details:**
   ```
   Name: Billing Issue Response
   Description: Test response to a billing inquiry
   ```

3. **Set input variables:**
   ```
   company_name: "TechFlow Solutions"
   customer_issue: "I was charged twice for my monthly subscription"
   customer_name: "Sarah"
   priority_level: "high"
   response_style: "detailed"
   tone: "empathetic"
   ```

4. **Add assertions:**
   - **Contains**: "Sarah" (personalization check)
   - **Contains**: "billing" or "charge" (relevance check)
   - **Contains**: "apologize" or "sorry" (empathy check)
   - **Length**: Minimum 100 characters (completeness check)

5. **Click "Save Test Case"**

### Step 4: Run Your First Test
1. **Click "Run Test"** on your test case
2. **Watch the progress indicator** as the test executes
3. **Review the results:**
   - ✅ Green checkmarks indicate passed assertions
   - ❌ Red X's indicate failed assertions
   - View the actual LLM response
   - Check performance metrics (response time, token usage, cost)

### 🎉 Congratulations!
You've successfully created and tested your first prompt card!

## 📝 Tutorial 2: Advanced Test Cases (15 minutes)

### What You'll Learn
- Creating comprehensive test suites
- Using different assertion types
- Testing edge cases and error conditions
- Organizing test cases effectively

### Step 1: Add Multiple Test Cases
Let's add more test cases to thoroughly validate our customer service prompt:

#### Test Case 1: Technical Support Issue
```
Name: Technical Support Response
Input Variables:
  company_name: "TechFlow Solutions"
  customer_issue: "My software keeps crashing when I try to export reports"
  customer_name: "Mike"
  priority_level: "urgent"
  response_style: "detailed"
  tone: "solution-focused"

Assertions:
  - Contains: "Mike" (personalization)
  - Contains: "crash" or "export" or "report" (issue understanding)
  - Contains: "troubleshooting" or "steps" or "solution" (helpful response)
  - Regex: ".*\b(step|follow|try)\b.*" (actionable guidance)
  - Length: Min 150, Max 500 characters (appropriate detail level)
```

#### Test Case 2: Positive Feedback
```
Name: Positive Customer Feedback
Input Variables:
  customer_issue: "I wanted to thank you for the excellent service last week"
  customer_name: "Jennifer"
  priority_level: "normal"
  response_style: "friendly"
  tone: "professional"

Assertions:
  - Contains: "Jennifer" (personalization)
  - Contains: "thank" or "appreciate" (acknowledgment)
  - Contains: "team" or "pleasure" or "glad" (positive response)
  - Sentiment: "positive" with confidence > 0.8
  - Length: Min 50, Max 200 characters (appropriate for positive feedback)
```

#### Test Case 3: Edge Case - Angry Customer
```
Name: Escalated Customer Issue
Input Variables:
  customer_issue: "This is the third time I'm contacting you about this problem and no one has helped me!"
  customer_name: "Robert"
  priority_level: "urgent"
  response_style: "formal"
  tone: "empathetic"

Assertions:
  - Contains: "Robert" (personalization)
  - Contains: "understand" or "frustrat" or "apologize" (empathy)
  - Contains: "escalate" or "manager" or "resolve" (appropriate action)
  - Sentiment: "empathetic" or "understanding"
  - Length: Min 200 characters (thorough response needed)
```

### Step 2: Run All Tests
1. **Select all test cases** using the checkboxes
2. **Click "Run Selected Tests"**
3. **Monitor the batch execution** in real-time
4. **Review comprehensive results** in the summary view

### Step 3: Analyze Results
Look for patterns in the results:
- **Success Rate**: Are most tests passing?
- **Common Failures**: Which assertions fail most often?
- **Performance Patterns**: How do response times vary?
- **Cost Analysis**: Which test cases are most expensive?

### Step 4: Improve Based on Results
If tests are failing, consider:
- **Refining the prompt**: Add more specific instructions
- **Adjusting assertions**: Make them more or less strict
- **Adding examples**: Include few-shot examples in the prompt
- **Modifying variables**: Provide better default values

## 🔄 Tutorial 3: Prompt Optimization (20 minutes)

### What You'll Learn
- Using the analytics dashboard
- Identifying performance bottlenecks
- Optimizing for cost and quality
- A/B testing different prompt versions

### Step 1: Access Analytics
1. **Navigate to "Analytics"** from the main menu
2. **Select your prompt card** from the dropdown
3. **Set time range** to view recent performance
4. **Review key metrics:**
   - Success rate over time
   - Average response time
   - Token usage patterns
   - Cost per successful test

### Step 2: Identify Optimization Opportunities
Look for:
- **Low success rates** (< 90%): Need better prompts or assertions
- **High response times** (> 5 seconds): Prompt might be too complex
- **High token usage**: Prompt might be too verbose
- **High costs**: Consider more efficient models or shorter prompts

### Step 3: Create an Optimized Version
1. **Duplicate your prompt card** by clicking "Duplicate"
2. **Name it** "Customer Service Response - Optimized"
3. **Make improvements** based on your analysis:

   Original prompt had issues with verbosity. Here's an optimized version:
   ```
   As a {{company_name}} support representative, help {{customer_name}} with this {{priority_level}} priority issue:

   Issue: {{customer_issue}}

   Provide a {{response_style}}, {{tone}} response with:
   • Clear acknowledgment
   • Specific solution/next steps
   • Professional closing

   Keep response {{#if priority_level === 'urgent'}}detailed{{else}}concise{{/if}}.
   ```

### Step 4: A/B Test Your Improvements
1. **Copy test cases** from the original to the optimized version
2. **Run tests on both versions** simultaneously
3. **Compare results:**
   ```
   Metrics Comparison:
                     Original    Optimized   Improvement
   Success Rate:     85%         94%         +9%
   Avg Response:     4.2s        2.8s        -33%
   Avg Tokens:       245         180         -27%
   Cost per Test:    $0.012      $0.008      -33%
   ```

### Step 5: Deploy the Better Version
If the optimized version performs better:
1. **Mark as primary** version
2. **Archive the old version** for reference
3. **Update any automation** to use the new version
4. **Document the improvements** for team learning

## 📊 Tutorial 4: Team Collaboration (25 minutes)

### What You'll Learn
- Setting up team workspaces
- Inviting team members
- Collaborative prompt development
- Review and approval workflows

### Step 1: Create a Team Workspace
1. **Click "Workspaces"** in the navigation
2. **Select "Create Team Workspace"**
3. **Configure workspace:**
   ```
   Name: Marketing Team Prompts
   Description: Collaborative prompt development for marketing campaigns
   Visibility: Private
   Default Role: Contributor
   ```

### Step 2: Invite Team Members
1. **Click "Invite Members"**
2. **Add team member emails:**
   ```
   sarah@company.com (Editor)
   mike@company.com (Contributor) 
   jennifer@company.com (Reviewer)
   ```
3. **Send invitations** with welcome message

### Step 3: Collaborative Prompt Creation
Let's create a social media post generator together:

1. **Create new prompt card** in the team workspace:
   ```
   Title: Social Media Post Generator
   Description: Creates engaging social media content
   ```

2. **Use real-time collaboration:**
   - Sarah works on the main prompt template
   - Mike adds variable definitions
   - Jennifer creates test cases
   - Everyone can see changes in real-time

3. **Add comments and suggestions:**
   - Click anywhere in the prompt to add comments
   - Use @mentions to get specific feedback
   - Resolve discussions as issues are addressed

### Step 4: Review and Approval Process
1. **Request review** when prompt is ready:
   - Click "Request Review"
   - Select Jennifer as the reviewer
   - Add context about what needs review

2. **Review process:**
   - Jennifer receives notification
   - She reviews the prompt and test cases
   - Leaves feedback and suggestions
   - Approves or requests changes

3. **Address feedback:**
   - Make requested changes
   - Re-request review if needed
   - Mark as approved when ready

### Step 5: Monitor Team Performance
1. **Access team analytics:**
   - View team productivity metrics
   - See collaboration patterns
   - Track quality improvements
   - Monitor individual contributions

2. **Generate team reports:**
   - Weekly team activity summaries
   - Quality improvement trends
   - Collaboration effectiveness metrics

## 🎨 Tutorial 5: Advanced Features (30 minutes)

### What You'll Learn
- Using the sample prompt library
- Setting up automated testing
- Creating custom reports
- Integrating with external tools

### Step 1: Explore Sample Prompts
1. **Visit "Sample Prompts"** library
2. **Browse categories** relevant to your work
3. **Preview a template** that interests you:
   - Review the prompt structure
   - Check test results and ratings
   - Read user reviews and comments

4. **Import and customize:**
   - Click "Import to Workspace"
   - Modify variables for your use case
   - Add your own test cases
   - Run tests to validate performance

### Step 2: Set Up Automated Testing
1. **Configure scheduled tests:**
   ```json
   {
     "schedule": "daily",
     "time": "09:00",
     "timezone": "UTC",
     "prompts": ["customer-service", "social-media"],
     "notifications": {
       "email": "team@company.com",
       "slack": "#marketing-alerts"
     }
   }
   ```

2. **Set up performance alerts:**
   - Success rate drops below 90%
   - Response time exceeds 5 seconds
   - Cost increases by more than 20%

### Step 3: Create Custom Reports
1. **Access Report Builder:**
   - Navigate to "Reports" section
   - Click "Create Custom Report"

2. **Configure report parameters:**
   ```
   Report Name: Weekly Performance Summary
   Time Range: Last 7 days
   Include: Success rates, response times, costs
   Group By: Prompt card, team member
   Format: PDF with charts
   Recipients: Management team
   Schedule: Every Monday 9 AM
   ```

### Step 4: API Integration
Set up automation using the REST API:

```javascript
// Daily performance check
async function dailyHealthCheck() {
  const metrics = await api.analytics.getMetrics({
    timeRange: '24h',
    prompts: 'all'
  });
  
  if (metrics.successRate < 0.90) {
    await notificationService.alert({
      level: 'warning',
      message: `Success rate dropped to ${metrics.successRate}%`,
      channel: 'slack'
    });
  }
}

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
}
```

## 🎯 Next Steps After Tutorials

### Beginner Path (Week 1)
- ✅ Complete all 5 tutorials
- Create 3-5 prompt cards for your use cases
- Set up basic test cases
- Join team workspace and collaborate

### Intermediate Path (Week 2)
- Optimize existing prompts using analytics
- Set up automated testing schedule
- Create custom reports for stakeholders
- Contribute to sample prompt library

### Advanced Path (Week 3)
- Implement CI/CD integration
- Set up comprehensive monitoring
- Build custom integrations via API
- Lead team optimization efforts

### Getting Help
- **Documentation**: Comprehensive user guides
- **Community**: User forums and discussions
- **Support**: Help desk for technical issues
- **Training**: Live training sessions and webinars

## 📋 Tutorial Checklist

Track your progress through the tutorials:

### Tutorial 1: Your First Prompt Card ✅
- [ ] Created a prompt card with variables
- [ ] Added meaningful description and tags
- [ ] Created first test case with assertions
- [ ] Successfully ran and interpreted test results

### Tutorial 2: Advanced Test Cases ✅
- [ ] Created multiple test case types
- [ ] Used different assertion types
- [ ] Tested edge cases and error conditions
- [ ] Analyzed batch test results

### Tutorial 3: Prompt Optimization ✅
- [ ] Used analytics to identify issues
- [ ] Created optimized prompt version
- [ ] Performed A/B testing comparison
- [ ] Deployed improved version

### Tutorial 4: Team Collaboration ✅
- [ ] Set up team workspace
- [ ] Invited team members with roles
- [ ] Collaborated on prompt creation
- [ ] Completed review and approval process

### Tutorial 5: Advanced Features ✅
- [ ] Explored sample prompt library
- [ ] Set up automated testing
- [ ] Created custom reports
- [ ] Implemented API integration

## 🎉 Congratulations!

You've completed all the quick start tutorials and are now ready to use the Prompt Card System effectively! 

**What's Next?**
- Explore advanced features in depth
- Join the user community
- Contribute your own sample prompts
- Share your success stories with the team

---

**Need More Help?** Check out our comprehensive [User Guide](./README.md) or visit the [FAQ](../troubleshooting/faq.md) for answers to common questions.