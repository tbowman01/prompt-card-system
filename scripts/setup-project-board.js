#!/usr/bin/env node
/**
 * GitHub Projects Board Setup Script
 * 
 * This script sets up the project board with the required columns and automation
 * using the GitHub CLI and API.
 */

const { execSync } = require('child_process');

function runCommand(command, description) {
  console.log(`🔧 ${description}...`);
  try {
    const result = execSync(command, { encoding: 'utf8' });
    console.log(`✅ ${description} completed`);
    return result.trim();
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    return null;
  }
}

function setupProjectBoard() {
  console.log('🚀 Setting up GitHub Projects Board');
  console.log('=====================================');

  // Get repository information
  const repoInfo = runCommand('gh repo view --json owner,name', 'Getting repository info');
  if (!repoInfo) return;

  const { owner, name } = JSON.parse(repoInfo);
  console.log(`📁 Repository: ${owner.login}/${name}`);

  // Create project if it doesn't exist
  let projectId;
  try {
    const existingProjects = runCommand('gh project list --owner @me --format json', 'Checking existing projects');
    const projects = JSON.parse(existingProjects || '[]');
    const existingProject = projects.find(p => p.title === 'Prompt Card System Development');
    
    if (existingProject) {
      projectId = existingProject.number;
      console.log(`📋 Using existing project: #${projectId}`);
    } else {
      const createResult = runCommand(
        'gh project create --title "Prompt Card System Development" --format json',
        'Creating new project'
      );
      
      if (createResult) {
        const projectData = JSON.parse(createResult);
        projectId = projectData.number;
        console.log(`📋 Created new project: #${projectId}`);
      }
    }
  } catch (error) {
    console.error('Error managing project:', error.message);
    return;
  }

  if (!projectId) {
    console.error('❌ Failed to get or create project');
    return;
  }

  // Define the columns we want
  const columns = [
    { name: 'Triage', description: 'New items needing assessment' },
    { name: 'Ready', description: 'Items ready for development' },
    { name: 'In Progress', description: 'Currently being worked on' },
    { name: 'Review', description: 'Awaiting review and approval' },
    { name: 'Done', description: 'Completed items' }
  ];

  console.log('\n📝 Setting up project columns...');
  
  // Add columns to project
  columns.forEach((column, index) => {
    const command = `gh project field-create ${projectId} --name "Status" --single-select-option "${column.name}"`;
    runCommand(command, `Adding column: ${column.name}`);
  });

  // Link repository to project
  const linkCommand = `gh project link ${projectId} ${owner.login}/${name}`;
  runCommand(linkCommand, 'Linking repository to project');

  console.log('\n🎯 Project board setup recommendations:');
  console.log('1. Configure automation rules in GitHub Projects UI');
  console.log('2. Set up issue templates with project linking');
  console.log('3. Add team members to the project');
  console.log('4. Configure project visibility settings');

  console.log('\n📚 Next steps:');
  console.log('- Visit your project board in GitHub');
  console.log('- Configure column automation');
  console.log('- Add existing issues to appropriate columns');
  console.log('- Set up project workflows');

  console.log(`\n🔗 Project URL: https://github.com/users/${owner.login}/projects/${projectId}`);
}

// Run the setup if called directly
if (require.main === module) {
  setupProjectBoard();
}

module.exports = { setupProjectBoard };