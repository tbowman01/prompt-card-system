import * as tf from '@tensorflow/tfjs-node';

export interface SimilarityResult {
  similarity: number;
  confidence: number;
  method: string;
}

export interface SentimentResult {
  label: 'positive' | 'negative' | 'neutral';
  score: number;
  details?: Record<string, number>;
}

export interface LanguageResult {
  language: string;
  confidence: number;
  alternatives?: Array<{ language: string; confidence: number }>;
}

export interface ToxicityResult {
  score: number;
  categories: Record<string, number>;
  threshold: number;
}

export class SemanticSimilarityValidator {
  private model: any = null;
  private modelName: string = 'universal-sentence-encoder';
  private initialized: boolean = false;

  constructor() {
    // Initialize TensorFlow.js backend
    tf.setBackend('cpu');
  }

  /**
   * Initialize the semantic similarity validator
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing SemanticSimilarityValidator...');
      
      // For now, we'll use a simple fallback implementation
      // In a production environment, you'd load actual transformer models
      this.initialized = true;
      
      console.log('✅ SemanticSimilarityValidator initialized with fallback implementation');
    } catch (error) {
      console.error('❌ Failed to initialize SemanticSimilarityValidator:', error);
      throw error;
    }
  }

  /**
   * Compute semantic similarity between two texts
   */
  async computeSimilarity(text1: string, text2: string): Promise<number> {
    if (!this.initialized) {
      throw new Error('SemanticSimilarityValidator not initialized');
    }

    try {
      // Fallback implementation using simple text similarity
      // In production, this would use sentence embeddings
      const similarity = await this.computeTextSimilarity(text1, text2);
      return similarity;
    } catch (error) {
      console.error('Error computing similarity:', error);
      throw error;
    }
  }

  /**
   * Analyze sentiment of text
   */
  async analyzeSentiment(text: string): Promise<SentimentResult> {
    if (!this.initialized) {
      throw new Error('SemanticSimilarityValidator not initialized');
    }

    try {
      // Simple sentiment analysis based on keywords
      const sentiment = this.analyzeSentimentSimple(text);
      return sentiment;
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      throw error;
    }
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<LanguageResult> {
    if (!this.initialized) {
      throw new Error('SemanticSimilarityValidator not initialized');
    }

    try {
      // Simple language detection based on common words
      const language = this.detectLanguageSimple(text);
      return language;
    } catch (error) {
      console.error('Error detecting language:', error);
      throw error;
    }
  }

  /**
   * Detect toxicity in text
   */
  async detectToxicity(text: string): Promise<ToxicityResult> {
    if (!this.initialized) {
      throw new Error('SemanticSimilarityValidator not initialized');
    }

    try {
      // Simple toxicity detection based on keyword matching
      const toxicity = this.detectToxicitySimple(text);
      return toxicity;
    } catch (error) {
      console.error('Error detecting toxicity:', error);
      throw error;
    }
  }

  /**
   * Get the model name being used
   */
  getModelName(): string {
    return this.modelName;
  }

  /**
   * Fallback text similarity using cosine similarity of TF-IDF vectors
   */
  private async computeTextSimilarity(text1: string, text2: string): Promise<number> {
    // Normalize and tokenize texts
    const tokens1 = this.tokenize(text1.toLowerCase());
    const tokens2 = this.tokenize(text2.toLowerCase());
    
    // Create vocabulary
    const vocabulary = Array.from(new Set([...tokens1, ...tokens2]));
    
    // Create TF-IDF vectors
    const vector1 = this.createTFIDFVector(tokens1, vocabulary);
    const vector2 = this.createTFIDFVector(tokens2, vocabulary);
    
    // Compute cosine similarity
    const similarity = this.cosineSimilarity(vector1, vector2);
    
    return Math.max(0, Math.min(1, similarity));
  }

  /**
   * Simple tokenization
   */
  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  /**
   * Create TF-IDF vector for tokens
   */
  private createTFIDFVector(tokens: string[], vocabulary: string[]): number[] {
    const vector = new Array(vocabulary.length).fill(0);
    const tokenCounts = new Map<string, number>();
    
    // Count token frequencies
    tokens.forEach(token => {
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
    });
    
    // Calculate TF-IDF
    vocabulary.forEach((word, index) => {
      const tf = (tokenCounts.get(word) || 0) / tokens.length;
      // Simplified IDF (in production, use proper corpus-based IDF)
      const idf = Math.log(vocabulary.length / (1 + (tokenCounts.has(word) ? 1 : 0)));
      vector[index] = tf * idf;
    });
    
    return vector;
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }
    
    const magnitude1 = Math.sqrt(norm1);
    const magnitude2 = Math.sqrt(norm2);
    
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }
    
    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Simple sentiment analysis using keyword matching
   */
  private analyzeSentimentSimple(text: string): SentimentResult {
    const positiveWords = [
      'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome',
      'love', 'like', 'enjoy', 'happy', 'pleased', 'satisfied', 'perfect',
      'best', 'better', 'brilliant', 'outstanding', 'superb', 'magnificent',
      'yes', 'correct', 'right', 'accurate', 'successful', 'win', 'victory'
    ];
    
    const negativeWords = [
      'bad', 'terrible', 'awful', 'horrible', 'disgusting', 'hate', 'dislike',
      'angry', 'sad', 'disappointed', 'frustrated', 'annoyed', 'upset',
      'wrong', 'incorrect', 'error', 'fail', 'failure', 'loss', 'defeat',
      'no', 'not', 'never', 'nothing', 'none', 'worst', 'worse'
    ];
    
    const words = this.tokenize(text.toLowerCase());
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) {
        positiveScore++;
      } else if (negativeWords.includes(word)) {
        negativeScore++;
      }
    });
    
    const totalWords = words.length;
    const netScore = (positiveScore - negativeScore) / Math.max(1, totalWords);
    
    let label: 'positive' | 'negative' | 'neutral';
    let score: number;
    
    if (netScore > 0.1) {
      label = 'positive';
      score = Math.min(1, netScore * 5);
    } else if (netScore < -0.1) {
      label = 'negative';
      score = Math.min(1, Math.abs(netScore) * 5);
    } else {
      label = 'neutral';
      score = 0.5;
    }
    
    return {
      label,
      score,
      details: {
        positive: positiveScore,
        negative: negativeScore,
        neutral: totalWords - positiveScore - negativeScore,
        netScore
      }
    };
  }

  /**
   * Simple language detection using common words
   */
  private detectLanguageSimple(text: string): LanguageResult {
    const languageKeywords = {
      'en': ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with', 'for', 'as', 'was', 'on', 'are'],
      'es': ['el', 'la', 'de', 'que', 'y', 'es', 'en', 'un', 'se', 'no', 'te', 'lo', 'le', 'da', 'su'],
      'fr': ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que', 'pour', 'dans', 'ce', 'son'],
      'de': ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im'],
      'it': ['il', 'di', 'che', 'e', 'la', 'per', 'un', 'in', 'con', 'del', 'da', 'a', 'al', 'le', 'si'],
      'pt': ['o', 'de', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma', 'os', 'no'],
      'ru': ['в', 'и', 'не', 'на', 'я', 'быть', 'то', 'он', 'оно', 'как', 'с', 'а', 'но', 'за', 'по'],
      'zh': ['的', '是', '在', '了', '和', '有', '一', '我', '不', '你', '他', '这', '个', '人', '来']
    };
    
    const words = this.tokenize(text.toLowerCase());
    const scores: Record<string, number> = {};
    
    // Calculate scores for each language
    Object.entries(languageKeywords).forEach(([lang, keywords]) => {
      let score = 0;
      words.forEach(word => {
        if (keywords.includes(word)) {
          score++;
        }
      });
      scores[lang] = score / Math.max(1, words.length);
    });
    
    // Find the language with highest score
    const sortedLanguages = Object.entries(scores)
      .sort(([, a], [, b]) => b - a);
    
    const [topLanguage, topScore] = sortedLanguages[0];
    
    return {
      language: topLanguage,
      confidence: Math.min(1, topScore * 10),
      alternatives: sortedLanguages.slice(1, 4).map(([lang, score]) => ({
        language: lang,
        confidence: Math.min(1, score * 10)
      }))
    };
  }

  /**
   * Simple toxicity detection using keyword matching
   */
  private detectToxicitySimple(text: string): ToxicityResult {
    const toxicKeywords = {
      profanity: ['damn', 'hell', 'crap', 'stupid', 'idiot', 'moron', 'dumb'],
      harassment: ['hate', 'kill', 'die', 'destroy', 'hurt', 'harm', 'attack'],
      threats: ['threat', 'threaten', 'violence', 'violent', 'dangerous', 'weapon'],
      discrimination: ['racist', 'sexist', 'bigot', 'discrimination', 'prejudice'],
      spam: ['spam', 'advertisement', 'promotion', 'click', 'buy', 'sale', 'offer']
    };
    
    const words = this.tokenize(text.toLowerCase());
    const categoryScores: Record<string, number> = {};
    
    // Calculate scores for each toxicity category
    Object.entries(toxicKeywords).forEach(([category, keywords]) => {
      let score = 0;
      words.forEach(word => {
        if (keywords.includes(word)) {
          score++;
        }
      });
      categoryScores[category] = score / Math.max(1, words.length);
    });
    
    // Calculate overall toxicity score
    const overallScore = Object.values(categoryScores).reduce((sum, score) => sum + score, 0);
    
    return {
      score: Math.min(1, overallScore * 2),
      categories: categoryScores,
      threshold: 0.3
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.initialized = false;
  }
}