import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Prompt Card System',
  description: 'Enterprise AI Testing Platform - Comprehensive Documentation',
  
  // Base path for GitHub Pages
  base: '/prompt-card-system/',
  
  // Theme configuration
  themeConfig: {
    logo: '/logo.svg',
    
    // Navigation
    nav: [
      { text: 'Home', link: '/' },
      { text: 'User Guide', link: '/user-guide/' },
      { text: 'API Reference', link: '/api/' },
      { text: 'Developer', link: '/developer/' },
      { text: 'Deployment', link: '/deployment/' }
    ],

    // Sidebar
    sidebar: {
      '/user-guide/': [
        {
          text: '🚀 Getting Started',
          collapsed: false,
          items: [
            { text: 'Quick Start', link: '/user-guide/getting-started' },
            { text: 'Installation', link: '/user-guide/installation' },
            { text: 'Configuration', link: '/user-guide/configuration' }
          ]
        },
        {
          text: '📝 Core Features',
          collapsed: false,
          items: [
            { text: 'Prompt Cards', link: '/user-guide/prompt-cards' },
            { text: 'Test Cases', link: '/user-guide/test-cases' },
            { text: 'Running Tests', link: '/user-guide/running-tests' },
            { text: 'Analytics Dashboard', link: '/user-guide/analytics' }
          ]
        },
        {
          text: '🔧 Advanced Features',
          collapsed: true,
          items: [
            { text: 'AI Optimization', link: '/user-guide/ai-optimization' },
            { text: 'Collaboration', link: '/user-guide/collaboration' },
            { text: 'Cost Tracking', link: '/user-guide/cost-tracking' },
            { text: 'Voice Interface', link: '/user-guide/voice-interface' }
          ]
        }
      ],
      
      '/api/': [
        {
          text: '🔌 API Reference',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Authentication', link: '/api/authentication' },
            { text: 'Prompt Cards', link: '/api/prompt-cards' },
            { text: 'Test Cases', link: '/api/test-cases' },
            { text: 'Analytics', link: '/api/analytics' },
            { text: 'Optimization', link: '/api/optimization' }
          ]
        }
      ],
      
      '/developer/': [
        {
          text: '⚙️ Development',
          collapsed: false,
          items: [
            { text: 'Architecture', link: '/developer/architecture' },
            { text: 'Development Setup', link: '/developer/setup' },
            { text: 'Testing Strategy', link: '/developer/testing' },
            { text: 'Contributing', link: '/developer/contributing' }
          ]
        },
        {
          text: '🏗️ Claude Flow SPARC',
          collapsed: false,
          items: [
            { text: 'SPARC Overview', link: '/developer/sparc-overview' },
            { text: 'Swarm Coordination', link: '/developer/swarm-coordination' },
            { text: 'Neural Training', link: '/developer/neural-training' },
            { text: 'Performance Optimization', link: '/developer/performance' }
          ]
        }
      ],
      
      '/deployment/': [
        {
          text: '🚀 Deployment',
          collapsed: false,
          items: [
            { text: 'Docker Guide', link: '/deployment/docker' },
            { text: 'GHCR Publishing', link: '/deployment/ghcr' },
            { text: 'Production Setup', link: '/deployment/production' },
            { text: 'Monitoring', link: '/deployment/monitoring' }
          ]
        }
      ]
    },

    // Social links
    socialLinks: [
      { icon: 'github', link: 'https://github.com/tbowman01/prompt-card-system' }
    ],

    // Footer
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 Prompt Card System'
    },

    // Search
    search: {
      provider: 'local'
    },

    // Edit link
    editLink: {
      pattern: 'https://github.com/tbowman01/prompt-card-system/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    }
  },

  // Markdown configuration
  markdown: {
    theme: 'github-dark',
    lineNumbers: true
  },

  // Vite configuration
  vite: {
    publicDir: '../public'
  }
})