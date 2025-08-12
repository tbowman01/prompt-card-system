# GitHub Projects Board Setup

## Project: Prompt Card System Development

This document describes the project board configuration for managing the development workflow.

### Board Structure

The project board uses the following columns to track work items through the development lifecycle:

#### 1. **Triage** 🔍
- **Purpose**: New issues and feature requests that need initial assessment
- **Criteria**: Items that haven't been evaluated or prioritized yet
- **Actions**: Review, label, assign priority, and move to Ready

#### 2. **Ready** 📋  
- **Purpose**: Work items that are well-defined and ready to be picked up
- **Criteria**: 
  - Requirements are clear and documented
  - Acceptance criteria defined
  - Dependencies identified
  - Assigned to a team member (optional)
- **Actions**: Move to In Progress when work begins

#### 3. **In Progress** 🚧
- **Purpose**: Active development work currently being performed
- **Criteria**:
  - Assigned to a developer
  - Work has begun
  - Branch created (for development tasks)
- **Actions**: Regular updates, move to Review when ready

#### 4. **Review** 👀
- **Purpose**: Completed work awaiting review and approval
- **Criteria**:
  - Pull request created
  - Code review requested
  - Tests passing
  - Documentation updated
- **Actions**: Review, approve/request changes, merge when ready

#### 5. **Done** ✅
- **Purpose**: Completed and merged work
- **Criteria**:
  - Pull request merged
  - Tests passing in target branch
  - Deployed (if applicable)
  - Acceptance criteria met
- **Actions**: Archive after sprint completion

### Automation Rules

The following automation rules help maintain the board:

1. **New Issues → Triage**: All new issues automatically enter the Triage column
2. **PR Created → Review**: When a PR is created, linked issues move to Review
3. **PR Merged → Done**: When a PR is merged, linked issues move to Done
4. **Branch Created → In Progress**: When a feature branch is created, linked issues move to In Progress

### Usage Guidelines

#### For Contributors:
1. **Creating Issues**: Use appropriate templates and labels
2. **Starting Work**: Move items from Ready to In Progress
3. **Pull Requests**: Link PRs to issues using keywords (fixes, closes, resolves)
4. **Updates**: Add comments to issues for status updates

#### For Maintainers:
1. **Triage**: Review new items weekly
2. **Prioritization**: Assign labels (priority:high, priority:medium, priority:low)
3. **Assignment**: Assign issues to team members
4. **Review**: Conduct timely code reviews

### Integration with Workflows

The project board integrates with GitHub Actions workflows:

- **Version Workflow**: Automatically creates release issues
- **CI/CD Pipeline**: Updates project board on build status
- **Security Scans**: Creates security-related issues in Triage

### Metrics and Reporting

Track project health using:
- **Velocity**: Items completed per sprint
- **Cycle Time**: Time from Ready to Done
- **Lead Time**: Time from Triage to Done
- **Throughput**: Items completed over time

### Labels and Categories

#### Priority Labels:
- `priority:critical` 🔴 - Immediate attention required
- `priority:high` 🟡 - Important, should be addressed soon  
- `priority:medium` 🟢 - Normal priority
- `priority:low` ⚪ - Nice to have

#### Type Labels:
- `type:feature` ✨ - New functionality
- `type:bug` 🐛 - Bug reports
- `type:enhancement` 🚀 - Improvements to existing features
- `type:documentation` 📚 - Documentation updates
- `type:security` 🔒 - Security-related changes

#### Size Labels:
- `size:xs` - Very small task (< 1 hour)
- `size:s` - Small task (1-4 hours)
- `size:m` - Medium task (1-2 days)
- `size:l` - Large task (3-5 days)
- `size:xl` - Extra large task (1+ weeks)

This structure ensures efficient project management and clear visibility into development progress.