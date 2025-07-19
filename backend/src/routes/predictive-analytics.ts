import express from 'express';
import { PredictiveAnalytics } from '../services/analytics/PredictiveAnalytics';
import { AnomalyDetector, anomalyDetector } from '../services/analytics/AnomalyDetector';
import { CapacityPlanner, capacityPlanner } from '../services/analytics/CapacityPlanner';

const router = express.Router();
const predictiveAnalytics = new PredictiveAnalytics();

// Predictive Analytics Routes

/**
 * Train capacity prediction model
 */
router.post('/models/capacity/train', async (req, res) => {
  try {
    const { metric, timeframeDays = 30 } = req.body;
    
    if (!metric) {
      return res.status(400).json({
        success: false,
        error: 'Metric parameter is required'
      });
    }

    const model = await predictiveAnalytics.trainCapacityModel(metric, timeframeDays);
    
    res.json({
      success: true,
      data: {
        modelId: model.id,
        accuracy: model.metadata.accuracy,
        features: model.metadata.features,
        trainedAt: model.metadata.trainedAt
      }
    });
  } catch (error) {
    console.error('Error training capacity model:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to train capacity model'
    });
  }
});

/**
 * Train anomaly detection model
 */
router.post('/models/anomaly/train', async (req, res) => {
  try {
    const { metrics = ['cpu_usage', 'memory_usage', 'app_response_time'], timeframeDays = 30 } = req.body;
    
    const model = await predictiveAnalytics.trainAnomalyModel(metrics, timeframeDays);
    
    res.json({
      success: true,
      data: {
        modelId: model.id,
        accuracy: model.metadata.accuracy,
        features: model.metadata.features,
        trainedAt: model.metadata.trainedAt
      }
    });
  } catch (error) {
    console.error('Error training anomaly model:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to train anomaly model'
    });
  }
});

/**
 * Get capacity predictions
 */
router.get('/predictions/capacity', async (req, res) => {
  try {
    const { metric, timeframe = '24h' } = req.query;
    
    if (!metric) {
      return res.status(400).json({
        success: false,
        error: 'Metric parameter is required'
      });
    }

    const prediction = await predictiveAnalytics.predictCapacity(
      metric as string,
      timeframe as any
    );
    
    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    console.error('Error getting capacity prediction:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get capacity prediction'
    });
  }
});

/**
 * Detect anomalies
 */
router.get('/anomalies/detect', async (req, res) => {
  try {
    const { metrics } = req.query;
    const metricsArray = metrics ? (metrics as string).split(',') : undefined;
    
    const anomalies = await predictiveAnalytics.detectAnomalies(metricsArray);
    
    res.json({
      success: true,
      data: anomalies
    });
  } catch (error) {
    console.error('Error detecting anomalies:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to detect anomalies'
    });
  }
});

/**
 * Get ML insights
 */
router.get('/insights', async (req, res) => {
  try {
    const insights = await predictiveAnalytics.generateMLInsights();
    
    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    console.error('Error generating ML insights:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate ML insights'
    });
  }
});

/**
 * Get growth projections
 */
router.get('/projections/growth', async (req, res) => {
  try {
    const { metric, projectionDays = 30 } = req.query;
    
    if (!metric) {
      return res.status(400).json({
        success: false,
        error: 'Metric parameter is required'
      });
    }

    const projections = await predictiveAnalytics.getGrowthProjections(
      metric as string,
      parseInt(projectionDays as string, 10)
    );
    
    res.json({
      success: true,
      data: projections
    });
  } catch (error) {
    console.error('Error getting growth projections:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get growth projections'
    });
  }
});

/**
 * Auto-retrain models
 */
router.post('/models/retrain', async (req, res) => {
  try {
    await predictiveAnalytics.autoRetrainModels();
    
    res.json({
      success: true,
      message: 'Models retrained successfully'
    });
  } catch (error) {
    console.error('Error retraining models:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrain models'
    });
  }
});

// Anomaly Detection Routes

/**
 * Start anomaly detection
 */
router.post('/anomaly-detection/start', async (req, res) => {
  try {
    const { intervalMs = 30000 } = req.body;
    
    anomalyDetector.startDetection(intervalMs);
    
    res.json({
      success: true,
      message: 'Anomaly detection started',
      interval: intervalMs
    });
  } catch (error) {
    console.error('Error starting anomaly detection:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start anomaly detection'
    });
  }
});

/**
 * Stop anomaly detection
 */
router.post('/anomaly-detection/stop', async (req, res) => {
  try {
    anomalyDetector.stopDetection();
    
    res.json({
      success: true,
      message: 'Anomaly detection stopped'
    });
  } catch (error) {
    console.error('Error stopping anomaly detection:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to stop anomaly detection'
    });
  }
});

/**
 * Train autoencoder model for anomaly detection
 */
router.post('/anomaly-detection/train', async (req, res) => {
  try {
    const { metrics = ['cpu_usage', 'memory_usage', 'app_response_time'], trainingDays = 7 } = req.body;
    
    const model = await anomalyDetector.trainAutoencoderModel(metrics, trainingDays);
    
    res.json({
      success: true,
      data: {
        modelId: model.id,
        algorithm: model.algorithm,
        accuracy: model.accuracy,
        features: model.features
      }
    });
  } catch (error) {
    console.error('Error training anomaly detection model:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to train anomaly detection model'
    });
  }
});

/**
 * Update statistical thresholds
 */
router.post('/anomaly-detection/thresholds', async (req, res) => {
  try {
    const { metric, windowDays = 7 } = req.body;
    
    if (!metric) {
      return res.status(400).json({
        success: false,
        error: 'Metric parameter is required'
      });
    }

    const thresholds = await anomalyDetector.updateStatisticalThresholds(metric, windowDays);
    
    res.json({
      success: true,
      data: thresholds
    });
  } catch (error) {
    console.error('Error updating statistical thresholds:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update statistical thresholds'
    });
  }
});

/**
 * Get active alerts
 */
router.get('/anomaly-detection/alerts', async (req, res) => {
  try {
    const alerts = anomalyDetector.getActiveAlerts();
    
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Error getting active alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active alerts'
    });
  }
});

/**
 * Acknowledge alert
 */
router.post('/anomaly-detection/alerts/:alertId/acknowledge', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { userId } = req.body;
    
    const acknowledged = anomalyDetector.acknowledgeAlert(alertId, userId);
    
    if (acknowledged) {
      res.json({
        success: true,
        message: 'Alert acknowledged'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert'
    });
  }
});

/**
 * Resolve alert
 */
router.post('/anomaly-detection/alerts/:alertId/resolve', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { userId } = req.body;
    
    const resolved = anomalyDetector.resolveAlert(alertId, userId);
    
    if (resolved) {
      res.json({
        success: true,
        message: 'Alert resolved'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert'
    });
  }
});

/**
 * Get detection statistics
 */
router.get('/anomaly-detection/stats', async (req, res) => {
  try {
    const stats = anomalyDetector.getDetectionStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting detection stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get detection stats'
    });
  }
});

/**
 * Update detection configuration
 */
router.put('/anomaly-detection/config', async (req, res) => {
  try {
    const config = req.body;
    
    anomalyDetector.updateConfig(config);
    
    res.json({
      success: true,
      message: 'Detection configuration updated'
    });
  } catch (error) {
    console.error('Error updating detection config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update detection configuration'
    });
  }
});

/**
 * Export detection data
 */
router.get('/anomaly-detection/export', async (req, res) => {
  try {
    const data = anomalyDetector.exportData();
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error exporting detection data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export detection data'
    });
  }
});

// Capacity Planning Routes

/**
 * Start capacity monitoring
 */
router.post('/capacity/monitoring/start', async (req, res) => {
  try {
    const { intervalMs = 300000 } = req.body; // 5 minutes default
    
    capacityPlanner.startMonitoring(intervalMs);
    
    res.json({
      success: true,
      message: 'Capacity monitoring started',
      interval: intervalMs
    });
  } catch (error) {
    console.error('Error starting capacity monitoring:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start capacity monitoring'
    });
  }
});

/**
 * Stop capacity monitoring
 */
router.post('/capacity/monitoring/stop', async (req, res) => {
  try {
    capacityPlanner.stopMonitoring();
    
    res.json({
      success: true,
      message: 'Capacity monitoring stopped'
    });
  } catch (error) {
    console.error('Error stopping capacity monitoring:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop capacity monitoring'
    });
  }
});

/**
 * Generate capacity forecast
 */
router.get('/capacity/forecast', async (req, res) => {
  try {
    const { resources, timeframes } = req.query;
    
    const resourcesArray = resources ? (resources as string).split(',') : undefined;
    const timeframesArray = timeframes ? (timeframes as string).split(',') : undefined;
    
    const forecasts = await capacityPlanner.generateCapacityForecast(
      resourcesArray,
      timeframesArray
    );
    
    res.json({
      success: true,
      data: Object.fromEntries(forecasts)
    });
  } catch (error) {
    console.error('Error generating capacity forecast:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate capacity forecast'
    });
  }
});

/**
 * Generate scaling recommendations
 */
router.get('/capacity/recommendations/scaling', async (req, res) => {
  try {
    const recommendations = await capacityPlanner.generateScalingRecommendations();
    
    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Error generating scaling recommendations:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate scaling recommendations'
    });
  }
});

/**
 * Create growth projections
 */
router.get('/capacity/projections/:resource', async (req, res) => {
  try {
    const { resource } = req.params;
    const { projectionDays = 30 } = req.query;
    
    const projections = await capacityPlanner.createGrowthProjections(
      resource,
      parseInt(projectionDays as string, 10)
    );
    
    res.json({
      success: true,
      data: projections
    });
  } catch (error) {
    console.error('Error creating growth projections:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create growth projections'
    });
  }
});

/**
 * Generate optimization recommendations
 */
router.get('/capacity/recommendations/optimization', async (req, res) => {
  try {
    const recommendations = await capacityPlanner.generateOptimizationRecommendations();
    
    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Error generating optimization recommendations:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate optimization recommendations'
    });
  }
});

/**
 * Get capacity alerts
 */
router.get('/capacity/alerts', async (req, res) => {
  try {
    const alerts = capacityPlanner.getCapacityAlerts();
    
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Error getting capacity alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get capacity alerts'
    });
  }
});

/**
 * Get capacity dashboard
 */
router.get('/capacity/dashboard', async (req, res) => {
  try {
    const dashboard = await capacityPlanner.getCapacityDashboard();
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Error getting capacity dashboard:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get capacity dashboard'
    });
  }
});

// Health check for predictive analytics services
router.get('/health', async (req, res) => {
  try {
    const health = {
      predictiveAnalytics: 'healthy',
      anomalyDetection: {
        status: 'healthy',
        isRunning: anomalyDetector['isRunning'] || false,
        models: anomalyDetector['models']?.size || 0
      },
      capacityPlanning: {
        status: 'healthy',
        isMonitoring: capacityPlanner['isMonitoring'] || false,
        models: capacityPlanner['capacityModels']?.size || 0
      },
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Error getting health status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get health status'
    });
  }
});

export { router as predictiveAnalyticsRoutes };