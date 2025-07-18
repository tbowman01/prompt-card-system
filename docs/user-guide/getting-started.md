# Getting Started

Welcome to the Prompt Card System! This guide will help you get up and running quickly.

## 🚀 Quick Start

### Step 1: Access the System
1. Open your web browser
2. Navigate to `http://localhost:3000` (or your configured URL)
3. You'll see the main dashboard

### Step 2: Create Your First Prompt Card
1. Click **"Prompt Cards"** in the navigation menu
2. Click **"Create New Card"**
3. Fill in the basic information:
   - **Title**: "My First Prompt"
   - **Description**: "A simple greeting prompt"
   - **Prompt Template**: "Hello {{name}}, how are you feeling today?"
4. Click **"Save"**

### Step 3: Add a Test Case
1. Open your newly created prompt card
2. Click **"Add Test Case"**
3. Fill in the test case details:
   - **Name**: "Friendly Greeting"
   - **Input Variables**: 
     - `name`: "Alice"
   - **Expected Output**: Should contain a greeting
4. Add an assertion:
   - **Type**: "contains"
   - **Value**: "Hello Alice"
5. Click **"Save Test Case"**

### Step 4: Run Your First Test
1. Click **"Run Tests"** button
2. Watch the real-time progress indicator
3. Review the results when complete

🎉 **Congratulations!** You've successfully created and tested your first prompt card.

## 📋 System Overview

### Dashboard
Your home base showing:
- Recent prompt cards
- Test execution summary
- Performance metrics
- Quick action buttons

### Navigation Menu
- **Dashboard**: Overview and recent activity
- **Prompt Cards**: Create and manage prompts
- **Analytics**: Performance insights and reporting
- **Settings**: System configuration

## 🔧 Initial Setup

### Configure LLM Provider
1. Go to **Settings** → **LLM Configuration**
2. Select your preferred provider:
   - **Ollama** (local, recommended for privacy)
   - **OpenAI** (cloud-based, requires API key)
   - **Anthropic** (cloud-based, requires API key)
3. Enter required credentials if using cloud providers
4. Test the connection

### Set Up Cost Tracking
1. Go to **Settings** → **Cost Tracking**
2. Configure your budget limits
3. Set up alert thresholds
4. Choose your preferred currency

## 🎯 Key Concepts

### Prompt Templates
Use `{{variable_name}}` syntax for dynamic content:
```
You are a {{role}} expert. Please {{task}} for {{subject}}.
```

### Variable Types
- **String**: Text input
- **Number**: Numeric values
- **Boolean**: True/false values
- **Array**: Lists of items

### Assertion Types
- **contains**: Check if output contains specific text
- **equals**: Exact match comparison
- **regex**: Pattern matching
- **length**: Output length validation
- **semantic-similarity**: AI-powered similarity checking
- **custom**: JavaScript-based custom validation

## 🔄 Typical Workflow

1. **Plan**: Define what you want your prompt to accomplish
2. **Create**: Build your prompt card with variables
3. **Test**: Write test cases covering different scenarios
4. **Execute**: Run tests and review results
5. **Optimize**: Use AI suggestions to improve performance
6. **Monitor**: Track metrics and costs over time

## 📊 Understanding Results

### Test Results
- ✅ **Passed**: All assertions succeeded
- ❌ **Failed**: One or more assertions failed
- ⚠️ **Partial**: Some assertions passed, others failed

### Performance Metrics
- **Response Time**: How long the LLM took to respond
- **Token Usage**: Number of tokens consumed
- **Cost**: Calculated cost for the request
- **Success Rate**: Percentage of tests that passed

## 🚀 Advanced Features Preview

### Analytics Dashboard
- Real-time performance monitoring
- Historical trend analysis
- Cost optimization insights
- Model performance comparison

### AI-Powered Optimization
- Get intelligent suggestions for prompt improvements
- Detect potential security vulnerabilities
- Optimize for better performance and lower costs

### Parallel Testing
- Run multiple tests simultaneously
- Faster feedback on large test suites
- Resource management and monitoring

## 🔧 Troubleshooting

### Common Issues

**Can't connect to LLM service**
- Check your internet connection
- Verify API credentials
- Ensure the LLM service is running

**Tests are running slowly**
- Check your internet speed
- Consider using a local LLM (Ollama)
- Enable parallel testing for faster execution

**Unexpected test results**
- Review your assertion criteria
- Check for typos in expected values
- Use the debug mode to see raw LLM responses

## 📚 Next Steps

Now that you've got the basics down, explore these areas:

1. **[Creating Prompt Cards](./prompt-cards.md)** - Learn advanced prompt creation techniques
2. **[Test Case Management](./test-cases.md)** - Master different types of test cases
3. **[Running Tests](./running-tests.md)** - Understand test execution options
4. **[Analytics Dashboard](./analytics.md)** - Dive into performance analytics

## 🎓 Learning Resources

### Video Tutorials
- Basic setup and first prompt card
- Advanced testing strategies
- Using the analytics dashboard
- API integration examples

### Sample Prompt Cards
- Customer service responses
- Code generation prompts
- Creative writing assistants
- Technical documentation

### Best Practices
- Writing effective test cases
- Optimizing for cost and performance
- Security considerations
- Scaling your testing workflow

---

**Need Help?** Check out our [troubleshooting guide](../troubleshooting/common-issues.md) or [FAQ](../troubleshooting/faq.md) for answers to common questions.