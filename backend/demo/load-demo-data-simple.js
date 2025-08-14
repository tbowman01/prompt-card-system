#!/usr/bin/env node

/**
 * Simple Demo Data Loader - JavaScript version to avoid TypeScript issues
 * Loads prepopulated demo data directly into SQLite database
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Database path from environment or default
const DATABASE_PATH = process.env.DATABASE_PATH || '/app/data/database.sqlite';

async function loadDemoData() {
  try {
    console.log('🎮 Loading demo data into SQLite database...');

    // Check if database exists
    if (!fs.existsSync(DATABASE_PATH)) {
      console.error('❌ Database not found at:', DATABASE_PATH);
      return false;
    }

    // Open database connection
    const db = Database(DATABASE_PATH);

    // Load demo JSON files
    const demoPath = path.join(__dirname);
    const promptCardsFile = path.join(demoPath, 'demo-prompt-cards.json');
    const testCasesFile = path.join(demoPath, 'demo-test-cases.json');

    if (!fs.existsSync(promptCardsFile) || !fs.existsSync(testCasesFile)) {
      console.error('❌ Demo data files not found');
      return false;
    }

    const promptCardsData = JSON.parse(fs.readFileSync(promptCardsFile, 'utf8'));
    const testCasesData = JSON.parse(fs.readFileSync(testCasesFile, 'utf8'));

    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS prompt_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        prompt_template TEXT NOT NULL,
        variables TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS test_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt_card_id INTEGER,
        name TEXT NOT NULL,
        description TEXT,
        input_variables TEXT NOT NULL,
        expected_output TEXT,
        assertions TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prompt_card_id) REFERENCES prompt_cards (id)
      );
    `);

    // Clear existing demo data
    db.exec('DELETE FROM test_cases');
    db.exec('DELETE FROM prompt_cards');

    // Insert prompt cards
    const insertPromptCard = db.prepare(`
      INSERT INTO prompt_cards (title, description, prompt_template, variables)
      VALUES (?, ?, ?, ?)
    `);

    const insertTestCase = db.prepare(`
      INSERT INTO test_cases (prompt_card_id, name, description, input_variables, expected_output, assertions)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let totalCards = 0;
    let totalTestCases = 0;

    // Begin transaction
    const insertData = db.transaction(() => {
      for (const card of promptCardsData.promptCards) {
        const result = insertPromptCard.run(
          card.title,
          card.description,
          card.template || card.prompt_template,
          JSON.stringify(card.variables || [])
        );
        
        const cardId = result.lastInsertRowid;
        totalCards++;

        // Insert test cases for this card (try both id and title keys)
        const cardTestCases = testCasesData.testCases[card.id] || testCasesData.testCases[card.title] || [];
        for (const testCase of cardTestCases) {
          insertTestCase.run(
            cardId,
            testCase.name,
            testCase.description,
            JSON.stringify(testCase.inputs || testCase.input_variables || {}),
            testCase.expected_output || null,
            JSON.stringify(testCase.assertions || [])
          );
          totalTestCases++;
        }
      }
    });

    // Execute transaction
    insertData();

    // Close database
    db.close();

    console.log('✅ Demo data loaded successfully:');
    console.log(`   • ${totalCards} prompt cards`);
    console.log(`   • ${totalTestCases} test cases`);

    return true;

  } catch (error) {
    console.error('❌ Failed to load demo data:', error.message);
    return false;
  }
}

// Check if running directly or being imported
if (require.main === module) {
  loadDemoData()
    .then(success => {
      if (success) {
        console.log('🎉 Demo ready! Visit http://localhost:3000');
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
}

module.exports = { loadDemoData };