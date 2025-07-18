# Frequently Asked Questions

Common questions and answers about the Prompt Card System.

## 🚀 Getting Started

### Q: What is the Prompt Card System?
**A:** The Prompt Card System is an enterprise-grade platform for systematic LLM testing and development. It provides a comprehensive environment for creating, testing, and optimizing prompts with advanced features like analytics, cost tracking, and AI-powered optimization.

### Q: Do I need technical knowledge to use the system?
**A:** The system is designed for both technical and non-technical users. The web interface is user-friendly, but advanced features like custom assertions and API integration require some technical knowledge.

### Q: What LLM providers are supported?
**A:** The system supports:
- **Ollama** (local, recommended for privacy)
- **OpenAI** (GPT-3.5, GPT-4, etc.)
- **Anthropic** (Claude models)
- **Custom providers** via API integration

### Q: Can I use the system offline?
**A:** Yes, with Ollama you can run the system completely offline. However, cloud-based features like advanced analytics and AI optimization require internet connectivity.

## 🔧 Installation & Setup

### Q: What are the system requirements?
**A:** Minimum requirements:
- **CPU**: 2+ cores (4+ recommended)
- **RAM**: 4GB (8GB+ recommended)
- **Storage**: 20GB+ free space
- **OS**: Windows, macOS, or Linux
- **Software**: Docker and Docker Compose

### Q: How do I install the system?
**A:** Follow these steps:
1. Clone the repository
2. Install Docker and Docker Compose
3. Run `docker-compose up -d`
4. Access the web interface at `http://localhost:3000`

See the [installation guide](../admin/installation.md) for detailed instructions.

### Q: Can I install on Windows?
**A:** Yes, the system works on Windows with Docker Desktop. Make sure to enable WSL 2 backend for better performance.

### Q: How do I update to the latest version?
**A:** To update:
1. Pull the latest code: `git pull origin main`
2. Rebuild containers: `docker-compose build`
3. Restart services: `docker-compose up -d`
4. Run migrations: `docker-compose exec backend npm run migrate`

## 🎯 Usage Questions

### Q: How do I create my first prompt card?
**A:** 
1. Click "Prompt Cards" in the navigation
2. Click "Create New Card"
3. Enter title, description, and prompt template
4. Use `{{variable_name}}` syntax for variables
5. Save the card

### Q: What are test cases and why do I need them?
**A:** Test cases validate that your prompts work correctly. They include:
- Input variables with specific values
- Expected outcomes or validation criteria
- Assertions that check the LLM response

Test cases help ensure your prompts are reliable and perform as expected.

### Q: What types of assertions are available?
**A:** The system supports multiple assertion types:
- **Contains**: Check if output contains specific text
- **Equals**: Exact match comparison
- **Regex**: Pattern matching
- **Length**: Output length validation
- **Semantic similarity**: AI-powered similarity checking
- **Custom**: JavaScript-based custom validation
- **JSON schema**: Structured data validation
- **Sentiment**: Emotional tone detection

### Q: How do I run tests in parallel?
**A:** Parallel execution is enabled by default. The system automatically:
- Optimizes concurrency based on system resources
- Manages resource allocation
- Provides real-time progress tracking

You can configure parallel execution in the settings.

## 📊 Analytics & Reporting

### Q: What metrics are tracked?
**A:** The system tracks:
- **Performance**: Response times, success rates, throughput
- **Cost**: Token usage, spending by model, budget utilization
- **Usage**: Popular prompts, model usage, user activity
- **Quality**: Test pass rates, error patterns, improvements

### Q: How do I generate reports?
**A:** To generate reports:
1. Go to the Analytics dashboard
2. Select the report type (executive, technical, cost analysis)
3. Choose date range and filters
4. Click "Generate Report"
5. Export in PDF, Excel, or CSV format

### Q: Can I schedule automatic reports?
**A:** Yes, you can set up automated reports:
- Daily summaries
- Weekly trends
- Monthly reviews
- Custom schedules

Configure in Settings → Reports → Automation.

## 💰 Cost Management

### Q: How does cost tracking work?
**A:** The system tracks:
- Token usage for each LLM call
- Calculates costs based on provider pricing
- Provides real-time spending updates
- Offers budget alerts and recommendations

### Q: Which LLM providers have cost tracking?
**A:** Cost tracking is available for:
- **OpenAI**: All models with current pricing
- **Anthropic**: Claude models
- **Custom providers**: With manual pricing configuration
- **Ollama**: Local usage (no external costs)

### Q: How can I reduce costs?
**A:** Cost optimization strategies:
- Use the AI optimization suggestions
- Optimize prompts for shorter responses
- Choose cost-effective models
- Use local models (Ollama) when possible
- Monitor usage patterns and adjust accordingly

## 🔒 Security & Privacy

### Q: Is my data secure?
**A:** Yes, the system includes:
- **Encryption**: Data encrypted at rest and in transit
- **Authentication**: Secure user authentication
- **Access control**: Role-based permissions
- **Audit logging**: Complete audit trail
- **Privacy**: No data sent to external services without consent

### Q: Can I use the system with sensitive data?
**A:** Yes, especially with local deployment and Ollama:
- All data stays on your servers
- No external API calls required
- Full control over data handling
- Compliance with data protection regulations

### Q: What about prompt injection attacks?
**A:** The system includes:
- **Detection**: AI-powered prompt injection detection
- **Prevention**: Input validation and sanitization
- **Alerts**: Real-time security alerts
- **Mitigation**: Automatic security recommendations

## 🛠️ Technical Questions

### Q: Can I integrate with my existing systems?
**A:** Yes, the system provides:
- **REST API**: Complete API for all functionality
- **Webhooks**: Real-time notifications
- **SDKs**: JavaScript, Python, and other languages
- **Export/Import**: YAML compatibility with other tools

### Q: How do I backup my data?
**A:** For backups:
- **Automatic**: Built-in backup functionality
- **Manual**: Database export tools
- **Cloud**: Integration with cloud storage
- **Scheduled**: Automated backup schedules

### Q: Can I customize the interface?
**A:** Yes, customization options include:
- **Themes**: Light/dark mode
- **Branding**: Company logos and colors
- **Layouts**: Dashboard customization
- **Widgets**: Custom metric displays

### Q: What if I need more advanced features?
**A:** For advanced needs:
- **Custom assertions**: JavaScript-based validation
- **API integration**: Extend functionality
- **Plugin system**: Custom extensions
- **Enterprise features**: Contact for advanced licensing

## 🔧 Troubleshooting

### Q: The system won't start. What should I do?
**A:** Common solutions:
1. Check Docker is running: `docker ps`
2. Check port conflicts: `netstat -tulpn | grep 3000`
3. Check disk space: `df -h`
4. Review logs: `docker-compose logs`

See the [troubleshooting guide](./common-issues.md) for more help.

### Q: Tests are running slowly. How can I speed them up?
**A:** Performance improvements:
- Enable parallel execution
- Use local models (Ollama)
- Optimize prompts for shorter responses
- Check system resources
- Use caching when available

### Q: The frontend can't connect to the backend. What's wrong?
**A:** Check these:
1. Backend is running: `curl http://localhost:3001/api/health`
2. CORS configuration: Check `CORS_ORIGIN` in backend/.env
3. Environment variables: Verify `NEXT_PUBLIC_API_URL`
4. Network connectivity: Test connection between containers

### Q: How do I reset the system?
**A:** To reset:
1. Stop services: `docker-compose down`
2. Remove volumes: `docker-compose down -v`
3. Remove data: `rm -rf backend/data/*`
4. Restart: `docker-compose up -d`

**Warning**: This will delete all data. Make sure you have backups!

## 📚 Learning & Support

### Q: Where can I learn more?
**A:** Learning resources:
- **Documentation**: Comprehensive guides and tutorials
- **Examples**: Sample prompt cards and test cases
- **Video tutorials**: Step-by-step walkthroughs
- **Best practices**: Guidelines for effective usage

### Q: How do I get support?
**A:** Support options:
- **Documentation**: Check the troubleshooting guide
- **Community**: Join the community forum
- **GitHub**: Report issues and request features
- **Enterprise**: Contact for enterprise support

### Q: Can I contribute to the project?
**A:** Yes! We welcome contributions:
- **Bug reports**: Report issues on GitHub
- **Feature requests**: Suggest new features
- **Code contributions**: Submit pull requests
- **Documentation**: Help improve documentation

### Q: Is there a community?
**A:** Yes, join our community:
- **GitHub Discussions**: Ask questions and share ideas
- **Discord**: Real-time chat with other users
- **Stack Overflow**: Tag questions with `prompt-card-system`
- **Reddit**: Community discussions and tips

## 🎓 Best Practices

### Q: What are the best practices for prompt design?
**A:** Key principles:
- **Clear instructions**: Be specific and detailed
- **Consistent format**: Use templates and patterns
- **Variable usage**: Use meaningful variable names
- **Testing**: Create comprehensive test cases
- **Iteration**: Continuously improve based on results

### Q: How should I organize my prompt cards?
**A:** Organization tips:
- **Naming**: Use descriptive, consistent names
- **Tags**: Add relevant tags for categorization
- **Folders**: Group related prompts together
- **Documentation**: Include clear descriptions
- **Versioning**: Track changes and improvements

### Q: What makes a good test case?
**A:** Effective test cases:
- **Cover edge cases**: Test boundary conditions
- **Multiple scenarios**: Test different use cases
- **Clear assertions**: Specific validation criteria
- **Meaningful data**: Realistic input values
- **Regular updates**: Keep tests current

---

**Still have questions?** Check the [common issues guide](./common-issues.md) or contact our support team.