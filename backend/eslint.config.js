// ESLint v9 compatibility config - fallback to legacy .eslintrc.json
const path = require('path');
const fs = require('fs');

// Check if legacy config exists and use it temporarily
const legacyConfigPath = path.join(__dirname, '.eslintrc.json');
if (fs.existsSync(legacyConfigPath)) {
  const legacyConfig = require(legacyConfigPath);
  
  module.exports = [
    {
      files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        globals: {
          node: 'readonly',
          jest: 'readonly',
          console: 'readonly',
          process: 'readonly',
          Buffer: 'readonly',
          __dirname: 'readonly',
          __filename: 'readonly',
          global: 'readonly',
          module: 'readonly',
          require: 'readonly',
          exports: 'readonly',
        },
      },
      rules: {
        'no-unused-vars': 'warn',
        'no-console': 'warn',
        'prefer-const': 'error',
        'no-var': 'error',
      },
      ignores: [
        'dist/',
        'node_modules/',
        'coverage/',
      ],
    },
  ];
}

// Fallback basic config
module.exports = [
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'warn',
    },
  },
];