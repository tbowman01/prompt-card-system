const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATABASE_PATH = process.env.DATABASE_PATH || '/app/data/database.sqlite';

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Initialize database
let db;
try {
  db = Database(DATABASE_PATH);
  console.log('✅ Database connected:', DATABASE_PATH);
} catch (error) {
  console.error('❌ Database connection failed:', error.message);
  process.exit(1);
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all prompt cards
app.get('/api/prompt-cards', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get total count
    const totalResult = db.prepare('SELECT COUNT(*) as total FROM prompt_cards').get();
    const total = totalResult.total;

    // Get paginated results
    const cards = db.prepare(`
      SELECT 
        pc.*,
        COUNT(tc.id) as test_case_count
      FROM prompt_cards pc
      LEFT JOIN test_cases tc ON pc.id = tc.prompt_card_id
      GROUP BY pc.id
      ORDER BY pc.updated_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: cards.map(card => ({
        ...card,
        variables: JSON.parse(card.variables || '[]'),
        test_case_count: Number(card.test_case_count)
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching prompt cards:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get specific prompt card
app.get('/api/prompt-cards/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const card = db.prepare('SELECT * FROM prompt_cards WHERE id = ?').get(id);
    if (!card) {
      return res.status(404).json({
        success: false,
        error: 'Prompt card not found'
      });
    }

    const testCases = db.prepare(`
      SELECT * FROM test_cases WHERE prompt_card_id = ? ORDER BY created_at DESC
    `).all(id);

    res.json({
      success: true,
      data: {
        ...card,
        variables: JSON.parse(card.variables || '[]'),
        test_cases: testCases.map(tc => ({
          ...tc,
          input_variables: JSON.parse(tc.input_variables),
          assertions: JSON.parse(tc.assertions || '[]')
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching prompt card:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Demo status endpoint
app.get('/api/demo/status', (req, res) => {
  try {
    const promptCardCount = db.prepare('SELECT COUNT(*) as count FROM prompt_cards').get();
    const testCaseCount = db.prepare('SELECT COUNT(*) as count FROM test_cases').get();

    res.json({
      success: true,
      data: {
        demoModeEnabled: true,
        hasData: promptCardCount.count > 0,
        promptCardCount: promptCardCount.count,
        testCaseCount: testCaseCount.count
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple backend server running on port ${PORT}`);
  console.log(`🎮 Demo mode: ENABLED`);
  console.log(`💾 Database: ${DATABASE_PATH}`);
  
  // Check if demo data exists
  try {
    const count = db.prepare('SELECT COUNT(*) as count FROM prompt_cards').get();
    console.log(`📊 Demo data: ${count.count} prompt cards loaded`);
  } catch (error) {
    console.log('⚠️  Database may need initialization');
  }
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down server...');
  if (db) db.close();
  process.exit(0);
});