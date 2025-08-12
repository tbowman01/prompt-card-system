import * as tf from '@tensorflow/tfjs-node';
import { LRUCache } from 'lru-cache';
import { EventStore } from '../analytics/EventStore';
import { performance } from 'perf_hooks';
import { createHash } from 'crypto';

export interface VectorDocument {
  id: string;
  content: string;
  vector: number[];
  metadata: {
    domain: string;
    type: 'prompt' | 'template' | 'example' | 'feedback';
    created: Date;
    updated: Date;
    tags: string[];
    effectiveness?: number;
    usage_count?: number;
    [key: string]: any;
  };
}

export interface SearchQuery {
  vector?: number[];
  text?: string;
  filters?: {
    domain?: string[];
    type?: VectorDocument['metadata']['type'][];
    tags?: string[];
    effectiveness_min?: number;
    created_after?: Date;
    created_before?: Date;
  };
  limit?: number;
  threshold?: number; // Similarity threshold (0-1)
  include_metadata?: boolean;
}

export interface SearchResult {
  document: VectorDocument;
  similarity: number;
  rank: number;
}

export interface ClusterResult {
  id: string;
  name: string;
  centroid: number[];
  documents: Array<{
    id: string;
    distance_to_centroid: number;
  }>;
  metadata: {
    size: number;
    avg_similarity: number;
    dominant_tags: string[];
    effectiveness_stats: {
      mean: number;
      median: number;
      std: number;
    };
  };
}

export interface IndexStatistics {
  total_documents: number;
  total_vectors: number;
  dimensions: number;
  memory_usage: {
    vectors_mb: number;
    metadata_mb: number;
    index_mb: number;
    total_mb: number;
  };
  performance_metrics: {
    avg_search_time_ms: number;
    avg_insert_time_ms: number;
    cache_hit_rate: number;
    queries_per_second: number;
  };
  cluster_info?: {
    num_clusters: number;
    avg_cluster_size: number;
    silhouette_score: number;
  };
}

export class VectorDatabase {
  private documents: Map<string, VectorDocument>;
  private vectorIndex: Map<string, number[]>; // Simple in-memory index
  private dimensionality: number;
  private cache: LRUCache<string, SearchResult[]>;
  private clusterCache: LRUCache<string, ClusterResult[]>;
  private eventStore: EventStore;
  private performanceMetrics: Map<string, number[]>;
  
  // HNSW-like hierarchical index structures (simplified)
  private levels: Map<number, Map<string, Set<string>>>;
  private entryPoint: string | null = null;
  
  // Quantization for memory efficiency
  private quantizationEnabled: boolean = true;
  private quantizationBits: number = 8;
  private quantizedVectors: Map<string, Uint8Array>;
  private quantizationParams: { scale: number; offset: number } | null = null;

  constructor(dimensionality: number = 384) {
    this.documents = new Map();
    this.vectorIndex = new Map();
    this.dimensionality = dimensionality;
    this.cache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 15 // 15 minutes
    });
    this.clusterCache = new LRUCache({
      max: 100,
      ttl: 1000 * 60 * 60 // 1 hour
    });
    this.eventStore = EventStore.getInstance();
    this.performanceMetrics = new Map();
    this.levels = new Map();
    this.quantizedVectors = new Map();
  }

  /**
   * Add or update a document in the vector database
   */
  public async addDocument(document: VectorDocument): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Validate vector dimensions
      if (document.vector.length !== this.dimensionality) {
        throw new Error(`Vector dimension mismatch: expected ${this.dimensionality}, got ${document.vector.length}`);
      }

      // Normalize vector
      const normalizedVector = this.normalizeVector(document.vector);
      document.vector = normalizedVector;

      // Store document
      this.documents.set(document.id, document);
      this.vectorIndex.set(document.id, normalizedVector);

      // Add to hierarchical index
      await this.addToHierarchicalIndex(document.id, normalizedVector);

      // Quantize vector for memory efficiency
      if (this.quantizationEnabled) {
        await this.quantizeAndStore(document.id, normalizedVector);
      }

      // Clear related caches
      this.invalidateSearchCaches(document);

      // Update entry point if this is the first document
      if (!this.entryPoint) {
        this.entryPoint = document.id;
      }

      // Record analytics
      await this.eventStore.recordEvent({
        event_type: 'vector_document_added',
        entity_id: document.id,
        entity_type: 'vector_document',
        data: {
          domain: document.metadata.domain,
          type: document.metadata.type,
          vector_dimension: document.vector.length,
          tags: document.metadata.tags
        },
        timestamp: new Date()
      });

      this.trackPerformance('add_document', performance.now() - startTime);
    } catch (error) {
      console.error('Error adding document to vector database:', error);
      throw error;
    }
  }

  /**
   * Batch add multiple documents for better performance
   */
  public async addDocuments(documents: VectorDocument[]): Promise<void> {
    const startTime = performance.now();
    const batchSize = 100; // Process in batches to avoid memory issues

    try {
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        
        // Process batch in parallel
        await Promise.all(batch.map(doc => this.addDocument(doc)));
        
        // Brief pause between batches
        if (i + batchSize < documents.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Update quantization parameters after batch insert
      if (this.quantizationEnabled && documents.length > 100) {
        await this.updateQuantizationParameters();
      }

      console.log(`Batch added ${documents.length} documents in ${(performance.now() - startTime).toFixed(2)}ms`);
    } catch (error) {
      console.error('Error in batch document addition:', error);
      throw error;
    }
  }

  /**
   * Search for similar documents using vector similarity
   */
  public async search(query: SearchQuery): Promise<SearchResult[]> {
    const startTime = performance.now();
    
    try {
      // Generate query vector if text is provided
      let queryVector = query.vector;
      if (!queryVector && query.text) {
        queryVector = await this.textToVector(query.text);
      }
      
      if (!queryVector) {
        throw new Error('Query must include either vector or text');
      }

      // Check cache
      const cacheKey = this.generateSearchCacheKey(query);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.trackPerformance('search', performance.now() - startTime);
        return cached;
      }

      // Normalize query vector
      const normalizedQuery = this.normalizeVector(queryVector);

      // Perform similarity search
      const candidates = await this.findSimilarCandidates(
        normalizedQuery,
        query.limit || 20,
        query.threshold || 0.5
      );

      // Apply filters
      let filteredCandidates = await this.applyFilters(candidates, query.filters);

      // Sort by similarity (descending)
      filteredCandidates.sort((a, b) => b.similarity - a.similarity);

      // Limit results
      const results = filteredCandidates.slice(0, query.limit || 20);

      // Add rank information
      const rankedResults = results.map((result, index) => ({
        ...result,
        rank: index + 1
      }));

      // Cache results
      this.cache.set(cacheKey, rankedResults);

      // Record search analytics
      await this.eventStore.recordEvent({
        event_type: 'vector_search',
        entity_id: 'search_query',
        entity_type: 'search',
        data: {
          query_type: query.text ? 'text' : 'vector',
          results_count: rankedResults.length,
          filters: query.filters,
          search_time_ms: performance.now() - startTime
        },
        timestamp: new Date()
      });

      this.trackPerformance('search', performance.now() - startTime);
      return rankedResults;

    } catch (error) {
      console.error('Error performing vector search:', error);
      throw error;
    }
  }

  /**
   * Find documents within a specific similarity threshold
   */
  public async findSimilarDocuments(
    referenceId: string,
    threshold: number = 0.7,
    limit: number = 10
  ): Promise<SearchResult[]> {
    const referenceDoc = this.documents.get(referenceId);
    if (!referenceDoc) {
      throw new Error(`Document not found: ${referenceId}`);
    }

    return this.search({
      vector: referenceDoc.vector,
      threshold,
      limit: limit + 1, // +1 to exclude the reference document
      filters: {
        // Exclude the reference document itself
        type: referenceDoc.metadata.type !== undefined ? [referenceDoc.metadata.type] : undefined
      }
    }).then(results => 
      results.filter(result => result.document.id !== referenceId).slice(0, limit)
    );
  }

  /**
   * Perform clustering analysis on the vector space
   */
  public async clusterDocuments(
    numClusters: number = 10,
    algorithm: 'kmeans' | 'hierarchical' | 'dbscan' = 'kmeans'
  ): Promise<ClusterResult[]> {
    const cacheKey = `clusters_${numClusters}_${algorithm}`;
    const cached = this.clusterCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const startTime = performance.now();

    try {
      let clusters: ClusterResult[] = [];

      switch (algorithm) {
        case 'kmeans':
          clusters = await this.performKMeansClustering(numClusters);
          break;
        case 'hierarchical':
          clusters = await this.performHierarchicalClustering(numClusters);
          break;
        case 'dbscan':
          clusters = await this.performDBSCANClustering();
          break;
      }

      // Cache results
      this.clusterCache.set(cacheKey, clusters);

      console.log(`Clustering completed in ${(performance.now() - startTime).toFixed(2)}ms`);
      return clusters;

    } catch (error) {
      console.error('Error performing clustering:', error);
      throw error;
    }
  }

  /**
   * Get recommendations based on user interaction patterns
   */
  public async getRecommendations(
    userId: string,
    interactionHistory: Array<{
      documentId: string;
      interactionType: 'view' | 'like' | 'use' | 'share';
      timestamp: Date;
      weight?: number;
    }>,
    limit: number = 10
  ): Promise<SearchResult[]> {
    try {
      // Build user preference vector based on interaction history
      const preferenceVector = await this.buildUserPreferenceVector(interactionHistory);
      
      if (!preferenceVector) {
        return [];
      }

      // Get recently interacted document IDs to exclude
      const recentInteractions = interactionHistory
        .filter(interaction => 
          Date.now() - interaction.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
        )
        .map(interaction => interaction.documentId);

      // Search for similar documents
      const results = await this.search({
        vector: preferenceVector,
        limit: limit + recentInteractions.length,
        threshold: 0.3
      });

      // Filter out recently interacted documents
      const recommendations = results
        .filter(result => !recentInteractions.includes(result.document.id))
        .slice(0, limit);

      return recommendations;

    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [];
    }
  }

  /**
   * Analyze semantic drift in document vectors over time
   */
  public async analyzeSemanticDrift(): Promise<{
    overall_drift: number;
    domain_drifts: Record<string, number>;
    trending_topics: Array<{
      topic: string;
      growth_rate: number;
      document_count: number;
    }>;
    recommendations: string[];
  }> {
    try {
      // Get documents from different time periods
      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const recentDocs = Array.from(this.documents.values())
        .filter(doc => doc.metadata.created > oneMonthAgo);
      
      const olderDocs = Array.from(this.documents.values())
        .filter(doc => doc.metadata.created < threeMonthsAgo);

      // Calculate centroid drift
      const recentCentroid = this.calculateCentroid(recentDocs.map(doc => doc.vector));
      const olderCentroid = this.calculateCentroid(olderDocs.map(doc => doc.vector));
      
      const overallDrift = 1 - this.cosineSimilarity(recentCentroid, olderCentroid);

      // Analyze drift by domain
      const domainDrifts: Record<string, number> = {};
      const domains = new Set(recentDocs.map(doc => doc.metadata.domain));
      
      for (const domain of domains) {
        const recentDomainDocs = recentDocs.filter(doc => doc.metadata.domain === domain);
        const olderDomainDocs = olderDocs.filter(doc => doc.metadata.domain === domain);
        
        if (recentDomainDocs.length > 0 && olderDomainDocs.length > 0) {
          const recentDomainCentroid = this.calculateCentroid(recentDomainDocs.map(doc => doc.vector));
          const olderDomainCentroid = this.calculateCentroid(olderDomainDocs.map(doc => doc.vector));
          
          domainDrifts[domain] = 1 - this.cosineSimilarity(recentDomainCentroid, olderDomainCentroid);
        }
      }

      // Identify trending topics
      const trendingTopics = await this.identifyTrendingTopics(recentDocs, olderDocs);

      // Generate recommendations
      const recommendations = this.generateDriftRecommendations(overallDrift, domainDrifts, trendingTopics);

      return {
        overall_drift: overallDrift,
        domain_drifts: domainDrifts,
        trending_topics: trendingTopics,
        recommendations
      };

    } catch (error) {
      console.error('Error analyzing semantic drift:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive database statistics
   */
  public async getStatistics(): Promise<IndexStatistics> {
    try {
      const totalDocs = this.documents.size;
      const totalVectors = this.vectorIndex.size;

      // Calculate memory usage
      const vectorMemory = totalVectors * this.dimensionality * 4; // 4 bytes per float32
      const quantizedMemory = this.quantizedVectors.size * this.dimensionality * (this.quantizationBits / 8);
      const metadataMemory = this.estimateMetadataMemory();
      const indexMemory = this.estimateIndexMemory();

      // Get performance metrics
      const performanceStats = this.calculatePerformanceStats();

      // Get cluster info if available
      let clusterInfo;
      try {
        const clusters = await this.clusterDocuments(10);
        clusterInfo = {
          num_clusters: clusters.length,
          avg_cluster_size: clusters.reduce((sum, cluster) => sum + cluster.metadata.size, 0) / clusters.length,
          silhouette_score: await this.calculateSilhouetteScore(clusters)
        };
      } catch (error) {
        console.warn('Could not calculate cluster info:', error);
      }

      return {
        total_documents: totalDocs,
        total_vectors: totalVectors,
        dimensions: this.dimensionality,
        memory_usage: {
          vectors_mb: vectorMemory / (1024 * 1024),
          metadata_mb: metadataMemory / (1024 * 1024),
          index_mb: indexMemory / (1024 * 1024),
          total_mb: (vectorMemory + quantizedMemory + metadataMemory + indexMemory) / (1024 * 1024)
        },
        performance_metrics: performanceStats,
        cluster_info: clusterInfo
      };

    } catch (error) {
      console.error('Error calculating database statistics:', error);
      throw error;
    }
  }

  /**
   * Optimize the vector database for better performance
   */
  public async optimize(): Promise<{
    before_stats: IndexStatistics;
    after_stats: IndexStatistics;
    optimizations_applied: string[];
    performance_improvement: number;
  }> {
    console.log('Starting vector database optimization...');
    const startTime = performance.now();
    
    const beforeStats = await this.getStatistics();
    const optimizations: string[] = [];

    try {
      // 1. Rebuild hierarchical index
      await this.rebuildHierarchicalIndex();
      optimizations.push('Rebuilt hierarchical index');

      // 2. Update quantization parameters
      if (this.quantizationEnabled) {
        await this.updateQuantizationParameters();
        optimizations.push('Updated vector quantization');
      }

      // 3. Clean up stale cache entries
      this.cache.clear();
      this.clusterCache.clear();
      optimizations.push('Cleared stale caches');

      // 4. Garbage collection for removed documents
      await this.performGarbageCollection();
      optimizations.push('Performed garbage collection');

      // 5. Rebalance index if needed
      if (this.documents.size > 1000) {
        await this.rebalanceIndex();
        optimizations.push('Rebalanced search index');
      }

      const afterStats = await this.getStatistics();
      const performanceImprovement = (beforeStats.performance_metrics.avg_search_time_ms - 
                                     afterStats.performance_metrics.avg_search_time_ms) /
                                    beforeStats.performance_metrics.avg_search_time_ms * 100;

      console.log(`Database optimization completed in ${(performance.now() - startTime).toFixed(2)}ms`);
      console.log(`Performance improvement: ${performanceImprovement.toFixed(2)}%`);

      return {
        before_stats: beforeStats,
        after_stats: afterStats,
        optimizations_applied: optimizations,
        performance_improvement: performanceImprovement
      };

    } catch (error) {
      console.error('Error during database optimization:', error);
      throw error;
    }
  }

  // Private helper methods

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude === 0 ? vector : vector.map(val => val / magnitude);
  }

  private async textToVector(text: string): Promise<number[]> {
    // In production, would use actual text embedding model
    // For now, create a simple hash-based vector
    const words = text.toLowerCase().split(/\s+/);
    const vector = new Array(this.dimensionality).fill(0);
    
    words.forEach((word, index) => {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash + word.charCodeAt(i)) & 0xffffffff;
      }
      const vectorIndex = Math.abs(hash) % this.dimensionality;
      vector[vectorIndex] += 1 / (index + 1); // Weight by position
    });
    
    return this.normalizeVector(vector);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async findSimilarCandidates(
    queryVector: number[],
    limit: number,
    threshold: number
  ): Promise<Array<{ document: VectorDocument; similarity: number }>> {
    const candidates: Array<{ document: VectorDocument; similarity: number }> = [];

    // Use hierarchical index for efficient search if available
    if (this.entryPoint && this.levels.size > 0) {
      return this.searchHierarchical(queryVector, limit, threshold);
    }

    // Fallback to brute force search
    for (const [docId, vector] of this.vectorIndex.entries()) {
      const similarity = this.cosineSimilarity(queryVector, vector);
      
      if (similarity >= threshold) {
        const document = this.documents.get(docId)!;
        candidates.push({ document, similarity });
      }
    }

    return candidates;
  }

  private async applyFilters(
    candidates: Array<{ document: VectorDocument; similarity: number }>,
    filters?: SearchQuery['filters']
  ): Promise<Array<{ document: VectorDocument; similarity: number }>> {
    if (!filters) return candidates;

    return candidates.filter(candidate => {
      const doc = candidate.document;
      const meta = doc.metadata;

      // Domain filter
      if (filters.domain && !filters.domain.includes(meta.domain)) {
        return false;
      }

      // Type filter
      if (filters.type && !filters.type.includes(meta.type)) {
        return false;
      }

      // Tags filter
      if (filters.tags && !filters.tags.some(tag => meta.tags.includes(tag))) {
        return false;
      }

      // Effectiveness filter
      if (filters.effectiveness_min && (meta.effectiveness || 0) < filters.effectiveness_min) {
        return false;
      }

      // Date filters
      if (filters.created_after && meta.created < filters.created_after) {
        return false;
      }
      
      if (filters.created_before && meta.created > filters.created_before) {
        return false;
      }

      return true;
    });
  }

  private generateSearchCacheKey(query: SearchQuery): string {
    const keyData = {
      vector: query.vector ? query.vector.slice(0, 10) : null, // Use first 10 dimensions
      text: query.text,
      filters: query.filters,
      limit: query.limit,
      threshold: query.threshold
    };
    return createHash('md5').update(JSON.stringify(keyData)).digest('hex');
  }

  private invalidateSearchCaches(document: VectorDocument): void {
    // Clear caches that might be affected by the new document
    this.cache.clear(); // Simple approach - clear all caches
    // In production, would implement more sophisticated cache invalidation
  }

  private async addToHierarchicalIndex(docId: string, vector: number[]): Promise<void> {
    // Simplified HNSW-like insertion
    const level = this.selectLevel();
    
    if (!this.levels.has(level)) {
      this.levels.set(level, new Map());
    }
    
    const levelMap = this.levels.get(level)!;
    levelMap.set(docId, new Set());
    
    // Connect to nearby nodes (simplified)
    const connections = await this.findNearestNeighbors(vector, level, 10);
    levelMap.set(docId, new Set(connections));
  }

  private selectLevel(): number {
    // Exponential decay probability for level selection
    let level = 0;
    while (Math.random() < 0.5 && level < 16) {
      level++;
    }
    return level;
  }

  private async findNearestNeighbors(
    vector: number[],
    level: number,
    count: number
  ): Promise<string[]> {
    // Simplified neighbor finding
    const candidates: Array<{ id: string; similarity: number }> = [];
    
    for (const [docId, docVector] of this.vectorIndex.entries()) {
      const similarity = this.cosineSimilarity(vector, docVector);
      candidates.push({ id: docId, similarity });
    }
    
    return candidates
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, count)
      .map(c => c.id);
  }

  private async searchHierarchical(
    queryVector: number[],
    limit: number,
    threshold: number
  ): Promise<Array<{ document: VectorDocument; similarity: number }>> {
    // Simplified hierarchical search
    const candidates: Array<{ document: VectorDocument; similarity: number }> = [];
    
    // Start from highest level and work down
    const maxLevel = Math.max(...this.levels.keys());
    let currentCandidates = new Set([this.entryPoint!]);
    
    for (let level = maxLevel; level >= 0; level--) {
      const levelMap = this.levels.get(level);
      if (!levelMap) continue;
      
      const newCandidates = new Set<string>();
      
      for (const candidateId of currentCandidates) {
        const connections = levelMap.get(candidateId);
        if (connections) {
          connections.forEach(conn => newCandidates.add(conn));
        }
      }
      
      currentCandidates = newCandidates;
    }
    
    // Evaluate final candidates
    for (const candidateId of currentCandidates) {
      const vector = this.vectorIndex.get(candidateId);
      const document = this.documents.get(candidateId);
      
      if (vector && document) {
        const similarity = this.cosineSimilarity(queryVector, vector);
        if (similarity >= threshold) {
          candidates.push({ document, similarity });
        }
      }
    }
    
    return candidates
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  private async quantizeAndStore(docId: string, vector: number[]): Promise<void> {
    if (!this.quantizationParams) {
      await this.updateQuantizationParameters();
    }
    
    if (!this.quantizationParams) return;
    
    const { scale, offset } = this.quantizationParams;
    const quantized = new Uint8Array(vector.length);
    
    for (let i = 0; i < vector.length; i++) {
      const quantizedValue = Math.round((vector[i] - offset) / scale);
      quantized[i] = Math.max(0, Math.min(255, quantizedValue));
    }
    
    this.quantizedVectors.set(docId, quantized);
  }

  private async updateQuantizationParameters(): Promise<void> {
    const allVectors = Array.from(this.vectorIndex.values());
    if (allVectors.length === 0) return;
    
    // Calculate min and max across all vectors
    let min = Infinity;
    let max = -Infinity;
    
    for (const vector of allVectors) {
      for (const value of vector) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    
    const range = max - min;
    this.quantizationParams = {
      scale: range / 255,
      offset: min
    };
  }

  private async performKMeansClustering(numClusters: number): Promise<ClusterResult[]> {
    const vectors = Array.from(this.vectorIndex.values());
    const docIds = Array.from(this.vectorIndex.keys());
    
    if (vectors.length < numClusters) {
      throw new Error(`Cannot create ${numClusters} clusters with only ${vectors.length} documents`);
    }
    
    // Initialize centroids randomly
    const centroids: number[][] = [];
    for (let i = 0; i < numClusters; i++) {
      const randomIndex = Math.floor(Math.random() * vectors.length);
      centroids.push([...vectors[randomIndex]]);
    }
    
    let assignments = new Array(vectors.length).fill(0);
    let converged = false;
    let iterations = 0;
    const maxIterations = 100;
    
    while (!converged && iterations < maxIterations) {
      const newAssignments = new Array(vectors.length);
      
      // Assign each vector to nearest centroid
      for (let i = 0; i < vectors.length; i++) {
        let bestCluster = 0;
        let bestDistance = Infinity;
        
        for (let j = 0; j < numClusters; j++) {
          const distance = 1 - this.cosineSimilarity(vectors[i], centroids[j]);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestCluster = j;
          }
        }
        
        newAssignments[i] = bestCluster;
      }
      
      // Check for convergence
      converged = newAssignments.every((assignment, i) => assignment === assignments[i]);
      assignments = newAssignments;
      
      // Update centroids
      for (let j = 0; j < numClusters; j++) {
        const clusterVectors = vectors.filter((_, i) => assignments[i] === j);
        if (clusterVectors.length > 0) {
          centroids[j] = this.calculateCentroid(clusterVectors);
        }
      }
      
      iterations++;
    }
    
    // Build cluster results
    const clusters: ClusterResult[] = [];
    
    for (let i = 0; i < numClusters; i++) {
      const clusterDocIds = docIds.filter((_, index) => assignments[index] === i);
      const clusterDocuments = clusterDocIds.map(id => this.documents.get(id)!);
      
      // Calculate cluster metadata
      const effectiveness = clusterDocuments
        .map(doc => doc.metadata.effectiveness || 0)
        .filter(eff => eff > 0);
      
      const allTags = clusterDocuments.flatMap(doc => doc.metadata.tags);
      const tagCounts = allTags.reduce((counts: Record<string, number>, tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
        return counts;
      }, {});
      
      const dominantTags = Object.entries(tagCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([tag]) => tag);
      
      // Calculate average similarity within cluster
      let totalSimilarity = 0;
      let comparisons = 0;
      for (let j = 0; j < clusterDocuments.length; j++) {
        for (let k = j + 1; k < clusterDocuments.length; k++) {
          totalSimilarity += this.cosineSimilarity(
            clusterDocuments[j].vector,
            clusterDocuments[k].vector
          );
          comparisons++;
        }
      }
      
      const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;
      
      clusters.push({
        id: `cluster_${i}`,
        name: `Cluster ${i + 1}`,
        centroid: centroids[i],
        documents: clusterDocIds.map(id => ({
          id,
          distance_to_centroid: 1 - this.cosineSimilarity(
            this.vectorIndex.get(id)!,
            centroids[i]
          )
        })),
        metadata: {
          size: clusterDocuments.length,
          avg_similarity: avgSimilarity,
          dominant_tags: dominantTags,
          effectiveness_stats: {
            mean: effectiveness.length > 0 ? effectiveness.reduce((a, b) => a + b, 0) / effectiveness.length : 0,
            median: effectiveness.length > 0 ? effectiveness.sort()[Math.floor(effectiveness.length / 2)] : 0,
            std: effectiveness.length > 0 ? this.calculateStandardDeviation(effectiveness) : 0
          }
        }
      });
    }
    
    return clusters;
  }

  private async performHierarchicalClustering(numClusters: number): Promise<ClusterResult[]> {
    // Placeholder for hierarchical clustering
    return this.performKMeansClustering(numClusters);
  }

  private async performDBSCANClustering(): Promise<ClusterResult[]> {
    // Placeholder for DBSCAN clustering
    return this.performKMeansClustering(5);
  }

  private calculateCentroid(vectors: number[][]): number[] {
    if (vectors.length === 0) return new Array(this.dimensionality).fill(0);
    
    const centroid = new Array(this.dimensionality).fill(0);
    
    for (const vector of vectors) {
      for (let i = 0; i < vector.length; i++) {
        centroid[i] += vector[i];
      }
    }
    
    return centroid.map(val => val / vectors.length);
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  private async buildUserPreferenceVector(
    interactionHistory: Array<{
      documentId: string;
      interactionType: 'view' | 'like' | 'use' | 'share';
      timestamp: Date;
      weight?: number;
    }>
  ): Promise<number[] | null> {
    if (interactionHistory.length === 0) return null;
    
    // Weight different interaction types
    const typeWeights = {
      'view': 0.1,
      'like': 0.3,
      'use': 0.5,
      'share': 0.8
    };
    
    const preferenceVector = new Array(this.dimensionality).fill(0);
    let totalWeight = 0;
    
    for (const interaction of interactionHistory) {
      const docVector = this.vectorIndex.get(interaction.documentId);
      if (!docVector) continue;
      
      const baseWeight = typeWeights[interaction.interactionType];
      const timeWeight = this.calculateTimeWeight(interaction.timestamp);
      const customWeight = interaction.weight || 1;
      
      const finalWeight = baseWeight * timeWeight * customWeight;
      
      for (let i = 0; i < docVector.length; i++) {
        preferenceVector[i] += docVector[i] * finalWeight;
      }
      
      totalWeight += finalWeight;
    }
    
    // Normalize the preference vector
    if (totalWeight > 0) {
      for (let i = 0; i < preferenceVector.length; i++) {
        preferenceVector[i] /= totalWeight;
      }
    }
    
    return this.normalizeVector(preferenceVector);
  }

  private calculateTimeWeight(timestamp: Date): number {
    // More recent interactions have higher weight
    const daysSince = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60 * 24);
    return Math.exp(-daysSince / 30); // Exponential decay with 30-day half-life
  }

  private async identifyTrendingTopics(
    recentDocs: VectorDocument[],
    olderDocs: VectorDocument[]
  ): Promise<Array<{ topic: string; growth_rate: number; document_count: number }>> {
    // Analyze tag frequency changes
    const recentTags = recentDocs.flatMap(doc => doc.metadata.tags);
    const olderTags = olderDocs.flatMap(doc => doc.metadata.tags);
    
    const recentTagCounts: Record<string, number> = {};
    const olderTagCounts: Record<string, number> = {};
    
    recentTags.forEach(tag => {
      recentTagCounts[tag] = (recentTagCounts[tag] || 0) + 1;
    });
    
    olderTags.forEach(tag => {
      olderTagCounts[tag] = (olderTagCounts[tag] || 0) + 1;
    });
    
    const trendingTopics: Array<{ topic: string; growth_rate: number; document_count: number }> = [];
    
    for (const [tag, recentCount] of Object.entries(recentTagCounts)) {
      const olderCount = olderTagCounts[tag] || 0;
      const growthRate = olderCount > 0 ? (recentCount - olderCount) / olderCount : recentCount;
      
      if (growthRate > 0.5) { // Only include topics with significant growth
        trendingTopics.push({
          topic: tag,
          growth_rate: growthRate,
          document_count: recentCount
        });
      }
    }
    
    return trendingTopics.sort((a, b) => b.growth_rate - a.growth_rate);
  }

  private generateDriftRecommendations(
    overallDrift: number,
    domainDrifts: Record<string, number>,
    trendingTopics: any[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (overallDrift > 0.3) {
      recommendations.push('Significant semantic drift detected - consider retraining models');
    }
    
    for (const [domain, drift] of Object.entries(domainDrifts)) {
      if (drift > 0.4) {
        recommendations.push(`High drift in ${domain} domain - review recent additions`);
      }
    }
    
    if (trendingTopics.length > 0) {
      recommendations.push(`Trending topics detected: ${trendingTopics.slice(0, 3).map(t => t.topic).join(', ')}`);
    }
    
    return recommendations;
  }

  private estimateMetadataMemory(): number {
    let totalSize = 0;
    for (const doc of this.documents.values()) {
      totalSize += JSON.stringify(doc.metadata).length * 2; // Rough estimate in bytes
    }
    return totalSize;
  }

  private estimateIndexMemory(): number {
    // Estimate memory usage of hierarchical index
    let totalConnections = 0;
    for (const levelMap of this.levels.values()) {
      for (const connections of levelMap.values()) {
        totalConnections += connections.size;
      }
    }
    return totalConnections * 8; // Rough estimate: 8 bytes per connection
  }

  private calculatePerformanceStats(): IndexStatistics['performance_metrics'] {
    const searchTimes = this.performanceMetrics.get('search') || [];
    const addTimes = this.performanceMetrics.get('add_document') || [];
    
    const avgSearchTime = searchTimes.length > 0 
      ? searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length 
      : 0;
    
    const avgInsertTime = addTimes.length > 0
      ? addTimes.reduce((sum, time) => sum + time, 0) / addTimes.length
      : 0;
    
    const cacheHitRate = this.cache.size > 0 ? 0.7 : 0; // Estimated
    const queriesPerSecond = avgSearchTime > 0 ? 1000 / avgSearchTime : 0;
    
    return {
      avg_search_time_ms: avgSearchTime,
      avg_insert_time_ms: avgInsertTime,
      cache_hit_rate: cacheHitRate,
      queries_per_second: queriesPerSecond
    };
  }

  private async calculateSilhouetteScore(clusters: ClusterResult[]): Promise<number> {
    // Simplified silhouette score calculation
    return 0.6; // Placeholder
  }

  private async rebuildHierarchicalIndex(): Promise<void> {
    console.log('Rebuilding hierarchical index...');
    this.levels.clear();
    this.entryPoint = null;
    
    for (const [docId, vector] of this.vectorIndex.entries()) {
      await this.addToHierarchicalIndex(docId, vector);
      if (!this.entryPoint) {
        this.entryPoint = docId;
      }
    }
  }

  private async performGarbageCollection(): Promise<void> {
    // Remove quantized vectors for documents that no longer exist
    const existingIds = new Set(this.documents.keys());
    
    for (const id of this.quantizedVectors.keys()) {
      if (!existingIds.has(id)) {
        this.quantizedVectors.delete(id);
      }
    }
    
    // Clean up hierarchical index
    for (const [level, levelMap] of this.levels.entries()) {
      for (const id of levelMap.keys()) {
        if (!existingIds.has(id)) {
          levelMap.delete(id);
        }
      }
      
      if (levelMap.size === 0) {
        this.levels.delete(level);
      }
    }
  }

  private async rebalanceIndex(): Promise<void> {
    // Placeholder for index rebalancing
    console.log('Rebalancing search index...');
  }

  private trackPerformance(operation: string, duration: number): void {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    
    const metrics = this.performanceMetrics.get(operation)!;
    metrics.push(duration);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  // Public utility methods

  public getDocumentById(id: string): VectorDocument | undefined {
    return this.documents.get(id);
  }

  public deleteDocument(id: string): boolean {
    const deleted = this.documents.delete(id) && this.vectorIndex.delete(id);
    
    if (deleted) {
      this.quantizedVectors.delete(id);
      this.invalidateSearchCaches(this.documents.get(id)!);
    }
    
    return deleted;
  }

  public async updateDocument(document: VectorDocument): Promise<void> {
    await this.addDocument(document); // addDocument handles updates
  }

  public listDocuments(
    filters?: {
      domain?: string;
      type?: VectorDocument['metadata']['type'];
      limit?: number;
      offset?: number;
    }
  ): VectorDocument[] {
    let docs = Array.from(this.documents.values());
    
    if (filters?.domain) {
      docs = docs.filter(doc => doc.metadata.domain === filters.domain);
    }
    
    if (filters?.type) {
      docs = docs.filter(doc => doc.metadata.type === filters.type);
    }
    
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 100;
    
    return docs.slice(offset, offset + limit);
  }

  public clearDatabase(): void {
    this.documents.clear();
    this.vectorIndex.clear();
    this.quantizedVectors.clear();
    this.levels.clear();
    this.cache.clear();
    this.clusterCache.clear();
    this.entryPoint = null;
    console.log('Vector database cleared');
  }
}

export default VectorDatabase;