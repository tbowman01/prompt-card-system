-- Load Testing and Performance Regression Tables

-- Load test results table
CREATE TABLE IF NOT EXISTS load_test_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL,
  scenario_name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  duration REAL NOT NULL,
  total_requests INTEGER NOT NULL,
  successful_requests INTEGER NOT NULL,
  failed_requests INTEGER NOT NULL,
  requests_per_second REAL NOT NULL,
  avg_response_time REAL NOT NULL,
  p95_response_time REAL NOT NULL,
  p99_response_time REAL NOT NULL,
  error_rate REAL NOT NULL,
  results_json TEXT NOT NULL, -- Full results as JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Load test baselines table
CREATE TABLE IF NOT EXISTS load_test_baselines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL UNIQUE,
  baseline_data TEXT NOT NULL, -- Baseline metrics as JSON
  version TEXT,
  environment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Regression baselines table
CREATE TABLE IF NOT EXISTS regression_baselines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  baseline_data TEXT NOT NULL, -- RegressionBaseline as JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(scenario_id, timestamp)
);

-- Regression alerts table
CREATE TABLE IF NOT EXISTS regression_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  degradation REAL NOT NULL,
  timestamp TEXT NOT NULL,
  alert_data TEXT NOT NULL, -- Full alert as JSON
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Performance metrics history table
CREATE TABLE IF NOT EXISTS performance_metrics_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  timestamp TEXT NOT NULL,
  metadata TEXT, -- Additional context as JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Load test scenarios table (for persistent storage)
CREATE TABLE IF NOT EXISTS load_test_scenarios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  config_json TEXT NOT NULL, -- LoadTestScenario config as JSON
  active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Performance thresholds table
CREATE TABLE IF NOT EXISTS performance_thresholds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL UNIQUE,
  warning_threshold REAL NOT NULL,
  critical_threshold REAL NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('absolute', 'statistical', 'adaptive')),
  confidence REAL NOT NULL DEFAULT 0.95,
  min_sample_size INTEGER NOT NULL DEFAULT 30,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Benchmark results table
CREATE TABLE IF NOT EXISTS benchmark_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  suite_name TEXT NOT NULL,
  benchmark_name TEXT NOT NULL,
  duration REAL NOT NULL,
  throughput REAL NOT NULL,
  error_rate REAL NOT NULL,
  memory_usage_json TEXT NOT NULL, -- Memory usage stats as JSON
  cpu_usage_json TEXT NOT NULL, -- CPU usage stats as JSON
  iterations INTEGER NOT NULL,
  metadata_json TEXT, -- Additional benchmark metadata as JSON
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Benchmark suites table
CREATE TABLE IF NOT EXISTS benchmark_suites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  total_duration REAL NOT NULL,
  average_throughput REAL NOT NULL,
  average_error_rate REAL NOT NULL,
  peak_memory_usage REAL NOT NULL,
  recommendations_json TEXT NOT NULL, -- Recommendations as JSON array
  summary_json TEXT NOT NULL, -- Full summary as JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Performance trends table
CREATE TABLE IF NOT EXISTS performance_trends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  trend_direction TEXT NOT NULL CHECK (trend_direction IN ('improving', 'stable', 'degrading')),
  slope REAL NOT NULL,
  correlation REAL NOT NULL,
  seasonality_detected BOOLEAN DEFAULT FALSE,
  seasonality_period INTEGER,
  forecast_json TEXT, -- Forecast data as JSON
  calculated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Change points detection table
CREATE TABLE IF NOT EXISTS change_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  confidence REAL NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('level', 'trend', 'variance')),
  magnitude REAL NOT NULL,
  detected_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Neural model training data table
CREATE TABLE IF NOT EXISTS neural_training_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  features_json TEXT NOT NULL, -- Feature vector as JSON
  label REAL NOT NULL, -- Target label (0 for normal, 1 for anomaly)
  scenario_id TEXT,
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Performance anomalies table
CREATE TABLE IF NOT EXISTS performance_anomalies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL,
  anomaly_score REAL NOT NULL,
  metrics_json TEXT NOT NULL, -- Metrics that triggered anomaly as JSON
  detection_method TEXT NOT NULL, -- 'neural', 'statistical', 'threshold'
  confidence REAL NOT NULL,
  timestamp TEXT NOT NULL,
  investigated BOOLEAN DEFAULT FALSE,
  investigation_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Load test execution logs table
CREATE TABLE IF NOT EXISTS load_test_execution_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL,
  execution_id TEXT NOT NULL, -- Unique execution identifier
  log_level TEXT NOT NULL CHECK (log_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
  message TEXT NOT NULL,
  details_json TEXT, -- Additional log details as JSON
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Performance alerts acknowledgments table
CREATE TABLE IF NOT EXISTS alert_acknowledgments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id INTEGER NOT NULL,
  alert_type TEXT NOT NULL, -- 'regression', 'threshold', 'anomaly'
  acknowledged_by TEXT NOT NULL,
  acknowledgment_note TEXT,
  status TEXT NOT NULL DEFAULT 'acknowledged' CHECK (status IN ('acknowledged', 'investigating', 'resolved', 'false_positive')),
  acknowledged_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (alert_id) REFERENCES regression_alerts (id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_load_test_results_scenario_id ON load_test_results(scenario_id);
CREATE INDEX IF NOT EXISTS idx_load_test_results_created_at ON load_test_results(created_at);
CREATE INDEX IF NOT EXISTS idx_regression_alerts_scenario_id ON regression_alerts(scenario_id);
CREATE INDEX IF NOT EXISTS idx_regression_alerts_timestamp ON regression_alerts(timestamp);
CREATE INDEX IF NOT EXISTS idx_regression_alerts_severity ON regression_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_history_scenario_id ON performance_metrics_history(scenario_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_history_timestamp ON performance_metrics_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_benchmark_results_suite_name ON benchmark_results(suite_name);
CREATE INDEX IF NOT EXISTS idx_benchmark_results_timestamp ON benchmark_results(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_trends_scenario_id ON performance_trends(scenario_id);
CREATE INDEX IF NOT EXISTS idx_change_points_scenario_id ON change_points(scenario_id);
CREATE INDEX IF NOT EXISTS idx_change_points_timestamp ON change_points(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_anomalies_scenario_id ON performance_anomalies(scenario_id);
CREATE INDEX IF NOT EXISTS idx_performance_anomalies_timestamp ON performance_anomalies(timestamp);
CREATE INDEX IF NOT EXISTS idx_load_test_execution_logs_scenario_id ON load_test_execution_logs(scenario_id);
CREATE INDEX IF NOT EXISTS idx_load_test_execution_logs_execution_id ON load_test_execution_logs(execution_id);

-- Insert default performance thresholds
INSERT OR IGNORE INTO performance_thresholds (metric_name, warning_threshold, critical_threshold, method, confidence, min_sample_size) VALUES
('responseTime.p95', 20.0, 50.0, 'statistical', 0.95, 30),
('responseTime.mean', 15.0, 40.0, 'statistical', 0.95, 30),
('throughput.mean', 15.0, 30.0, 'statistical', 0.95, 30),
('errorRate', 100.0, 300.0, 'absolute', 0.95, 10),
('availability', 5.0, 10.0, 'absolute', 0.95, 10),
('cpu.usage', 20.0, 50.0, 'statistical', 0.90, 20),
('memory.usage', 20.0, 40.0, 'statistical', 0.90, 20);

-- Insert default load test scenarios
INSERT OR IGNORE INTO load_test_scenarios (id, name, description, config_json) VALUES
('api-smoke-test', 'API Smoke Test', 'Quick smoke test for API endpoints', '{
  "baseUrl": "http://localhost:3001",
  "endpoints": [
    {"path": "/api/health", "method": "GET", "weight": 50, "validation": {"statusCode": [200]}},
    {"path": "/api/performance/health", "method": "GET", "weight": 30, "validation": {"statusCode": [200]}},
    {"path": "/api/analytics/metrics", "method": "GET", "weight": 20, "validation": {"statusCode": [200]}}
  ],
  "users": {
    "concurrent": 5,
    "rampUp": {"duration": 10, "strategy": "linear"},
    "rampDown": {"duration": 5, "strategy": "linear"},
    "thinkTime": {"min": 1000, "max": 2000, "distribution": "uniform"}
  },
  "duration": {"total": 60, "warmup": 10, "cooldown": 10},
  "thresholds": {
    "responseTime": {"p95": 500, "p99": 1000, "max": 2000},
    "errorRate": {"max": 1},
    "throughput": {"min": 2}
  },
  "environment": {"concurrent": true, "keepAlive": true}
}'),
('performance-baseline', 'Performance Baseline Test', 'Baseline performance test for comparison', '{
  "baseUrl": "http://localhost:3001",
  "endpoints": [
    {"path": "/api/performance/overview", "method": "GET", "weight": 30, "validation": {"statusCode": [200]}},
    {"path": "/api/analytics/realtime", "method": "GET", "weight": 25, "validation": {"statusCode": [200]}},
    {"path": "/api/prompt-cards", "method": "GET", "weight": 20, "validation": {"statusCode": [200]}},
    {"path": "/api/test-cases", "method": "GET", "weight": 15, "validation": {"statusCode": [200]}},
    {"path": "/api/health/v2", "method": "GET", "weight": 10, "validation": {"statusCode": [200]}}
  ],
  "users": {
    "concurrent": 20,
    "rampUp": {"duration": 60, "strategy": "linear"},
    "rampDown": {"duration": 30, "strategy": "linear"},
    "thinkTime": {"min": 2000, "max": 5000, "distribution": "normal"}
  },
  "duration": {"total": 300, "warmup": 60, "cooldown": 30},
  "thresholds": {
    "responseTime": {"p95": 1000, "p99": 2000, "max": 5000},
    "errorRate": {"max": 5},
    "throughput": {"min": 10}
  },
  "environment": {"concurrent": true, "keepAlive": true, "compression": true}
}');