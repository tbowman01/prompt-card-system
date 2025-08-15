import natural from 'natural';
import { EventEmitter } from 'events';

export interface SimilarityOptions {
  algorithm?: 'jaccard' | 'cosine' | 'levenshtein' | 'combined';
  weights?: {
    title?: number;
    body?: number;
    labels?: number;
    metadata?: number;
  };
  minTokenLength?: number;
  removeStopWords?: boolean;
  stemming?: boolean;
  ngramSize?: number;
}

export interface SimilarityResult {
  overall: number;
  title: number;
  body: number;
  labels: number;
  metadata: number;
  confidence: number;
  algorithm: string;
}

export class SimilarityScorer extends EventEmitter {
  private tfidf: natural.TfIdf;
  private tokenizer: natural.WordTokenizer;
  private stemmer: natural.PorterStemmer;
  private sentimentAnalyzer: natural.SentimentAnalyzer;
  private options: Required<SimilarityOptions>;
  private stopWords: Set<string>;

  constructor(options: SimilarityOptions = {}) {
    super();
    
    this.options = {
      algorithm: options.algorithm || 'combined',
      weights: {
        title: options.weights?.title ?? 0.35,
        body: options.weights?.body ?? 0.35,
        labels: options.weights?.labels ?? 0.15,
        metadata: options.weights?.metadata ?? 0.15
      },
      minTokenLength: options.minTokenLength ?? 2,
      removeStopWords: options.removeStopWords ?? true,
      stemming: options.stemming ?? true,
      ngramSize: options.ngramSize ?? 2
    };

    this.tfidf = new natural.TfIdf();
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
    this.sentimentAnalyzer = new natural.SentimentAnalyzer('English', 
      natural.PorterStemmer, 'afinn');
    
    this.stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are', 'was',
      'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'can', 'could',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this', 'that',
      'these', 'those', 'am', 'is', 'are', 'was', 'were', 'being',
      'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
      'will', 'would', 'should', 'could', 'ought', 'i\'m', 'you\'re',
      'he\'s', 'she\'s', 'it\'s', 'we\'re', 'they\'re', 'i\'ve',
      'you\'ve', 'we\'ve', 'they\'ve', 'i\'d', 'you\'d', 'he\'d',
      'she\'d', 'we\'d', 'they\'d', 'i\'ll', 'you\'ll', 'he\'ll',
      'she\'ll', 'we\'ll', 'they\'ll', 'isn\'t', 'aren\'t', 'wasn\'t',
      'weren\'t', 'hasn\'t', 'haven\'t', 'hadn\'t', 'doesn\'t', 'don\'t',
      'didn\'t', 'won\'t', 'wouldn\'t', 'shan\'t', 'shouldn\'t',
      'can\'t', 'cannot', 'couldn\'t', 'mustn\'t', 'here', 'there',
      'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few',
      'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
      'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't',
      'just', 'don', 'now'
    ]);
  }

  public calculateSimilarity(
    item1: any, 
    item2: any
  ): SimilarityResult {
    const titleSim = this.calculateTextSimilarity(
      item1.title || '', 
      item2.title || ''
    );
    
    const bodySim = this.calculateTextSimilarity(
      item1.body || '', 
      item2.body || ''
    );
    
    const labelSim = this.calculateLabelSimilarity(
      item1.labels || [], 
      item2.labels || []
    );
    
    const metadataSim = this.calculateMetadataSimilarity(item1, item2);
    
    // Calculate weighted overall similarity
    const weights = this.options.weights;
    const overall = (
      titleSim * weights.title! +
      bodySim * weights.body! +
      labelSim * weights.labels! +
      metadataSim * weights.metadata!
    );
    
    // Calculate confidence based on content availability
    const confidence = this.calculateConfidence(item1, item2);
    
    const result: SimilarityResult = {
      overall,
      title: titleSim,
      body: bodySim,
      labels: labelSim,
      metadata: metadataSim,
      confidence,
      algorithm: this.options.algorithm
    };
    
    this.emit('similarity-calculated', result);
    return result;
  }

  private preprocessText(text: string): string[] {
    // Remove URLs
    text = text.replace(/https?:\/\/[^\s]+/g, '');
    
    // Remove code blocks and inline code
    text = text.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/`[^`]+`/g, '');
    
    // Remove HTML tags
    text = text.replace(/<[^>]*>/g, '');
    
    // Remove special characters but keep spaces
    text = text.replace(/[^\w\s]/g, ' ');
    
    // Tokenize
    let tokens = this.tokenizer.tokenize(text.toLowerCase()) || [];
    
    // Remove stop words if configured
    if (this.options.removeStopWords) {
      tokens = tokens.filter(token => !this.stopWords.has(token));
    }
    
    // Filter by minimum length
    tokens = tokens.filter(token => token.length >= this.options.minTokenLength);
    
    // Apply stemming if configured
    if (this.options.stemming) {
      tokens = tokens.map(token => this.stemmer.stem(token));
    }
    
    return tokens;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 && !text2) return 1;
    if (!text1 || !text2) return 0;
    
    const tokens1 = this.preprocessText(text1);
    const tokens2 = this.preprocessText(text2);
    
    if (tokens1.length === 0 && tokens2.length === 0) return 1;
    if (tokens1.length === 0 || tokens2.length === 0) return 0;
    
    switch (this.options.algorithm) {
      case 'jaccard':
        return this.jaccardSimilarity(tokens1, tokens2);
      
      case 'cosine':
        return this.cosineSimilarity(tokens1, tokens2);
      
      case 'levenshtein':
        return this.normalizedLevenshtein(
          tokens1.join(' '), 
          tokens2.join(' ')
        );
      
      case 'combined':
      default:
        return this.combinedSimilarity(tokens1, tokens2);
    }
  }

  private jaccardSimilarity(tokens1: string[], tokens2: string[]): number {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private cosineSimilarity(tokens1: string[], tokens2: string[]): number {
    // Create frequency maps
    const freq1 = this.getFrequencyMap(tokens1);
    const freq2 = this.getFrequencyMap(tokens2);
    
    // Get all unique terms
    const terms = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    terms.forEach(term => {
      const val1 = freq1[term] || 0;
      const val2 = freq2[term] || 0;
      
      dotProduct += val1 * val2;
      magnitude1 += val1 * val1;
      magnitude2 += val2 * val2;
    });
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
  }

  private normalizedLevenshtein(str1: string, str2: string): number {
    const distance = natural.LevenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    
    return maxLength > 0 ? 1 - (distance / maxLength) : 1;
  }

  private combinedSimilarity(tokens1: string[], tokens2: string[]): number {
    // Combine multiple algorithms for better accuracy
    const jaccard = this.jaccardSimilarity(tokens1, tokens2);
    const cosine = this.cosineSimilarity(tokens1, tokens2);
    const ngram = this.ngramSimilarity(tokens1, tokens2);
    
    // Weighted combination
    return (jaccard * 0.3 + cosine * 0.5 + ngram * 0.2);
  }

  private ngramSimilarity(tokens1: string[], tokens2: string[]): number {
    const ngrams1 = this.getNgrams(tokens1, this.options.ngramSize);
    const ngrams2 = this.getNgrams(tokens2, this.options.ngramSize);
    
    if (ngrams1.length === 0 && ngrams2.length === 0) return 1;
    if (ngrams1.length === 0 || ngrams2.length === 0) return 0;
    
    const set1 = new Set(ngrams1);
    const set2 = new Set(ngrams2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private getNgrams(tokens: string[], n: number): string[] {
    const ngrams: string[] = [];
    
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(' '));
    }
    
    return ngrams;
  }

  private getFrequencyMap(tokens: string[]): Record<string, number> {
    const freq: Record<string, number> = {};
    
    tokens.forEach(token => {
      freq[token] = (freq[token] || 0) + 1;
    });
    
    // Normalize frequencies
    const total = tokens.length;
    Object.keys(freq).forEach(key => {
      freq[key] = freq[key] / total;
    });
    
    return freq;
  }

  private calculateLabelSimilarity(labels1: any[], labels2: any[]): number {
    if (labels1.length === 0 && labels2.length === 0) return 1;
    if (labels1.length === 0 || labels2.length === 0) return 0;
    
    const set1 = new Set(labels1.map(l => 
      typeof l === 'string' ? l : l.name
    ));
    const set2 = new Set(labels2.map(l => 
      typeof l === 'string' ? l : l.name
    ));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateMetadataSimilarity(item1: any, item2: any): number {
    let score = 0;
    let factors = 0;
    
    // Check author similarity
    if (item1.user?.login && item2.user?.login) {
      if (item1.user.login === item2.user.login) {
        score += 1;
      }
      factors++;
    }
    
    // Check time proximity (issues created close in time might be related)
    if (item1.created_at && item2.created_at) {
      const date1 = new Date(item1.created_at).getTime();
      const date2 = new Date(item2.created_at).getTime();
      const daysDiff = Math.abs(date1 - date2) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < 1) score += 1;
      else if (daysDiff < 7) score += 0.7;
      else if (daysDiff < 30) score += 0.3;
      
      factors++;
    }
    
    // Check milestone
    if (item1.milestone && item2.milestone) {
      if (item1.milestone.id === item2.milestone.id) {
        score += 1;
      }
      factors++;
    }
    
    // Check assignees overlap
    if (item1.assignees?.length > 0 && item2.assignees?.length > 0) {
      const assignees1 = new Set(item1.assignees.map((a: any) => a.login));
      const assignees2 = new Set(item2.assignees.map((a: any) => a.login));
      const overlap = [...assignees1].filter(a => assignees2.has(a)).length;
      
      if (overlap > 0) {
        score += overlap / Math.max(assignees1.size, assignees2.size);
      }
      factors++;
    }
    
    return factors > 0 ? score / factors : 0;
  }

  private calculateConfidence(item1: any, item2: any): number {
    let confidence = 0;
    let factors = 0;
    
    // Check content completeness
    if (item1.title && item2.title) {
      confidence += 0.3;
      factors += 0.3;
    }
    
    if (item1.body && item2.body) {
      const len1 = item1.body.length;
      const len2 = item2.body.length;
      
      if (len1 > 100 && len2 > 100) {
        confidence += 0.4;
      } else if (len1 > 50 && len2 > 50) {
        confidence += 0.2;
      } else {
        confidence += 0.1;
      }
      factors += 0.4;
    }
    
    if (item1.labels?.length > 0 && item2.labels?.length > 0) {
      confidence += 0.2;
      factors += 0.2;
    }
    
    if ((item1.comments || 0) > 0 && (item2.comments || 0) > 0) {
      confidence += 0.1;
      factors += 0.1;
    }
    
    return factors > 0 ? confidence / factors : 0.5;
  }

  public async batchCalculate(
    items: any[], 
    targetItem: any
  ): Promise<SimilarityResult[]> {
    const results: SimilarityResult[] = [];
    
    for (const item of items) {
      if (item.number === targetItem.number) continue;
      
      const similarity = this.calculateSimilarity(targetItem, item);
      results.push(similarity);
    }
    
    return results.sort((a, b) => b.overall - a.overall);
  }
}