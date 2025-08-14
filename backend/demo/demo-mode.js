/**
 * Demo Mode Controller
 * Manages demo data, animations, and guided tours
 */

class DemoMode {
  constructor() {
    this.config = null;
    this.promptCards = null;
    this.testCases = null;
    this.analytics = null;
    this.isActive = false;
    this.currentTour = null;
    this.animationSpeed = 1.5;
  }

  /**
   * Initialize demo mode with all data
   */
  async init() {
    try {
      // Load all demo data
      this.config = await this.loadJSON('/demo/demo-config.json');
      this.promptCards = await this.loadJSON('/demo/demo-prompt-cards.json');
      this.testCases = await this.loadJSON('/demo/demo-test-cases.json');
      this.analytics = await this.loadJSON('/demo/demo-analytics.json');
      
      // Set demo mode active
      this.isActive = true;
      this.animationSpeed = this.config.demoMode.timing.animationSpeed;
      
      // Show demo banner
      this.showDemoBanner();
      
      // Initialize demo workspace
      this.initializeWorkspace();
      
      // Start auto-play tour if enabled
      if (this.config.demoMode.autoPlayTours) {
        setTimeout(() => this.startTour('welcome'), 1000);
      }
      
      console.log('✅ Demo mode initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize demo mode:', error);
      return false;
    }
  }

  /**
   * Load JSON data from file
   */
  async loadJSON(path) {
    const response = await fetch(path);
    return response.json();
  }

  /**
   * Show demo mode banner
   */
  showDemoBanner() {
    const banner = document.createElement('div');
    banner.className = 'demo-banner';
    banner.innerHTML = `
      <div class="demo-banner-content">
        <span class="demo-badge">🎮 DEMO MODE</span>
        <span class="demo-text">You're exploring with sample data. Changes won't be saved.</span>
        <button class="demo-exit" onclick="demoMode.exit()">Exit Demo</button>
      </div>
    `;
    document.body.prepend(banner);
  }

  /**
   * Initialize demo workspace with data
   */
  initializeWorkspace() {
    // Load prompt cards into UI
    this.promptCards.promptCards.forEach(card => {
      this.createPromptCardElement(card);
    });
    
    // Load test cases
    Object.entries(this.testCases.testCases).forEach(([cardId, tests]) => {
      tests.forEach(test => {
        this.createTestCaseElement(cardId, test);
      });
    });
    
    // Load analytics dashboard
    this.updateAnalyticsDashboard(this.analytics.analytics);
    
    // Load team members
    this.config.demoTeamMembers.forEach(member => {
      this.createTeamMemberElement(member);
    });
  }

  /**
   * Create prompt card UI element
   */
  createPromptCardElement(card) {
    const element = document.createElement('div');
    element.className = 'prompt-card';
    element.dataset.cardId = card.id;
    element.innerHTML = `
      <div class="card-header">
        <h3>${card.title}</h3>
        <span class="version">v${card.version}</span>
        <span class="status ${card.status}">${card.status}</span>
      </div>
      <p class="description">${card.description}</p>
      <div class="card-meta">
        <span class="category">${card.category}</span>
        ${card.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
      </div>
      <div class="card-stats">
        <div class="stat">
          <span class="stat-value">${card.successRate}%</span>
          <span class="stat-label">Success</span>
        </div>
        <div class="stat">
          <span class="stat-value">${card.avgResponseTime}s</span>
          <span class="stat-label">Avg Time</span>
        </div>
        <div class="stat">
          <span class="stat-value">${card.totalRuns}</span>
          <span class="stat-label">Runs</span>
        </div>
      </div>
      <div class="card-actions">
        <button onclick="demoMode.viewCard('${card.id}')">View</button>
        <button onclick="demoMode.runTest('${card.id}')" class="primary">Run Test</button>
      </div>
    `;
    
    document.querySelector('.prompt-cards-grid')?.appendChild(element);
  }

  /**
   * Create test case UI element
   */
  createTestCaseElement(cardId, test) {
    const element = document.createElement('div');
    element.className = `test-case ${test.status}`;
    element.dataset.testId = test.id;
    element.innerHTML = `
      <div class="test-header">
        <h4>${test.name}</h4>
        <span class="test-status ${test.status}">${test.status}</span>
      </div>
      <p class="test-description">${test.description}</p>
      <div class="test-metrics">
        <span>⚡ ${test.metrics.responseTime}s</span>
        <span>🎯 ${test.metrics.tokens} tokens</span>
        <span>💰 $${test.metrics.cost}</span>
      </div>
      <button onclick="demoMode.runSpecificTest('${cardId}', '${test.id}')">
        Run This Test
      </button>
    `;
    
    document.querySelector(`[data-card-id="${cardId}"] .test-cases`)?.appendChild(element);
  }

  /**
   * Run a demo test with animation
   */
  async runTest(cardId) {
    const card = this.promptCards.promptCards.find(c => c.id === cardId);
    const tests = this.testCases.testCases[cardId];
    
    if (!card || !tests || tests.length === 0) {
      console.error('No tests found for card:', cardId);
      return;
    }
    
    // Get first test or random test
    const test = tests[0];
    await this.runSpecificTest(cardId, test.id);
  }

  /**
   * Run specific test case
   */
  async runSpecificTest(cardId, testId) {
    const test = this.testCases.testCases[cardId]?.find(t => t.id === testId);
    
    if (!test) {
      console.error('Test not found:', testId);
      return;
    }
    
    // Show loading state
    this.showTestRunning(testId);
    
    // Simulate API call delay
    await this.delay(this.config.demoMode.notifications.mockLatency);
    
    // Animate typing effect for response
    if (test.actualResponse) {
      await this.typewriterEffect(test.actualResponse, 'response-output');
    }
    
    // Show assertions one by one
    for (const assertion of test.assertions) {
      await this.showAssertion(assertion);
      await this.delay(300);
    }
    
    // Show final metrics
    this.showTestMetrics(test.metrics);
    
    // Update UI with results
    this.updateTestResult(testId, test.status);
    
    // Show notification
    if (test.status === 'passed') {
      this.showNotification('✅ Test passed successfully!', 'success');
    } else {
      this.showNotification('❌ Test failed. See details below.', 'error');
    }
  }

  /**
   * Typewriter effect for responses
   */
  async typewriterEffect(text, elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.textContent = '';
    const speed = this.config.demoMode.timing.typewriterSpeed;
    
    for (let i = 0; i < text.length; i++) {
      element.textContent += text[i];
      await this.delay(speed);
    }
  }

  /**
   * Show assertion result with animation
   */
  async showAssertion(assertion) {
    const element = document.createElement('div');
    element.className = `assertion ${assertion.result}`;
    element.innerHTML = `
      <span class="assertion-icon">${assertion.result === 'passed' ? '✅' : '❌'}</span>
      <span class="assertion-desc">${assertion.description}</span>
      <span class="assertion-result">${assertion.result.toUpperCase()}</span>
    `;
    
    element.style.opacity = '0';
    element.style.transform = 'translateX(-20px)';
    
    document.querySelector('.assertions-list')?.appendChild(element);
    
    // Animate in
    await this.delay(50);
    element.style.transition = 'all 0.3s ease';
    element.style.opacity = '1';
    element.style.transform = 'translateX(0)';
  }

  /**
   * Update analytics dashboard
   */
  updateAnalyticsDashboard(data) {
    // Update overview metrics
    document.querySelector('.metric-success-rate').textContent = `${data.overview.overallSuccessRate}%`;
    document.querySelector('.metric-avg-time').textContent = `${data.overview.avgResponseTime}s`;
    document.querySelector('.metric-total-cost').textContent = `$${data.overview.totalCost}`;
    document.querySelector('.metric-active-users').textContent = data.overview.activeUsers;
    
    // Create trend chart
    this.createTrendChart(data.trends.daily);
    
    // Update top performers
    data.topPerformers.forEach(performer => {
      this.addTopPerformer(performer);
    });
    
    // Update insights
    data.insights.forEach(insight => {
      this.addInsight(insight);
    });
  }

  /**
   * Start guided tour
   */
  startTour(tourType = 'welcome') {
    const tours = {
      'welcome': [
        { element: '.prompt-cards-grid', text: 'Here are your pre-built prompt cards', duration: 3000 },
        { element: '.analytics-dashboard', text: 'Track performance in real-time', duration: 3000 },
        { element: '.team-workspace', text: 'Collaborate with your team', duration: 3000 },
        { element: '.create-new-card', text: 'Create your own prompts', duration: 3000 }
      ],
      'quick-win': [
        { element: '.top-performer-card', text: 'This is your best performing prompt', duration: 2000 },
        { element: '.run-test-btn', text: 'Click to run a test', duration: 2000 },
        { element: '.test-results', text: 'See instant results', duration: 3000 }
      ],
      'technical': [
        { element: '.api-section', text: 'Integrate via REST API', duration: 3000 },
        { element: '.code-examples', text: 'Copy production-ready code', duration: 3000 },
        { element: '.webhook-config', text: 'Set up real-time notifications', duration: 3000 },
        { element: '.version-control', text: 'Track all changes', duration: 3000 }
      ]
    };
    
    this.currentTour = tours[tourType];
    this.runTourStep(0);
  }

  /**
   * Run tour step
   */
  runTourStep(stepIndex) {
    if (!this.currentTour || stepIndex >= this.currentTour.length) {
      this.endTour();
      return;
    }
    
    const step = this.currentTour[stepIndex];
    this.highlightElement(step.element, step.text);
    
    setTimeout(() => {
      this.runTourStep(stepIndex + 1);
    }, step.duration);
  }

  /**
   * Highlight element during tour
   */
  highlightElement(selector, text) {
    // Remove previous highlights
    document.querySelectorAll('.tour-highlight').forEach(el => {
      el.classList.remove('tour-highlight');
    });
    document.querySelector('.tour-tooltip')?.remove();
    
    const element = document.querySelector(selector);
    if (!element) return;
    
    // Add highlight
    element.classList.add('tour-highlight');
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Add tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'tour-tooltip';
    tooltip.textContent = text;
    
    const rect = element.getBoundingClientRect();
    tooltip.style.top = `${rect.top - 60}px`;
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    
    document.body.appendChild(tooltip);
  }

  /**
   * End tour
   */
  endTour() {
    document.querySelectorAll('.tour-highlight').forEach(el => {
      el.classList.remove('tour-highlight');
    });
    document.querySelector('.tour-tooltip')?.remove();
    this.currentTour = null;
    
    this.showNotification('Tour completed! Feel free to explore.', 'info');
  }

  /**
   * Run automated sequence
   */
  async runSequence(sequenceType) {
    const sequences = {
      'quick-win': async () => {
        await this.navigateTo('dashboard');
        await this.delay(1000);
        await this.navigateTo('prompt-cards');
        await this.delay(1000);
        await this.runTest('card-001');
      },
      'full-tour': async () => {
        this.startTour('welcome');
      },
      'technical': async () => {
        this.startTour('technical');
      }
    };
    
    if (sequences[sequenceType]) {
      await sequences[sequenceType]();
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    if (!this.config.demoMode.notifications.showSuccess && type === 'success') return;
    if (!this.config.demoMode.notifications.showErrors && type === 'error') return;
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Helper: Delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms * this.animationSpeed));
  }

  /**
   * Navigate to section
   */
  async navigateTo(section) {
    const element = document.querySelector(`[data-section="${section}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      element.classList.add('highlight');
      await this.delay(500);
      element.classList.remove('highlight');
    }
  }

  /**
   * Reset demo data
   */
  reset() {
    if (confirm('Reset all demo data to initial state?')) {
      localStorage.removeItem('demoState');
      location.reload();
    }
  }

  /**
   * Exit demo mode
   */
  exit() {
    if (confirm('Exit demo mode and return to login?')) {
      this.isActive = false;
      window.location.href = '/login';
    }
  }

  /**
   * Show test running state
   */
  showTestRunning(testId) {
    const element = document.querySelector(`[data-test-id="${testId}"]`);
    if (element) {
      element.classList.add('running');
      element.querySelector('.test-status').textContent = 'Running...';
    }
  }

  /**
   * Update test result UI
   */
  updateTestResult(testId, status) {
    const element = document.querySelector(`[data-test-id="${testId}"]`);
    if (element) {
      element.classList.remove('running');
      element.classList.add(status);
      element.querySelector('.test-status').textContent = status;
    }
  }

  /**
   * Show test metrics
   */
  showTestMetrics(metrics) {
    const metricsElement = document.querySelector('.test-metrics-display');
    if (metricsElement) {
      metricsElement.innerHTML = `
        <div class="metric">
          <span class="metric-label">Response Time</span>
          <span class="metric-value">${metrics.responseTime}s</span>
        </div>
        <div class="metric">
          <span class="metric-label">Tokens Used</span>
          <span class="metric-value">${metrics.tokens}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Cost</span>
          <span class="metric-value">$${metrics.cost}</span>
        </div>
      `;
    }
  }
}

// Initialize demo mode on page load
const demoMode = new DemoMode();

// Auto-init if demo parameter present
if (window.location.search.includes('demo=true') || window.location.hostname.includes('demo')) {
  document.addEventListener('DOMContentLoaded', () => {
    demoMode.init();
  });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DemoMode;
}