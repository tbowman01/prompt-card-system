#!/usr/bin/env node
/**
 * Semantic Versioning Script for Prompt Card System
 * 
 * Versioning Strategy:
 * - main branch: x.y.z-next (pre-release for production)
 * - develop branch: x.y.z-alpha (alpha releases)  
 * - other branches: x.y.z-<short-sha> (build verification)
 * 
 * Usage:
 *   node scripts/version.js [patch|minor|major|prerelease]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get current branch and commit info
function getGitInfo() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    const shortSha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    const commitCount = execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
    return { branch, shortSha, commitCount };
  } catch (error) {
    console.error('Error getting git info:', error.message);
    process.exit(1);
  }
}

// Read current package.json version
function getCurrentVersion() {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return packageData.version;
}

// Parse semantic version
function parseVersion(version) {
  // Remove any prerelease suffix to get base version
  const baseVersion = version.split('-')[0];
  const [major, minor, patch] = baseVersion.split('.').map(Number);
  return { major, minor, patch };
}

// Generate new version based on branch and increment type
function generateVersion(currentVersion, incrementType, gitInfo) {
  const { major, minor, patch } = parseVersion(currentVersion);
  const { branch, shortSha, commitCount } = gitInfo;

  let newVersion;
  let newMajor = major, newMinor = minor, newPatch = patch;

  // Determine increment based on type
  switch (incrementType) {
    case 'major':
      newMajor = major + 1;
      newMinor = 0;
      newPatch = 0;
      break;
    case 'minor':
      newMinor = minor + 1;
      newPatch = 0;
      break;
    case 'patch':
    default:
      newPatch = patch + 1;
      break;
  }

  const baseVersion = `${newMajor}.${newMinor}.${newPatch}`;

  // Apply branch-specific versioning strategy
  if (branch === 'main') {
    newVersion = `${baseVersion}-next.${commitCount}`;
  } else if (branch === 'develop') {
    newVersion = `${baseVersion}-alpha.${commitCount}`;
  } else {
    // For feature branches and other branches, use build verification format
    newVersion = `${baseVersion}-${shortSha}`;
  }

  return newVersion;
}

// Update package.json files
function updatePackageVersions(newVersion) {
  const packagePaths = [
    'package.json',
    'backend/package.json',
    'frontend/package.json'
  ];

  packagePaths.forEach(packagePath => {
    if (fs.existsSync(packagePath)) {
      console.log(`Updating ${packagePath}...`);
      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      packageData.version = newVersion;
      
      // Ensure consistent formatting
      fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + '\n');
      console.log(`✅ Updated ${packagePath} to version ${newVersion}`);
    }
  });
}

// Create version info file for CI/CD
function createVersionInfo(version, gitInfo) {
  const versionInfo = {
    version,
    branch: gitInfo.branch,
    commit: gitInfo.shortSha,
    commitCount: parseInt(gitInfo.commitCount),
    timestamp: new Date().toISOString(),
    buildType: gitInfo.branch === 'main' ? 'release' : 
               gitInfo.branch === 'develop' ? 'alpha' : 'build'
  };

  fs.writeFileSync('version-info.json', JSON.stringify(versionInfo, null, 2));
  console.log('📋 Created version-info.json');
  
  return versionInfo;
}

// Main function
function main() {
  const args = process.argv.slice(2);
  const incrementType = args[0] || 'patch';

  console.log('🚀 Semantic Versioning Script');
  console.log('================================');

  const gitInfo = getGitInfo();
  console.log(`📍 Branch: ${gitInfo.branch}`);
  console.log(`📝 Commit: ${gitInfo.shortSha}`);
  console.log(`🔢 Commit Count: ${gitInfo.commitCount}`);

  const currentVersion = getCurrentVersion();
  console.log(`📦 Current Version: ${currentVersion}`);

  const newVersion = generateVersion(currentVersion, incrementType, gitInfo);
  console.log(`✨ New Version: ${newVersion}`);

  // Confirm version update
  if (process.env.CI !== 'true' && !args.includes('--force')) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`\nUpdate to version ${newVersion}? (y/N) `, (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        updatePackageVersions(newVersion);
        const versionInfo = createVersionInfo(newVersion, gitInfo);
        console.log('\n🎉 Version update completed!');
        console.log(`📋 Version Info:`, versionInfo);
      } else {
        console.log('❌ Version update cancelled');
      }
      rl.close();
    });
  } else {
    // Auto-update in CI or with --force flag
    updatePackageVersions(newVersion);
    const versionInfo = createVersionInfo(newVersion, gitInfo);
    console.log('\n🎉 Version update completed!');
    console.log(`📋 Version Info:`, JSON.stringify(versionInfo, null, 2));
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getGitInfo,
  getCurrentVersion,
  generateVersion,
  updatePackageVersions,
  createVersionInfo
};