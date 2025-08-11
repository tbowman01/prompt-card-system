#!/bin/bash

# GitHub Repository Setup Script for prompt-card-system
# This script configures the GitHub repository with all necessary settings

set -e

REPO_OWNER="tbowman01"
REPO_NAME="prompt-card-system"
REPO_FULL_NAME="${REPO_OWNER}/${REPO_NAME}"

echo "🚀 Setting up GitHub repository: ${REPO_FULL_NAME}"

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed. Please install it first."
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI. Please run 'gh auth login' first."
    exit 1
fi

echo "✅ GitHub CLI authenticated"

# 1. Configure repository settings
echo "📝 Configuring repository settings..."
gh repo edit ${REPO_FULL_NAME} \
    --description "A comprehensive prompt card management system with intelligent categorization and testing capabilities" \
    --homepage "" \
    --default-branch develop \
    --enable-issues \
    --enable-projects \
    --enable-wiki \
    --delete-branch-on-merge

echo "✅ Repository settings configured"

# 2. Set up topics/tags
echo "🏷️ Adding repository topics..."
gh repo edit ${REPO_FULL_NAME} --add-topic "prompt,ai,management,testing,cards,nodejs,react,typescript"

echo "✅ Repository topics added"

# 3. Enable security features
echo "🔒 Enabling security features..."
# Note: Some of these may require repository admin access
gh api repos/${REPO_FULL_NAME} --method PATCH --field security_and_analysis='{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"},"dependency_graph":{"status":"enabled"},"advanced_security":{"status":"enabled"}}'

echo "✅ Security features enabled"

# 4. Create labels (this is handled by the labels-sync.yml workflow)
echo "🏷️ Labels will be synchronized by the labels-sync workflow"

# 5. Set up branch protection rules
echo "🛡️ Setting up branch protection rules..."

# Protect develop branch
gh api repos/${REPO_FULL_NAME}/branches/develop/protection --method PUT --field required_status_checks='{"strict":true,"contexts":["CI/CD Pipeline","Security Scan","PR Quality / Template Completion","PR Quality / Issue Linking"]}' --field enforce_admins=false --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":false}' --field restrictions=null --field allow_force_pushes=false --field allow_deletions=false

# Protect main branch (if it exists)
if gh api repos/${REPO_FULL_NAME}/branches/main 2>/dev/null; then
    gh api repos/${REPO_FULL_NAME}/branches/main/protection --method PUT --field required_status_checks='{"strict":true,"contexts":["CI/CD Pipeline","Security Scan","Tests"]}' --field enforce_admins=true --field required_pull_request_reviews='{"required_approving_review_count":2,"dismiss_stale_reviews":true,"require_code_owner_reviews":true}' --field restrictions=null --field allow_force_pushes=false --field allow_deletions=false
fi

echo "✅ Branch protection rules configured"

# 6. Create environments
echo "🌍 Setting up deployment environments..."

# Development environment
gh api repos/${REPO_FULL_NAME}/environments/development --method PUT --field deployment_branch_policy='{"protected_branches":false,"custom_branch_policies":true}'

# Staging environment  
gh api repos/${REPO_FULL_NAME}/environments/staging --method PUT --field protection_rules='[{"type":"required_reviewers","reviewers":[{"type":"User","id":"'$(gh api user --jq .id)'"}]}]' --field deployment_branch_policy='{"protected_branches":true}'

# Production environment
gh api repos/${REPO_FULL_NAME}/environments/production --method PUT --field protection_rules='[{"type":"required_reviewers","reviewers":[{"type":"User","id":"'$(gh api user --jq .id)'"}]},{"type":"wait_timer","minutes":5}]' --field deployment_branch_policy='{"protected_branches":true}'

echo "✅ Deployment environments configured"

# 7. Set up project board
echo "📋 Creating project board..."
PROJECT_ID=$(gh project create --owner ${REPO_OWNER} --title "Prompt Card System Development" --body "Main development tracking board" --format json | jq -r '.id')

echo "✅ Project board created with ID: ${PROJECT_ID}"

# 8. Configure repository secrets (placeholder - these need to be set manually)
echo "🔐 Repository secrets to configure manually:"
echo "   - DOCKER_USERNAME"
echo "   - DOCKER_PASSWORD" 
echo "   - SLACK_WEBHOOK_URL (optional)"
echo "   - CODECOV_TOKEN (optional)"

# 9. Enable GitHub Pages (if needed)
echo "📄 GitHub Pages can be enabled manually if documentation hosting is needed"

# 10. Set up issue templates (these are already in the repository)
echo "📝 Issue templates are configured in .github/ISSUE_TEMPLATE/"

# 11. Set up pull request template (this is already in the repository)
echo "📝 Pull request template is configured in .github/PULL_REQUEST_TEMPLATE/"

# 12. Configure Actions permissions
echo "⚙️ Configuring GitHub Actions permissions..."
gh api repos/${REPO_FULL_NAME} --method PATCH --field actions_permissions='{"enabled":true,"allowed_actions":"all"}' --field actions_default_workflow_permissions='{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}'

echo "✅ GitHub Actions permissions configured"

echo ""
echo "🎉 Repository setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Configure required secrets in repository settings"
echo "   2. Review and adjust branch protection rules if needed"
echo "   3. Set up team access and collaborators"
echo "   4. Configure project board columns and automation"
echo "   5. Test workflows by creating a test issue"
echo ""
echo "📚 Documentation:"
echo "   - Repository settings: .github/settings.yml"
echo "   - Workflow configuration: .github/workflows-config.yml"
echo "   - Project board setup: .github/PROJECT_BOARD_CONFIG.md"
echo "   - Code ownership: .github/CODEOWNERS"
echo ""
echo "🚀 Your repository is now fully configured for automated development workflows!"