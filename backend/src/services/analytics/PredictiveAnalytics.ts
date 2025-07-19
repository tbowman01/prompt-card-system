import * as tf from '@tensorflow/tfjs-node';
import { EventStore, AnalyticsEvent } from './EventStore';
import { AnalyticsEngine } from './AnalyticsEngine';
import { PerformanceMonitor } from '../performance/PerformanceMonitor';
import { LRUCache } from 'lru-cache';
import { performance } from 'perf_hooks';

export interface PredictionModel {
  id: string;
  name: string;
  type: 'capacity' | 'anomaly' | 'performance' | 'cost';
  model: tf.LayersModel;
  metadata: {
    trainedAt: Date;
    accuracy: number;
    features: string[];
    targetVariable: string;
    sampleSize: number;
    version: string;
  };
}

export interface CapacityPrediction {
  metric: string;
  timeframe: '1h' | '6h' | '24h' | '7d' | '30d';
  currentValue: number;
  predictedValue: number;
  confidence: number;
  threshold: number;
  willExceedThreshold: boolean;
  timeToThreshold?: Date;
  recommendations: string[];
}

export interface AnomalyDetection {
  id: string;
  metric: string;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  timestamp: Date;
  context: Record<string, any>;
  recommendations: string[];
}

export interface MLInsight {
  id: string;
  type: 'trend' | 'correlation' | 'pattern' | 'forecast';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  data: any;
  timestamp: Date;
  recommendations: string[];
  relatedMetrics: string[];
}

export interface TrainingData {
  features: number[][];
  labels: number[];
  timestamps: Date[];
  metadata: Record<string, any>;
}

export class PredictiveAnalytics {
  private models: Map<string, PredictionModel>;
  private cache: LRUCache<string, any>;
  private eventStore: EventStore;
  private analyticsEngine: AnalyticsEngine;
  private performanceMonitor: PerformanceMonitor;
  private isTraining: boolean = false;
  private lastTrainingTime: Date | null = null;
  private anomalyThresholds: Map<string, { mean: number; stdDev: number; threshold: number }>;

  constructor() {
    this.models = new Map();
    this.cache = new LRUCache({
      max: 500,
      ttl: 1000 * 60 * 10 // 10 minutes cache for predictions
    });
    this.eventStore = EventStore.getInstance();
    this.analyticsEngine = AnalyticsEngine.getInstance();
    this.performanceMonitor = new PerformanceMonitor();
    this.anomalyThresholds = new Map();
    
    // Initialize TensorFlow.js
    this.initializeTensorFlow();
    
    // Load pre-trained models if available
    this.loadExistingModels();
  }

  /**
   * Initialize TensorFlow.js backend
   */
  private async initializeTensorFlow(): Promise<void> {
    try {
      await tf.ready();
      console.log('TensorFlow.js backend initialized:', tf.getBackend());
    } catch (error) {
      console.error('Failed to initialize TensorFlow.js:', error);
    }
  }

  /**
   * Train capacity planning model
   */
  public async trainCapacityModel(
    metric: string,
    timeframeDays: number = 30
  ): Promise<PredictionModel> {
    if (this.isTraining) {
      throw new Error('Training already in progress');
    }

    this.isTraining = true;
    const startTime = performance.now();

    try {
      console.log(`Training capacity prediction model for ${metric}...`);

      // Collect training data
      const trainingData = await this.collectTrainingData(metric, timeframeDays);
      
      if (trainingData.features.length < 50) {
        throw new Error(`Insufficient training data: ${trainingData.features.length} samples`);
      }

      // Prepare data tensors
      const { xTrain, yTrain, xValidation, yValidation } = this.prepareTrainingData(trainingData);

      // Create and configure model
      const model = this.createCapacityModel(trainingData.features[0].length);

      // Train model
      const history = await this.trainModel(model, xTrain, yTrain, xValidation, yValidation);

      // Evaluate model
      const accuracy = await this.evaluateModel(model, xValidation, yValidation);

      // Create prediction model object
      const predictionModel: PredictionModel = {
        id: `capacity_${metric}_${Date.now()}`,
        name: `Capacity Prediction for ${metric}`,
        type: 'capacity',
        model,
        metadata: {
          trainedAt: new Date(),
          accuracy,
          features: this.getFeatureNames(),
          targetVariable: metric,
          sampleSize: trainingData.features.length,
          version: '1.0.0'
        }
      };

      // Store model
      this.models.set(predictionModel.id, predictionModel);

      // Save model to disk
      await this.saveModel(predictionModel);

      this.lastTrainingTime = new Date();
      console.log(`Capacity model trained in ${(performance.now() - startTime).toFixed(2)}ms with accuracy: ${accuracy.toFixed(4)}`);

      return predictionModel;

    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Train anomaly detection model
   */
  public async trainAnomalyModel(
    metrics: string[],
    timeframeDays: number = 30
  ): Promise<PredictionModel> {
    if (this.isTraining) {
      throw new Error('Training already in progress');
    }

    this.isTraining = true;
    const startTime = performance.now();

    try {
      console.log(`Training anomaly detection model for metrics: ${metrics.join(', ')}...`);

      // Collect multi-metric training data
      const trainingData = await this.collectMultiMetricTrainingData(metrics, timeframeDays);
      
      if (trainingData.features.length < 100) {
        throw new Error(`Insufficient training data: ${trainingData.features.length} samples`);
      }

      // Calculate statistical thresholds for each metric
      await this.calculateAnomalyThresholds(trainingData);

      // Create autoencoder for anomaly detection
      const model = this.createAnomalyModel(trainingData.features[0].length);

      // Prepare training data (anomaly detection is unsupervised)
      const xTensor = tf.tensor2d(trainingData.features);
      const { xTrain, xValidation } = this.splitData(xTensor, 0.8);

      // Train autoencoder
      const history = await model.fit(xTrain, xTrain, {
        epochs: 100,
        batchSize: 32,
        validationData: [xValidation, xValidation],
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              console.log(`Epoch ${epoch}: loss = ${logs?.loss?.toFixed(4)}, val_loss = ${logs?.val_loss?.toFixed(4)}`);
            }
          }
        }
      });

      // Calculate reconstruction threshold
      const reconstructionErrors = await this.calculateReconstructionErrors(model, xValidation);
      const threshold = this.calculateAnomalyThreshold(reconstructionErrors);

      const predictionModel: PredictionModel = {
        id: `anomaly_${metrics.join('_')}_${Date.now()}`,
        name: `Anomaly Detection for ${metrics.join(', ')}`,
        type: 'anomaly',
        model,
        metadata: {
          trainedAt: new Date(),
          accuracy: threshold,
          features: metrics,
          targetVariable: 'anomaly_score',
          sampleSize: trainingData.features.length,
          version: '1.0.0'
        }
      };

      this.models.set(predictionModel.id, predictionModel);
      await this.saveModel(predictionModel);

      this.lastTrainingTime = new Date();
      console.log(`Anomaly model trained in ${(performance.now() - startTime).toFixed(2)}ms`);

      return predictionModel;

    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Generate capacity predictions
   */
  public async predictCapacity(
    metric: string,
    timeframe: CapacityPrediction['timeframe'] = '24h'
  ): Promise<CapacityPrediction> {
    const cacheKey = `capacity_prediction_${metric}_${timeframe}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const model = this.findBestModel('capacity', metric);
    if (!model) {
      throw new Error(`No capacity model available for metric: ${metric}`);
    }

    // Get recent data for prediction
    const recentData = await this.getRecentDataForPrediction(metric, 24); // Last 24 hours
    
    if (recentData.length === 0) {
      throw new Error(`No recent data available for metric: ${metric}`);
    }

    // Prepare input features
    const features = this.extractFeatures(recentData);
    const inputTensor = tf.tensor2d([features]);

    // Make prediction
    const prediction = model.model.predict(inputTensor) as tf.Tensor;
    const predictedValue = (await prediction.data())[0];

    // Get current value
    const currentValue = recentData[recentData.length - 1].value;

    // Calculate confidence based on model accuracy and data variance
    const confidence = this.calculatePredictionConfidence(model, recentData);

    // Get threshold for this metric
    const threshold = await this.getMetricThreshold(metric);

    // Determine if threshold will be exceeded
    const willExceedThreshold = predictedValue > threshold;

    // Estimate time to threshold if applicable
    const timeToThreshold = willExceedThreshold 
      ? this.estimateTimeToThreshold(recentData, threshold, timeframe)
      : undefined;

    // Generate recommendations
    const recommendations = this.generateCapacityRecommendations(
      metric,
      currentValue,
      predictedValue,
      threshold,
      willExceedThreshold
    );

    const result: CapacityPrediction = {
      metric,
      timeframe,
      currentValue,
      predictedValue,
      confidence,
      threshold,
      willExceedThreshold,
      timeToThreshold,
      recommendations
    };

    // Cache result
    this.cache.set(cacheKey, result, { ttl: this.getTTLForTimeframe(timeframe) });

    // Cleanup tensors
    inputTensor.dispose();
    prediction.dispose();

    return result;
  }

  /**
   * Detect anomalies in real-time data
   */
  public async detectAnomalies(
    metrics: string[] = ['cpu_usage', 'memory_usage', 'app_response_time']
  ): Promise<AnomalyDetection[]> {
    const cacheKey = `anomaly_detection_${metrics.join('_')}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const model = this.findBestModel('anomaly', metrics.join('_'));
    if (!model) {
      throw new Error(`No anomaly model available for metrics: ${metrics.join(', ')}`);
    }

    const anomalies: AnomalyDetection[] = [];

    // Get recent data for all metrics
    const recentDataMap = new Map<string, any[]>();
    for (const metric of metrics) {
      const data = await this.getRecentDataForPrediction(metric, 1); // Last hour
      recentDataMap.set(metric, data);
    }

    // Process each time window
    const timeWindows = this.createTimeWindows(recentDataMap, 5); // 5-minute windows

    for (const window of timeWindows) {
      // Extract features for this time window
      const features = this.extractAnomalyFeatures(window, metrics);
      
      if (features.length === 0) continue;

      // Get expected values using model
      const inputTensor = tf.tensor2d([features]);
      const reconstruction = model.model.predict(inputTensor) as tf.Tensor;
      const reconstructedValues = await reconstruction.data();

      // Calculate reconstruction error
      const reconstructionError = this.calculateReconstructionError(features, Array.from(reconstructedValues));

      // Check against threshold
      const threshold = this.anomalyThresholds.get(metrics.join('_'))?.threshold || 0.1;
      
      if (reconstructionError > threshold) {
        // Determine which metrics are anomalous
        for (let i = 0; i < metrics.length; i++) {
          const metric = metrics[i];
          const currentValue = features[i];
          const expectedValue = reconstructedValues[i];
          const deviation = Math.abs(currentValue - expectedValue);

          if (deviation > this.getMetricAnomalyThreshold(metric)) {
            const anomaly: AnomalyDetection = {
              id: `anomaly_${metric}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              metric,
              value: currentValue,
              expectedValue,
              deviation,
              severity: this.determineSeverity(deviation, this.getMetricAnomalyThreshold(metric)),
              probability: Math.min(reconstructionError / threshold, 1.0),
              timestamp: window.timestamp,
              context: {
                reconstructionError,
                threshold,
                allMetrics: Object.fromEntries(
                  metrics.map((m, idx) => [m, features[idx]])
                )
              },
              recommendations: this.generateAnomalyRecommendations(metric, deviation)
            };

            anomalies.push(anomaly);
          }
        }
      }

      // Cleanup tensors
      inputTensor.dispose();
      reconstruction.dispose();
    }

    // Cache results for a short time
    this.cache.set(cacheKey, anomalies, { ttl: 1000 * 60 * 2 }); // 2 minutes

    return anomalies;
  }

  /**
   * Generate ML-powered insights
   */
  public async generateMLInsights(): Promise<MLInsight[]> {
    const insights: MLInsight[] = [];

    try {
      // Correlation analysis
      const correlationInsights = await this.analyzeCorrelations();
      insights.push(...correlationInsights);

      // Pattern recognition
      const patternInsights = await this.recognizePatterns();
      insights.push(...patternInsights);

      // Trend forecasting
      const trendInsights = await this.forecastTrends();
      insights.push(...trendInsights);

      // Performance bottleneck analysis
      const bottleneckInsights = await this.analyzeBottlenecks();
      insights.push(...bottleneckInsights);

    } catch (error) {
      console.error('Error generating ML insights:', error);
    }

    return insights;
  }

  /**
   * Get growth projections for capacity planning
   */
  public async getGrowthProjections(
    metric: string,
    projectionDays: number = 30
  ): Promise<{
    current: number;
    projected: number;
    growthRate: number;
    projectionDates: Date[];
    projectedValues: number[];
    confidence: number;
    recommendations: string[];
  }> {
    const model = this.findBestModel('capacity', metric);
    if (!model) {
      throw new Error(`No capacity model available for metric: ${metric}`);
    }

    // Get historical data for trend analysis
    const historicalData = await this.getRecentDataForPrediction(metric, projectionDays * 3);
    
    if (historicalData.length === 0) {
      throw new Error(`No historical data available for metric: ${metric}`);
    }

    // Calculate growth rate
    const growthRate = this.calculateGrowthRate(historicalData);

    // Generate projections
    const projectionDates: Date[] = [];
    const projectedValues: number[] = [];
    const currentValue = historicalData[historicalData.length - 1].value;

    for (let i = 1; i <= projectionDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      projectionDates.push(date);

      // Use model to predict future value
      const features = this.extrapolateFeatures(historicalData, i);
      const inputTensor = tf.tensor2d([features]);
      const prediction = model.model.predict(inputTensor) as tf.Tensor;
      const predictedValue = (await prediction.data())[0];
      
      projectedValues.push(predictedValue);

      // Cleanup
      inputTensor.dispose();
      prediction.dispose();
    }

    const projectedValue = projectedValues[projectedValues.length - 1];
    const confidence = this.calculatePredictionConfidence(model, historicalData);

    // Generate recommendations based on projections
    const recommendations = this.generateGrowthRecommendations(
      metric,
      currentValue,
      projectedValue,
      growthRate,
      projectionDays
    );

    return {
      current: currentValue,
      projected: projectedValue,
      growthRate,
      projectionDates,
      projectedValues,
      confidence,
      recommendations
    };
  }

  /**
   * Auto-retrain models based on data drift
   */
  public async autoRetrainModels(): Promise<void> {
    if (this.isTraining) {
      console.log('Training already in progress, skipping auto-retrain');
      return;
    }

    const now = new Date();
    const shouldRetrain = !this.lastTrainingTime || 
      (now.getTime() - this.lastTrainingTime.getTime()) > (7 * 24 * 60 * 60 * 1000); // 7 days

    if (!shouldRetrain) {
      return;
    }

    console.log('Starting auto-retrain of ML models...');

    try {
      // Retrain capacity models for key metrics
      const keyMetrics = ['cpu_usage', 'memory_usage', 'app_response_time', 'app_queue_size'];
      
      for (const metric of keyMetrics) {
        try {
          await this.trainCapacityModel(metric, 30);
          console.log(`Successfully retrained capacity model for ${metric}`);
        } catch (error) {
          console.error(`Failed to retrain capacity model for ${metric}:`, error.message);
        }
      }

      // Retrain anomaly detection model
      try {
        await this.trainAnomalyModel(keyMetrics, 30);
        console.log('Successfully retrained anomaly detection model');
      } catch (error) {
        console.error('Failed to retrain anomaly detection model:', error.message);
      }

    } catch (error) {
      console.error('Error during auto-retrain:', error);
    }
  }

  // Private helper methods...

  private async loadExistingModels(): Promise<void> {
    // Implementation to load saved models from disk
    console.log('Loading existing ML models...');
  }

  private async collectTrainingData(metric: string, timeframeDays: number): Promise<TrainingData> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (timeframeDays * 24 * 60 * 60 * 1000));

    const events = await this.eventStore.getEvents({
      start_time: startTime,
      end_time: endTime,
      limit: 10000
    });

    // Extract relevant data points and features
    const features: number[][] = [];
    const labels: number[] = [];
    const timestamps: Date[] = [];

    // Process events to create training data
    for (const event of events) {
      if (event.data[metric] !== undefined) {
        const featureVector = this.extractFeatures([event]);
        if (featureVector.length > 0) {
          features.push(featureVector);
          labels.push(event.data[metric]);
          timestamps.push(new Date(event.timestamp));
        }
      }
    }

    return {
      features,
      labels,
      timestamps,
      metadata: { metric, timeframeDays, eventCount: events.length }
    };
  }

  private async collectMultiMetricTrainingData(metrics: string[], timeframeDays: number): Promise<TrainingData> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (timeframeDays * 24 * 60 * 60 * 1000));

    const features: number[][] = [];
    const labels: number[] = [];
    const timestamps: Date[] = [];

    // Get data for each metric
    for (const metric of metrics) {
      const data = await this.getRecentDataForPrediction(metric, timeframeDays * 24);
      
      for (const point of data) {
        const featureVector = metrics.map(m => 
          m === metric ? point.value : this.getMetricValueAtTime(m, point.timestamp)
        ).filter(v => v !== undefined && !isNaN(v));

        if (featureVector.length === metrics.length) {
          features.push(featureVector);
          labels.push(0); // For unsupervised learning
          timestamps.push(point.timestamp);
        }
      }
    }

    return {
      features,
      labels,
      timestamps,
      metadata: { metrics, timeframeDays }
    };
  }

  private prepareTrainingData(trainingData: TrainingData): {
    xTrain: tf.Tensor2D;
    yTrain: tf.Tensor2D;
    xValidation: tf.Tensor2D;
    yValidation: tf.Tensor2D;
  } {
    // Normalize features
    const normalizedFeatures = this.normalizeFeatures(trainingData.features);
    const normalizedLabels = this.normalizeLabels(trainingData.labels);

    // Split data
    const splitIndex = Math.floor(normalizedFeatures.length * 0.8);
    
    const xTrain = tf.tensor2d(normalizedFeatures.slice(0, splitIndex));
    const yTrain = tf.tensor2d(normalizedLabels.slice(0, splitIndex), [splitIndex, 1]);
    const xValidation = tf.tensor2d(normalizedFeatures.slice(splitIndex));
    const yValidation = tf.tensor2d(normalizedLabels.slice(splitIndex), [normalizedLabels.length - splitIndex, 1]);

    return { xTrain, yTrain, xValidation, yValidation };
  }

  private createCapacityModel(inputShape: number): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [inputShape],
          units: 64,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 1,
          activation: 'linear'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    return model;
  }

  private createAnomalyModel(inputShape: number): tf.LayersModel {
    // Autoencoder for anomaly detection
    const model = tf.sequential({
      layers: [
        // Encoder
        tf.layers.dense({
          inputShape: [inputShape],
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 8,
          activation: 'relu'
        }),
        // Decoder
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: inputShape,
          activation: 'linear'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });

    return model;
  }

  private async trainModel(
    model: tf.LayersModel,
    xTrain: tf.Tensor2D,
    yTrain: tf.Tensor2D,
    xValidation: tf.Tensor2D,
    yValidation: tf.Tensor2D
  ): Promise<tf.History> {
    return await model.fit(xTrain, yTrain, {
      epochs: 100,
      batchSize: 32,
      validationData: [xValidation, yValidation],
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(`Epoch ${epoch}: loss = ${logs?.loss?.toFixed(4)}, val_loss = ${logs?.val_loss?.toFixed(4)}`);
          }
        }
      }
    });
  }

  private async evaluateModel(
    model: tf.LayersModel,
    xValidation: tf.Tensor2D,
    yValidation: tf.Tensor2D
  ): Promise<number> {
    const evaluation = model.evaluate(xValidation, yValidation) as tf.Tensor[];
    const loss = await evaluation[0].data();
    return 1 - loss[0]; // Convert loss to accuracy-like metric
  }

  private async saveModel(predictionModel: PredictionModel): Promise<void> {
    try {
      const modelPath = `file://./models/${predictionModel.id}`;
      await predictionModel.model.save(modelPath);
      console.log(`Model saved to ${modelPath}`);
    } catch (error) {
      console.error('Failed to save model:', error);
    }
  }

  private findBestModel(type: PredictionModel['type'], target: string): PredictionModel | null {
    const candidates = Array.from(this.models.values())
      .filter(model => model.type === type && 
        (model.metadata.targetVariable === target || 
         model.metadata.features.includes(target)))
      .sort((a, b) => b.metadata.accuracy - a.metadata.accuracy);

    return candidates[0] || null;
  }

  private getFeatureNames(): string[] {
    return [
      'hour_of_day',
      'day_of_week',
      'month_of_year',
      'is_weekend',
      'recent_avg',
      'recent_trend',
      'recent_volatility',
      'seasonal_component'
    ];
  }

  private extractFeatures(data: any[]): number[] {
    if (data.length === 0) return [];

    const latest = data[data.length - 1];
    const timestamp = new Date(latest.timestamp || latest.created_at);

    // Time-based features
    const hourOfDay = timestamp.getHours() / 23; // Normalize to [0, 1]
    const dayOfWeek = timestamp.getDay() / 6;
    const monthOfYear = timestamp.getMonth() / 11;
    const isWeekend = (timestamp.getDay() === 0 || timestamp.getDay() === 6) ? 1 : 0;

    // Statistical features from recent data
    const values = data.map(d => d.value || d.data?.value || 0).filter(v => !isNaN(v));
    const recentAvg = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
    
    // Calculate trend (simple linear regression slope)
    const recentTrend = this.calculateTrend(values);
    
    // Calculate volatility (standard deviation)
    const recentVolatility = this.calculateVolatility(values);
    
    // Seasonal component (simplified)
    const seasonalComponent = Math.sin(2 * Math.PI * timestamp.getHours() / 24);

    return [
      hourOfDay,
      dayOfWeek,
      monthOfYear,
      isWeekend,
      recentAvg,
      recentTrend,
      recentVolatility,
      seasonalComponent
    ];
  }

  private normalizeFeatures(features: number[][]): number[][] {
    if (features.length === 0) return [];

    const numFeatures = features[0].length;
    const normalized: number[][] = [];

    // Calculate min/max for each feature
    const mins = new Array(numFeatures).fill(Infinity);
    const maxs = new Array(numFeatures).fill(-Infinity);

    features.forEach(sample => {
      sample.forEach((value, idx) => {
        mins[idx] = Math.min(mins[idx], value);
        maxs[idx] = Math.max(maxs[idx], value);
      });
    });

    // Normalize each sample
    features.forEach(sample => {
      const normalizedSample = sample.map((value, idx) => {
        const range = maxs[idx] - mins[idx];
        return range === 0 ? 0 : (value - mins[idx]) / range;
      });
      normalized.push(normalizedSample);
    });

    return normalized;
  }

  private normalizeLabels(labels: number[]): number[] {
    if (labels.length === 0) return [];

    const min = Math.min(...labels);
    const max = Math.max(...labels);
    const range = max - min;

    if (range === 0) return labels.map(() => 0);

    return labels.map(label => (label - min) / range);
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = values.reduce((sum, v, i) => sum + (i * v), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return isNaN(slope) ? 0 : slope;
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  // Additional helper methods would continue here...
  // (Implementation of remaining methods for space considerations)

  private async getRecentDataForPrediction(metric: string, hours: number): Promise<any[]> {
    // Implementation to fetch recent data
    return [];
  }

  private async getMetricThreshold(metric: string): Promise<number> {
    // Implementation to get metric thresholds
    return 100;
  }

  private calculatePredictionConfidence(model: PredictionModel, data: any[]): number {
    // Implementation to calculate confidence based on model accuracy and data quality
    return model.metadata.accuracy * 0.8; // Simplified
  }

  private generateCapacityRecommendations(
    metric: string,
    current: number,
    predicted: number,
    threshold: number,
    willExceed: boolean
  ): string[] {
    const recommendations: string[] = [];
    
    if (willExceed) {
      recommendations.push(`${metric} is predicted to exceed threshold of ${threshold}`);
      recommendations.push('Consider scaling infrastructure proactively');
      recommendations.push('Review resource allocation policies');
    } else {
      recommendations.push(`${metric} is within normal parameters`);
      recommendations.push('Continue monitoring for trend changes');
    }

    return recommendations;
  }

  private getTTLForTimeframe(timeframe: string): number {
    const ttlMap = {
      '1h': 1000 * 60 * 5,    // 5 minutes
      '6h': 1000 * 60 * 15,   // 15 minutes
      '24h': 1000 * 60 * 30,  // 30 minutes
      '7d': 1000 * 60 * 60,   // 1 hour
      '30d': 1000 * 60 * 120  // 2 hours
    };
    return ttlMap[timeframe] || 1000 * 60 * 10;
  }

  private estimateTimeToThreshold(data: any[], threshold: number, timeframe: string): Date | undefined {
    // Implementation to estimate when threshold will be reached
    const now = new Date();
    const hours = timeframe === '1h' ? 1 : timeframe === '6h' ? 6 : 24;
    return new Date(now.getTime() + (hours * 60 * 60 * 1000));
  }

  // Implement remaining methods...
  private splitData(tensor: tf.Tensor2D, splitRatio: number): { xTrain: tf.Tensor2D; xValidation: tf.Tensor2D } {
    const splitIndex = Math.floor(tensor.shape[0] * splitRatio);
    return {
      xTrain: tensor.slice([0, 0], [splitIndex, -1]) as tf.Tensor2D,
      xValidation: tensor.slice([splitIndex, 0], [-1, -1]) as tf.Tensor2D
    };
  }

  private async calculateAnomalyThresholds(trainingData: TrainingData): Promise<void> {
    // Implementation for calculating statistical thresholds
  }

  private async calculateReconstructionErrors(model: tf.LayersModel, data: tf.Tensor2D): Promise<number[]> {
    // Implementation for calculating reconstruction errors
    return [];
  }

  private calculateAnomalyThreshold(errors: number[]): number {
    // Use 95th percentile as threshold
    const sorted = errors.sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)];
  }

  private createTimeWindows(dataMap: Map<string, any[]>, windowMinutes: number): any[] {
    // Implementation for creating time windows
    return [];
  }

  private extractAnomalyFeatures(window: any, metrics: string[]): number[] {
    // Implementation for extracting features from time window
    return [];
  }

  private calculateReconstructionError(original: number[], reconstructed: number[]): number {
    let sumSquaredDiff = 0;
    for (let i = 0; i < original.length; i++) {
      sumSquaredDiff += Math.pow(original[i] - reconstructed[i], 2);
    }
    return Math.sqrt(sumSquaredDiff / original.length);
  }

  private getMetricAnomalyThreshold(metric: string): number {
    const thresholds = {
      'cpu_usage': 10,
      'memory_usage': 15,
      'app_response_time': 500
    };
    return thresholds[metric] || 5;
  }

  private determineSeverity(deviation: number, threshold: number): AnomalyDetection['severity'] {
    const ratio = deviation / threshold;
    if (ratio > 3) return 'critical';
    if (ratio > 2) return 'high';
    if (ratio > 1.5) return 'medium';
    return 'low';
  }

  private generateAnomalyRecommendations(metric: string, deviation: number): string[] {
    return [
      `Investigate ${metric} anomaly`,
      'Check system logs for related events',
      'Consider scaling if pattern persists'
    ];
  }

  private async analyzeCorrelations(): Promise<MLInsight[]> {
    // Implementation for correlation analysis
    return [];
  }

  private async recognizePatterns(): Promise<MLInsight[]> {
    // Implementation for pattern recognition
    return [];
  }

  private async forecastTrends(): Promise<MLInsight[]> {
    // Implementation for trend forecasting
    return [];
  }

  private async analyzeBottlenecks(): Promise<MLInsight[]> {
    // Implementation for bottleneck analysis
    return [];
  }

  private calculateGrowthRate(data: any[]): number {
    if (data.length < 2) return 0;
    
    const first = data[0].value;
    const last = data[data.length - 1].value;
    const timeDiff = (new Date(data[data.length - 1].timestamp).getTime() - 
                     new Date(data[0].timestamp).getTime()) / (1000 * 60 * 60 * 24); // days
    
    return Math.pow(last / first, 1 / timeDiff) - 1; // Daily growth rate
  }

  private extrapolateFeatures(historicalData: any[], daysAhead: number): number[] {
    // Implementation for feature extrapolation
    const latest = historicalData[historicalData.length - 1];
    const futureDate = new Date(latest.timestamp);
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    return this.extractFeatures([{ ...latest, timestamp: futureDate }]);
  }

  private generateGrowthRecommendations(
    metric: string,
    current: number,
    projected: number,
    growthRate: number,
    days: number
  ): string[] {
    const recommendations: string[] = [];
    
    const growthPercent = ((projected - current) / current) * 100;
    
    if (growthPercent > 50) {
      recommendations.push(`High growth expected for ${metric}: ${growthPercent.toFixed(1)}% over ${days} days`);
      recommendations.push('Plan for significant capacity increases');
      recommendations.push('Consider auto-scaling solutions');
    } else if (growthPercent > 20) {
      recommendations.push(`Moderate growth expected for ${metric}: ${growthPercent.toFixed(1)}% over ${days} days`);
      recommendations.push('Monitor capacity utilization closely');
    } else {
      recommendations.push(`Stable growth expected for ${metric}`);
      recommendations.push('Current capacity should be sufficient');
    }
    
    return recommendations;
  }

  private getMetricValueAtTime(metric: string, timestamp: Date): number | undefined {
    // Implementation to get metric value at specific time
    return undefined;
  }
}