# Frequently Asked Questions (FAQ)

Find answers to the most common questions about using the Prompt Card System.

## 🚀 Getting Started

### Q: How do I create my first prompt card?
**A:** Follow these steps:
1. Navigate to "Prompt Cards" → "Create New Card"
2. Fill in the title and description
3. Write your prompt template using `{{variable}}` syntax
4. Define your variables and their types
5. Save the card and add test cases to validate it

### Q: What's the difference between a prompt card and a test case?
**A:** 
- **Prompt Card**: A template with variables that defines how to generate responses
- **Test Case**: Specific input values and expected outcomes to validate a prompt card's performance

### Q: Can I import existing prompts from other tools?
**A:** Yes! The system supports:
- **Text import**: Copy and paste from any source
- **JSON/YAML import**: Structured data import
- **Sample library**: Import from our curated collection
- **API import**: Programmatic import via REST API

## 💡 Prompt Development

### Q: How do I use variables in my prompts?
**A:** Use double curly braces: `{{variable_name}}`
```
Example: "Hello {{customer_name}}, thank you for contacting {{company_name}} about {{issue_type}}."
```

### Q: What variable types are supported?
**A:** The system supports:
- **String**: Text values
- **Number**: Numeric values  
- **Boolean**: True/false values
- **Array**: Lists of items
- **Object**: Complex structured data

### Q: How can I make my prompts more effective?
**A:** Best practices:
- Be specific and clear in your instructions
- Use examples (few-shot prompting) when possible
- Define the expected output format
- Set appropriate constraints and guidelines
- Test with diverse input scenarios

### Q: Can I use conditional logic in prompts?
**A:** Yes, using Handlebars syntax:
```
{{#if priority === 'urgent'}}
This requires immediate attention.
{{else}}
This will be handled within 24 hours.
{{/if}}
```

## 🧪 Testing and Validation

### Q: What types of assertions can I use?
**A:** Available assertion types:
- **Contains**: Check if output contains specific text
- **Equals**: Exact match comparison
- **Regex**: Pattern matching with regular expressions
- **Length**: Validate output length (min/max characters)
- **Semantic Similarity**: AI-powered similarity checking
- **Sentiment**: Emotional tone validation
- **Custom**: JavaScript-based custom validation
- **JSON Schema**: Structured data validation

### Q: How do I test edge cases?
**A:** Create test cases for:
- Empty or null inputs
- Very long inputs (boundary testing)
- Special characters and unicode
- Invalid data formats
- Extreme values (negative numbers, very large numbers)
- Unexpected input types

### Q: Why are my tests failing?
**A:** Common causes:
- **Assertion mismatch**: Output doesn't match expected criteria
- **Variable issues**: Missing or incorrect variable values
- **LLM inconsistency**: Different responses for same input
- **Timeout**: Test taking longer than configured limit
- **API errors**: Issues with LLM provider

**Debugging steps:**
1. Check raw LLM output in test results
2. Verify variable values are correct
3. Review assertion logic and thresholds
4. Test with simpler assertions first
5. Check system logs for errors

## ⚡ Performance and Optimization

### Q: How can I make my tests run faster?
**A:** Optimization strategies:
- **Enable parallel execution**: Run multiple tests simultaneously
- **Optimize prompts**: Reduce unnecessary verbosity
- **Use local models**: Ollama for faster, private inference
- **Batch testing**: Group related tests together
- **Caching**: Enable response caching for repeated tests

### Q: How do I reduce costs?
**A:** Cost optimization tips:
- **Choose efficient models**: Use smaller models when possible
- **Optimize token usage**: Write concise but effective prompts
- **Monitor spending**: Set up cost alerts and budgets
- **Use local models**: Ollama eliminates per-token costs
- **Cache results**: Avoid repeated identical requests

### Q: What affects response time?
**A:** Factors influencing performance:
- **Prompt length**: Longer prompts take more time to process
- **Model choice**: Some models are faster than others
- **LLM provider**: Different providers have varying response times
- **Network latency**: Distance to LLM provider servers
- **System load**: Current usage levels affect performance

## 🏢 Team Collaboration

### Q: How do I invite team members?
**A:** Steps to add team members:
1. Go to your workspace settings
2. Click "Invite Members"
3. Enter email addresses and select roles
4. Send invitations with optional welcome message
5. Track invitation status and resend if needed

### Q: What are the different user roles?
**A:** Role hierarchy:
- **Owner**: Full control, can delete workspace
- **Admin**: Manage users and settings, full content access
- **Editor**: Create, edit, delete content, run tests
- **Contributor**: Create/edit own content, comment on others'
- **Viewer**: Read-only access with commenting ability

### Q: Can multiple people edit the same prompt card?
**A:** Yes! The system supports real-time collaboration:
- See live cursors showing where others are working
- Changes appear instantly for all collaborators
- Automatic conflict resolution prevents data loss
- Comments and discussions attached to specific content
- Version history tracks all changes and contributors

### Q: How does version control work?
**A:** Version control features:
- **Automatic versioning**: Every save creates a new version
- **Change tracking**: Complete history of modifications
- **Author attribution**: See who made each change
- **Rollback capability**: Revert to any previous version
- **Branching**: Work on different versions simultaneously
- **Merge support**: Combine changes from different branches

## 🔒 Security and Privacy

### Q: How secure is my data?
**A:** Security measures include:
- **Encryption**: All data encrypted in transit and at rest
- **Access controls**: Role-based permissions and restrictions
- **Audit logging**: Complete record of all system access
- **SOC 2 compliance**: Industry-standard security practices
- **Regular security updates**: Ongoing security maintenance

### Q: Can I use this with sensitive data?
**A:** Yes, with precautions:
- **Use local models**: Ollama keeps data completely private
- **Configure access controls**: Limit who can see sensitive content
- **Enable audit logging**: Track all access to sensitive data
- **Review sharing settings**: Ensure content isn't accidentally shared
- **Consider compliance**: Check regulatory requirements

### Q: How do I control who sees what?
**A:** Access control options:
- **Workspace permissions**: Control who can access workspaces
- **Content-level security**: Set permissions on individual items
- **Sharing controls**: Manage public links and external sharing
- **IP restrictions**: Limit access by location
- **Device management**: Control which devices can access the system

## 🔗 Integrations

### Q: What external tools can I integrate with?
**A:** Supported integrations:
- **Slack**: Notifications and discussions
- **GitHub**: Version control and issue tracking
- **Jira**: Project management integration
- **Webhook support**: Custom integrations with any system
- **REST API**: Full programmatic access
- **Monitoring tools**: Prometheus, Grafana, New Relic

### Q: How do I set up API access?
**A:** API setup steps:
1. Generate API key in Settings → API
2. Configure authentication (API key, OAuth, or JWT)
3. Review API documentation and examples
4. Test endpoints with your preferred HTTP client
5. Implement in your application or scripts

### Q: Can I export my data?
**A:** Yes, multiple export options:
- **Individual items**: Export specific prompt cards or test results
- **Bulk export**: Export entire workspaces or categories
- **Multiple formats**: JSON, CSV, YAML, PDF
- **API export**: Programmatic data access
- **Scheduled exports**: Automatic regular backups

## 📊 Analytics and Reporting

### Q: What metrics can I track?
**A:** Available metrics:
- **Performance**: Response times, success rates, throughput
- **Cost**: Token usage, spending trends, cost per test
- **Quality**: Error rates, assertion success rates
- **Usage**: User activity, popular prompts, system utilization
- **Business**: ROI, productivity improvements, cost savings

### Q: How do I create custom reports?
**A:** Report creation process:
1. Navigate to Reports → Create Custom Report
2. Select data sources and metrics
3. Choose visualization types (charts, tables, graphs)
4. Configure filters and date ranges
5. Set up recipients and delivery schedule
6. Preview and publish the report

### Q: Can I set up alerts?
**A:** Yes, configurable alerts for:
- **Performance issues**: Slow response times, high error rates
- **Cost thresholds**: Budget limits, spending spikes
- **Quality problems**: Low success rates, failing tests
- **System issues**: Service outages, resource constraints
- **Business metrics**: SLA breaches, capacity limits

## 🛠️ Troubleshooting

### Q: The system is running slowly. What should I check?
**A:** Performance troubleshooting:
1. **Check system status**: Look for any reported outages
2. **Review resource usage**: CPU, memory, network utilization
3. **Monitor test queue**: High queue depth indicates overload
4. **Check LLM provider status**: External service issues
5. **Review recent changes**: New configurations affecting performance
6. **Contact support**: If issues persist

### Q: I'm getting API errors. How do I fix them?
**A:** API error resolution:
- **401 Unauthorized**: Check API key validity and permissions
- **429 Rate Limited**: Reduce request frequency or upgrade limits
- **500 Internal Error**: Check system logs, contact support
- **Timeout errors**: Increase timeout settings or optimize requests
- **Network errors**: Check internet connectivity and firewall settings

### Q: My LLM provider isn't working. What now?
**A:** Provider troubleshooting steps:
1. **Check API credentials**: Ensure keys are valid and active
2. **Verify endpoint URLs**: Confirm provider settings
3. **Test connectivity**: Direct API calls to provider
4. **Check rate limits**: May be hitting usage restrictions  
5. **Review provider status**: Check their service status page
6. **Try fallback providers**: Switch to alternative providers

## 💰 Pricing and Billing

### Q: How much does it cost to run tests?
**A:** Cost factors:
- **LLM provider costs**: Varies by provider and model
- **Token usage**: Based on input and output length
- **Test frequency**: More tests = higher costs
- **Model choice**: Premium models cost more
- **Local models**: Ollama has no per-token costs

### Q: Can I set spending limits?
**A:** Yes, budget controls include:
- **User limits**: Per-user spending restrictions
- **Workspace budgets**: Team spending limits
- **Project budgets**: Per-project cost controls
- **Alert thresholds**: Notifications before reaching limits
- **Automatic stops**: Halt testing when budgets exceeded

### Q: How do I optimize costs?
**A:** Cost optimization strategies:
- **Use appropriate models**: Don't use GPT-4 for simple tasks
- **Optimize prompts**: Reduce unnecessary tokens
- **Batch operations**: Group similar tests together
- **Cache results**: Avoid repeated identical requests
- **Monitor usage**: Regular cost analysis and optimization

## 🆘 Getting Additional Help

### Q: Where can I find more documentation?
**A:** Documentation resources:
- **User Guide**: Comprehensive usage documentation
- **API Reference**: Complete API documentation
- **Video Tutorials**: Step-by-step video guides
- **Best Practices**: Optimization and usage tips
- **Release Notes**: Latest feature updates

### Q: How do I contact support?
**A:** Support channels:
- **Help Center**: Self-service support portal
- **Email Support**: Direct email to support team
- **Community Forum**: User community discussions
- **Live Chat**: Real-time support during business hours
- **Priority Support**: Available for enterprise customers

### Q: Can I request new features?
**A:** Yes! Feature request process:
1. Check existing feature requests to avoid duplicates
2. Submit detailed feature request with use cases
3. Community voting helps prioritize requests
4. Development team reviews and provides timeline
5. Updates provided on implementation progress

### Q: Is training available?
**A:** Training options:
- **Self-paced tutorials**: Built-in interactive guides
- **Live webinars**: Regular training sessions
- **Custom training**: Tailored sessions for teams
- **Certification program**: Formal skills validation
- **Documentation**: Comprehensive written guides

## 📱 Mobile and Offline Usage

### Q: Is there a mobile app?
**A:** Mobile access options:
- **Responsive web app**: Works on all mobile browsers
- **Native mobile app**: Available for iOS and Android
- **Offline capabilities**: Limited functionality when offline
- **Mobile notifications**: Push notifications for alerts
- **Optimized interface**: Touch-friendly mobile UI

### Q: Can I work offline?
**A:** Limited offline functionality:
- **View existing content**: Access downloaded prompt cards
- **Edit prompts**: Make changes that sync when online
- **Review history**: Access previously loaded data
- **No testing**: LLM requests require internet connection
- **Auto-sync**: Changes sync automatically when reconnected

---

**Still have questions?** 
- Check our [Troubleshooting Guide](../troubleshooting/common-issues.md)
- Visit the [User Community Forum](https://community.promptcards.io)
- Contact our [Support Team](mailto:support@promptcards.io)