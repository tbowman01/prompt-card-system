import { EventEmitter } from 'events';
import { AnalyticsEngine } from './AnalyticsEngine';
import { BlockchainAuditTrail } from './BlockchainAuditTrail';

export interface VoiceCommand {
  id: string;
  command: string;
  intent: string;
  entities: Record<string, string>;
  confidence: number;
  timestamp: Date;
  userId: string;
  sessionId: string;
}

export interface VoiceResponse {
  text: string;
  data?: any;
  actions?: string[];
  suggestions?: string[];
}

export interface NaturalLanguageProcessor {
  processCommand(text: string): Promise<{
    intent: string;
    entities: Record<string, string>;
    confidence: number;
  }>;
}

export class VoiceInterface extends EventEmitter {
  private analyticsEngine: AnalyticsEngine;
  private blockchainAudit: BlockchainAuditTrail;
  private nlpProcessor: NaturalLanguageProcessor;
  private supportedLanguages: string[];
  private activeSession: string | null;

  constructor() {
    super();
    this.analyticsEngine = AnalyticsEngine.getInstance();
    this.blockchainAudit = BlockchainAuditTrail.getInstance();
    this.nlpProcessor = new AdvancedNLPProcessor();
    this.supportedLanguages = ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'zh-CN'];
    this.activeSession = null;
  }

  /**
   * Process voice command and return response
   */
  public async processVoiceCommand(
    audioData: ArrayBuffer,
    userId: string,
    language: string = 'en-US'
  ): Promise<VoiceResponse> {
    try {
      // Convert speech to text
      const transcription = await this.speechToText(audioData, language);
      
      // Process with NLP
      const nlpResult = await this.nlpProcessor.processCommand(transcription);
      
      // Create voice command record
      const voiceCommand: VoiceCommand = {
        id: `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        command: transcription,
        intent: nlpResult.intent,
        entities: nlpResult.entities,
        confidence: nlpResult.confidence,
        timestamp: new Date(),
        userId,
        sessionId: this.activeSession || 'default'
      };

      // Log to blockchain audit trail
      await this.blockchainAudit.recordAuditEvent({
        eventType: 'voice_command',
        userId,
        data: voiceCommand,
        timestamp: new Date()
      });

      // Execute command based on intent
      const response = await this.executeCommand(voiceCommand);
      
      this.emit('voiceCommandProcessed', voiceCommand, response);
      
      return response;
    } catch (error) {
      console.error('Error processing voice command:', error);
      
      // Log error to audit trail
      await this.blockchainAudit.recordAuditEvent({
        eventType: 'voice_command_error',
        userId,
        data: { error: error.message },
        timestamp: new Date()
      });

      return {
        text: 'I apologize, but I encountered an error processing your voice command. Please try again.',
        suggestions: ['Try speaking more clearly', 'Check your microphone', 'Use simpler commands']
      };
    }
  }

  /**
   * Execute command based on intent
   */
  private async executeCommand(command: VoiceCommand): Promise<VoiceResponse> {
    const { intent, entities } = command;

    switch (intent) {
      case 'create_prompt':
        return await this.handleCreatePrompt(entities);
      
      case 'run_test':
        return await this.handleRunTest(entities);
      
      case 'get_analytics':
        return await this.handleGetAnalytics(entities);
      
      case 'show_metrics':
        return await this.handleShowMetrics(entities);
      
      case 'export_report':
        return await this.handleExportReport(entities);
      
      case 'compare_models':
        return await this.handleCompareModels(entities);
      
      case 'optimize_prompt':
        return await this.handleOptimizePrompt(entities);
      
      case 'schedule_test':
        return await this.handleScheduleTest(entities);
      
      case 'voice_settings':
        return await this.handleVoiceSettings(entities);
      
      default:
        return this.handleUnknownIntent(command);
    }
  }

  /**
   * Handle create prompt command
   */
  private async handleCreatePrompt(entities: Record<string, string>): Promise<VoiceResponse> {
    const promptName = entities.name || 'Untitled Prompt';
    const promptType = entities.type || 'general';
    
    return {
      text: `I'll help you create a new prompt card called "${promptName}" of type "${promptType}". What content would you like to include?`,
      actions: ['open_prompt_editor'],
      data: { name: promptName, type: promptType },
      suggestions: [
        'Add test cases',
        'Set model parameters',
        'Configure assertions'
      ]
    };
  }

  /**
   * Handle run test command
   */
  private async handleRunTest(entities: Record<string, string>): Promise<VoiceResponse> {
    const testName = entities.test || entities.prompt;
    const model = entities.model || 'default';
    
    if (!testName) {
      return {
        text: 'Which test would you like to run? Please specify the test name or prompt card.',
        suggestions: ['List available tests', 'Show recent tests', 'Help with testing']
      };
    }

    return {
      text: `Running test "${testName}" with model "${model}". I'll notify you when it's complete.`,
      actions: ['start_test_execution'],
      data: { testName, model },
      suggestions: [
        'Monitor progress',
        'View live results',
        'Run additional tests'
      ]
    };
  }

  /**
   * Handle analytics request
   */
  private async handleGetAnalytics(entities: Record<string, string>): Promise<VoiceResponse> {
    const timeframe = entities.timeframe || 'today';
    const metric = entities.metric || 'overview';
    
    try {
      const metrics = await this.analyticsEngine.getDashboardMetrics();
      
      let responseText = '';
      let data = {};

      switch (metric) {
        case 'success_rate':
          responseText = `Current success rate is ${(metrics.realtime.successRate * 100).toFixed(1)}%. `;
          responseText += `Overall success rate is ${(metrics.historical.overallSuccessRate * 100).toFixed(1)}%.`;
          data = { successRate: metrics.realtime.successRate };
          break;
          
        case 'performance':
          responseText = `Average response time is ${metrics.realtime.averageResponseTime.toFixed(0)} milliseconds. `;
          responseText += `You have ${metrics.realtime.activeTests} active tests running.`;
          data = { responseTime: metrics.realtime.averageResponseTime };
          break;
          
        default:
          responseText = `Here's your analytics overview: `;
          responseText += `${metrics.historical.totalTests} total tests, `;
          responseText += `${(metrics.realtime.successRate * 100).toFixed(1)}% success rate, `;
          responseText += `${metrics.realtime.averageResponseTime.toFixed(0)}ms average response time.`;
          data = metrics;
      }

      return {
        text: responseText,
        data,
        actions: ['show_analytics_dashboard'],
        suggestions: [
          'Show performance trends',
          'View detailed metrics',
          'Export analytics report'
        ]
      };
    } catch (error) {
      return {
        text: 'I encountered an error retrieving analytics data. Please try again or check the dashboard manually.',
        suggestions: ['Try again', 'Check dashboard', 'Contact support']
      };
    }
  }

  /**
   * Handle metrics display
   */
  private async handleShowMetrics(entities: Record<string, string>): Promise<VoiceResponse> {
    const metricType = entities.type || 'all';
    
    return {
      text: `Displaying ${metricType} metrics on your dashboard. You can also ask me specific questions about the data.`,
      actions: ['show_metrics_dashboard'],
      data: { metricType },
      suggestions: [
        'What was yesterday\'s performance?',
        'Show model comparison',
        'Export this data'
      ]
    };
  }

  /**
   * Handle report export
   */
  private async handleExportReport(entities: Record<string, string>): Promise<VoiceResponse> {
    const format = entities.format || 'pdf';
    const timeframe = entities.timeframe || 'last_week';
    
    return {
      text: `Generating ${format.toUpperCase()} report for ${timeframe}. I'll notify you when it's ready for download.`,
      actions: ['generate_report'],
      data: { format, timeframe },
      suggestions: [
        'Schedule regular reports',
        'Customize report content',
        'Share with team'
      ]
    };
  }

  /**
   * Handle model comparison
   */
  private async handleCompareModels(entities: Record<string, string>): Promise<VoiceResponse> {
    const model1 = entities.model1;
    const model2 = entities.model2;
    const metric = entities.metric || 'performance';
    
    if (!model1 || !model2) {
      return {
        text: 'Please specify which two models you\'d like to compare.',
        suggestions: [
          'Compare GPT-4 and Claude',
          'Show available models',
          'View model statistics'
        ]
      };
    }

    return {
      text: `Comparing ${model1} and ${model2} based on ${metric}. Displaying results on your screen.`,
      actions: ['show_model_comparison'],
      data: { model1, model2, metric },
      suggestions: [
        'Compare different metrics',
        'Add more models',
        'Export comparison'
      ]
    };
  }

  /**
   * Handle prompt optimization
   */
  private async handleOptimizePrompt(entities: Record<string, string>): Promise<VoiceResponse> {
    const promptId = entities.prompt || entities.id;
    
    return {
      text: `Analyzing prompt for optimization opportunities. I'll suggest improvements based on performance data and best practices.`,
      actions: ['optimize_prompt'],
      data: { promptId },
      suggestions: [
        'Apply suggested changes',
        'Run A/B test',
        'View optimization history'
      ]
    };
  }

  /**
   * Handle test scheduling
   */
  private async handleScheduleTest(entities: Record<string, string>): Promise<VoiceResponse> {
    const schedule = entities.schedule || entities.time;
    const test = entities.test || entities.prompt;
    
    return {
      text: `Scheduling test "${test}" to run ${schedule}. You'll receive notifications about the results.`,
      actions: ['schedule_test'],
      data: { test, schedule },
      suggestions: [
        'Set up recurring tests',
        'Configure notifications',
        'View scheduled tests'
      ]
    };
  }

  /**
   * Handle voice settings
   */
  private async handleVoiceSettings(entities: Record<string, string>): Promise<VoiceResponse> {
    const setting = entities.setting;
    const value = entities.value;
    
    return {
      text: 'Opening voice settings. You can configure language, speech rate, and voice preferences here.',
      actions: ['open_voice_settings'],
      data: { setting, value },
      suggestions: [
        'Change language',
        'Adjust speech rate',
        'Test voice output'
      ]
    };
  }

  /**
   * Handle unknown intents
   */
  private handleUnknownIntent(command: VoiceCommand): VoiceResponse {
    return {
      text: `I didn't understand that command. Could you please rephrase it? I can help with creating prompts, running tests, viewing analytics, and more.`,
      suggestions: [
        'Create a new prompt',
        'Run a test',
        'Show analytics',
        'Help me with voice commands'
      ]
    };
  }

  /**
   * Convert speech to text
   */
  private async speechToText(audioData: ArrayBuffer, language: string): Promise<string> {
    // This would integrate with a speech-to-text service like Google Speech-to-Text
    // For now, returning a placeholder
    return "placeholder transcription";
  }

  /**
   * Convert text to speech
   */
  public async textToSpeech(text: string, language: string = 'en-US'): Promise<ArrayBuffer> {
    // This would integrate with a text-to-speech service
    // For now, returning empty buffer
    return new ArrayBuffer(0);
  }

  /**
   * Start a voice session
   */
  public startVoiceSession(userId: string): string {
    this.activeSession = `session_${Date.now()}_${userId}`;
    this.emit('sessionStarted', this.activeSession);
    return this.activeSession;
  }

  /**
   * End voice session
   */
  public endVoiceSession(): void {
    if (this.activeSession) {
      this.emit('sessionEnded', this.activeSession);
      this.activeSession = null;
    }
  }

  /**
   * Get supported languages
   */
  public getSupportedLanguages(): string[] {
    return [...this.supportedLanguages];
  }

  /**
   * Configure voice settings
   */
  public configureVoiceSettings(settings: {
    language?: string;
    speechRate?: number;
    pitch?: number;
    volume?: number;
  }): void {
    // Store voice settings configuration
    this.emit('settingsChanged', settings);
  }
}

/**
 * Advanced NLP Processor for voice commands
 */
class AdvancedNLPProcessor implements NaturalLanguageProcessor {
  private intentPatterns: Map<string, RegExp[]>;
  private entityExtractors: Map<string, RegExp>;

  constructor() {
    this.intentPatterns = new Map();
    this.entityExtractors = new Map();
    this.initializePatterns();
  }

  private initializePatterns(): void {
    // Intent patterns
    this.intentPatterns.set('create_prompt', [
      /create\s+(?:a\s+)?(?:new\s+)?prompt/i,
      /new\s+prompt/i,
      /make\s+(?:a\s+)?prompt/i
    ]);

    this.intentPatterns.set('run_test', [
      /run\s+(?:the\s+)?test/i,
      /execute\s+(?:the\s+)?test/i,
      /start\s+(?:the\s+)?test/i,
      /test\s+(?:the\s+)?prompt/i
    ]);

    this.intentPatterns.set('get_analytics', [
      /show\s+(?:me\s+)?analytics/i,
      /get\s+(?:the\s+)?analytics/i,
      /analytics\s+(?:data|information)/i,
      /performance\s+(?:data|metrics)/i
    ]);

    this.intentPatterns.set('show_metrics', [
      /show\s+(?:me\s+)?metrics/i,
      /display\s+metrics/i,
      /view\s+metrics/i
    ]);

    this.intentPatterns.set('export_report', [
      /export\s+(?:a\s+)?report/i,
      /generate\s+(?:a\s+)?report/i,
      /create\s+(?:a\s+)?report/i,
      /download\s+report/i
    ]);

    this.intentPatterns.set('compare_models', [
      /compare\s+(?:the\s+)?models/i,
      /model\s+comparison/i,
      /compare\s+\w+\s+(?:and|with|to)\s+\w+/i
    ]);

    this.intentPatterns.set('optimize_prompt', [
      /optimize\s+(?:the\s+)?prompt/i,
      /improve\s+(?:the\s+)?prompt/i,
      /enhance\s+(?:the\s+)?prompt/i
    ]);

    this.intentPatterns.set('schedule_test', [
      /schedule\s+(?:a\s+)?test/i,
      /set\s+up\s+(?:a\s+)?test/i,
      /recurring\s+test/i
    ]);

    this.intentPatterns.set('voice_settings', [
      /voice\s+settings/i,
      /configure\s+voice/i,
      /change\s+language/i,
      /speech\s+settings/i
    ]);

    // Entity extractors
    this.entityExtractors.set('name', /(?:called|named)\s+["']?([^"'\s]+)["']?/i);
    this.entityExtractors.set('type', /(?:type|kind)\s+["']?([^"'\s]+)["']?/i);
    this.entityExtractors.set('model', /(?:model|using)\s+["']?([^"'\s]+)["']?/i);
    this.entityExtractors.set('timeframe', /(?:for|from|over)\s+(?:the\s+)?(?:last\s+)?([^"'\s]+)/i);
    this.entityExtractors.set('metric', /(?:metric|measure)\s+["']?([^"'\s]+)["']?/i);
    this.entityExtractors.set('format', /(?:as|in)\s+([a-z]{3,4})\s+(?:format)?/i);
  }

  public async processCommand(text: string): Promise<{
    intent: string;
    entities: Record<string, string>;
    confidence: number;
  }> {
    const normalizedText = text.toLowerCase().trim();
    let bestIntent = 'unknown';
    let maxScore = 0;

    // Find best matching intent
    for (const [intent, patterns] of this.intentPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedText)) {
          const score = this.calculatePatternScore(normalizedText, pattern);
          if (score > maxScore) {
            maxScore = score;
            bestIntent = intent;
          }
        }
      }
    }

    // Extract entities
    const entities: Record<string, string> = {};
    for (const [entityType, extractor] of this.entityExtractors) {
      const match = text.match(extractor);
      if (match && match[1]) {
        entities[entityType] = match[1];
      }
    }

    const confidence = maxScore > 0 ? Math.min(maxScore / 10, 1) : 0.1;

    return {
      intent: bestIntent,
      entities,
      confidence
    };
  }

  private calculatePatternScore(text: string, pattern: RegExp): number {
    const match = text.match(pattern);
    if (!match) return 0;
    
    // Score based on match length and position
    const matchLength = match[0].length;
    const textLength = text.length;
    const positionScore = 1 - (match.index! / textLength);
    const lengthScore = matchLength / textLength;
    
    return (positionScore + lengthScore) * 5;
  }
}