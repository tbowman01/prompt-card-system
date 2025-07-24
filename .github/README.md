# 🤖 GitHub Workflow Automation System

## Overview

This repository includes a comprehensive GitHub workflow automation system designed for efficient issue tracking, development management, and project coordination. The system automatically triages issues, manages development workflows, and provides intelligent reporting.

## 🎯 Features

### 🔍 Automated Issue Triage
- **Intelligent Labeling**: Automatically assigns priority, type, and component labels based on issue content
- **Smart Prioritization**: Detects critical issues and escalates appropriately
- **Component Detection**: Identifies which parts of the system are affected
- **Team Assignment**: Routes issues to appropriate team members
- **Status Tracking**: Maintains issue lifecycle status

### 🚀 Development Workflow Automation
- **Branch Creation**: Automatically creates feature branches for approved issues
- **Development Checklists**: Generates customized checklists based on issue type
- **PR Integration**: Links pull requests to issues and manages status updates
- **Quality Gates**: Enforces code quality and testing requirements
- **Automated Cleanup**: Manages branch lifecycle and cleanup

### 📊 Project Board Integration
- **Smart Board Management**: Automatically adds high-priority items to project boards
- **Status Synchronization**: Keeps board columns in sync with issue status
- **Progress Tracking**: Provides real-time visibility into development progress
- **Performance Metrics**: Tracks resolution times and team velocity

### 📈 Monitoring & Reporting
- **Daily Summaries**: Automated daily issue activity reports
- **Weekly Reviews**: Comprehensive weekly performance analysis
- **Stale Issue Management**: Identifies and manages inactive issues
- **Performance Analytics**: Tracks team productivity and bottlenecks

## 📋 Workflow Files

### Core Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `issue-triage.yml` | Issue opened/edited | Auto-label and triage new issues |
| `development-kickoff.yml` | Issue labeled as ready | Start development process |
| `project-board-automation.yml` | Issue/PR events | Manage project board automation |
| `issue-monitoring.yml` | Schedule + Manual | Generate reports and manage stale issues |
| `labels-sync.yml` | Label changes | Synchronize repository labels |

### Issue Templates

| Template | Purpose | Labels |
|----------|---------|---------|
| `bug_report.yml` | Bug reports | `type:bug`, `status:triage`, `priority:medium` |
| `feature_request.yml` | Feature requests | `type:feature`, `status:triage`, `priority:medium` |
| `security_report.yml` | Security issues | `type:security`, `priority:high`, `status:triage` |

## 🏷️ Label System

### Label Categories

**Priority Levels:**
- `priority:critical` 🔴 - Immediate attention required
- `priority:high` 🟡 - Important issue
- `priority:medium` 🟢 - Normal priority
- `priority:low` ⚪ - Nice to have

**Issue Types:**
- `type:bug` 🐛 - Something isn't working
- `type:feature` ✨ - New feature or enhancement
- `type:documentation` 📚 - Documentation improvements
- `type:security` 🛡️ - Security related
- `type:performance` ⚡ - Performance improvement
- `type:testing` 🧪 - Testing improvements

**Components:**
- `component:frontend` ⚛️ - React/Next.js frontend
- `component:backend` 🖥️ - Node.js/Express backend
- `component:database` 🗄️ - Database related
- `component:api` 🔌 - API endpoints
- `component:infrastructure` 🐳 - Docker/Infrastructure

**Status Tracking:**
- `status:triage` 🔍 - Needs initial review
- `status:ready` ✅ - Ready for development
- `status:in-progress` 🔄 - Being worked on
- `status:review` 👀 - Under review
- `status:blocked` ⛔ - Blocked by dependencies
- `status:needs-info` ❓ - Waiting for information

## 🚀 Quick Start

### 1. Enable GitHub Actions
All workflows are ready to use once this repository structure is in place.

### 2. Configure Repository Settings
- Enable Issues and Projects in repository settings
- Ensure Actions have write permissions for issues and pull requests
- Configure branch protection rules if desired

### 3. Create Project Board (Optional)
- Create a GitHub Projects board
- Set up columns: Triage, Ready, In Progress, Review, Done
- Workflows will reference these columns

### 4. Team Configuration
Edit workflows to add team member assignments:

```yaml
# In issue-triage.yml, update team assignments
if (labels.includes('component:frontend')) {
  assignees.push('frontend-team-lead');
}
```

## 📊 Usage Examples

### Issue Commands
Use these slash commands in issue comments to trigger actions:

- `/priority critical` - Change priority to critical
- `/priority high` - Change priority to high
- `/in-progress` - Mark as in progress
- `/ready` - Mark as ready for development
- `/blocked` - Mark as blocked
- `/needs-info` - Request more information

### Automatic Triggers

**New Issue Opened:**
1. Auto-labels based on title/content
2. Assigns priority level
3. Routes to appropriate team
4. Adds to project board if high priority

**Issue Marked Ready:**
1. Creates development branch
2. Generates development checklist
3. Updates status to in-progress
4. Notifies assigned developer

**PR Created:**
1. Links to related issue
2. Updates issue status to review
3. Adds to review column
4. Triggers quality checks

## 📈 Reports & Monitoring

### Daily Summary (5 PM UTC)
- New and closed issues count
- Priority distribution
- Critical issues requiring attention
- Blocked issues list
- Old issues (30+ days)

### Weekly Review (Monday 9 AM UTC)
- Comprehensive weekly performance analysis
- Team activity metrics
- Component activity breakdown
- Resolution time analysis
- Automated recommendations

### Stale Issue Management
- Marks issues stale after 30 days of inactivity
- Auto-closes stale issues after 7 additional days
- Protects critical issues from auto-closure
- Provides notifications before closure

## ⚙️ Configuration

### Environment Variables
No special environment variables required - uses `GITHUB_TOKEN` automatically.

### Repository Secrets
For advanced features, you may want to configure:
- `SLACK_WEBHOOK` - For Slack notifications (optional)
- `TEAMS_WEBHOOK` - For Teams notifications (optional)

### Customization

**Modify Auto-labeling Rules:**
Edit the labeling logic in `.github/workflows/issue-triage.yml`:

```javascript
// Add custom detection rules
if (title.includes('your-keyword') || body.includes('your-keyword')) {
  labels.push('custom:label');
}
```

**Adjust Timing:**
Modify cron schedules in `.github/workflows/issue-monitoring.yml`:

```yaml
schedule:
  - cron: '0 9 * * MON'  # Weekly report
  - cron: '0 17 * * *'   # Daily summary
```

## 🛠️ Troubleshooting

### Common Issues

**Labels Not Applied:**
- Check workflow permissions
- Verify trigger conditions
- Review workflow logs

**Branch Creation Failed:**
- Ensure Actions have write permissions
- Check branch protection rules
- Verify branch naming doesn't conflict

**Reports Not Generated:**
- Check cron trigger syntax
- Verify workflow is enabled
- Review execution logs

### Debug Steps

1. Check Actions tab for workflow execution logs
2. Verify repository permissions for GitHub Actions
3. Ensure issue templates are properly formatted
4. Test workflows manually using workflow_dispatch

## 🔒 Security Considerations

- All workflows use repository-scoped `GITHUB_TOKEN`
- No external API calls or data sharing
- Security issues are handled with appropriate sensitivity
- Private vulnerability reporting encouraged for critical issues

## 📚 Advanced Features

### Custom Automations
The system is designed to be extensible. You can:
- Add custom label detection rules
- Integrate with external tools
- Create custom notification channels
- Implement additional quality gates

### Analytics Integration
Workflows can be extended to integrate with:
- External analytics platforms
- Monitoring systems  
- Custom dashboards
- Reporting tools

## 🤝 Contributing

To improve the automation system:
1. Test changes on a fork first
2. Follow the existing workflow patterns
3. Update documentation for new features
4. Consider backwards compatibility

## 📄 License

This automation system is part of the prompt-card-system project and follows the same license terms.

---

*This automation system helps maintain high code quality, efficient development workflows, and excellent project management practices.*