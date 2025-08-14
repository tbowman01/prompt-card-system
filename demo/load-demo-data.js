#!/usr/bin/env node

/**
 * Demo Data Loader
 * Loads prepopulated demo data into the running system
 */

const fs = require('fs');
const path = require('path');

// Mock database/storage for demo purposes
class DemoDataLoader {
  constructor() {
    this.demoPath = '/app/demo';
    this.dataPath = '/app/data';
  }

  async loadDemoData() {
    try {
      console.log('🎮 Loading demo data...');

      // Load demo configurations
      const promptCards = this.loadJSON('demo-prompt-cards.json');
      const testCases = this.loadJSON('demo-test-cases.json');
      const analytics = this.loadJSON('demo-analytics.json');
      const config = this.loadJSON('demo-config.json');

      // In a real implementation, these would be saved to the actual database
      // For demo purposes, we'll create mock data files
      
      // Create demo data directory
      if (!fs.existsSync(this.dataPath)) {
        fs.mkdirSync(this.dataPath, { recursive: true });
      }

      // Save demo data as mock database files
      this.saveJSON('demo-prompt-cards.json', promptCards);
      this.saveJSON('demo-test-cases.json', testCases);
      this.saveJSON('demo-analytics.json', analytics);
      this.saveJSON('demo-config.json', config);

      // Create session state
      const sessionState = {
        demoMode: true,
        initialized: new Date().toISOString(),
        promptCardsLoaded: promptCards.promptCards.length,
        testCasesLoaded: Object.keys(testCases.testCases).length,
        analyticsLoaded: true,
        features: config.demoMode.features
      };

      this.saveJSON('demo-session-state.json', sessionState);

      console.log('✅ Demo data loaded successfully:');
      console.log(`   • ${promptCards.promptCards.length} prompt cards`);
      console.log(`   • ${Object.keys(testCases.testCases).length} test case sets`);
      console.log(`   • Analytics dashboard data`);
      console.log(`   • ${config.demoTeamMembers.length} team members`);
      console.log(`   • ${config.demoWorkspaces.length} workspaces`);

      return true;
    } catch (error) {
      console.error('❌ Failed to load demo data:', error.message);
      return false;
    }
  }

  loadJSON(filename) {
    const filePath = path.join(this.demoPath, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Demo file not found: ${filename}`);
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }

  saveJSON(filename, data) {
    const filePath = path.join(this.dataPath, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
}

// Check if running in demo mode
const isDemoMode = process.env.DEMO_MODE === 'true' || 
                  process.env.NODE_ENV === 'demo' ||
                  process.argv.includes('--demo');

if (isDemoMode) {
  const loader = new DemoDataLoader();
  loader.loadDemoData()
    .then(success => {
      if (success) {
        console.log('🎮 Demo mode ready! Visit http://localhost:3000?demo=true');
        process.exit(0);
      } else {
        console.log('❌ Demo setup failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Demo loader error:', error);
      process.exit(1);
    });
} else {
  console.log('ℹ️  Demo mode not enabled. Set DEMO_MODE=true to load demo data.');
}