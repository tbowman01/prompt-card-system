'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { DashboardMetrics } from '@/types';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    fill?: boolean;
  }>;
}

interface PerformanceChartsProps {
  height?: number;
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({ height = 400 }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'hour' | 'day' | 'week' | 'month'>('day');
  const [selectedChart, setSelectedChart] = useState<'tests' | 'success' | 'performance'>('tests');
  
  const chartRefs = {
    tests: useRef<HTMLCanvasElement>(null),
    success: useRef<HTMLCanvasElement>(null),
    performance: useRef<HTMLCanvasElement>(null),
  };

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getTrends(period, 30);
        setMetrics({ ...metrics, trends: data } as DashboardMetrics);
      } catch (err) {
        console.error('Error fetching trends:', err);
        setError('Failed to load chart data');
      } finally {
        setLoading(false);
      }
    };

    fetchTrends();
  }, [period]);

  const drawLineChart = (canvas: HTMLCanvasElement, data: ChartData, title: string) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = height;

    const padding = 60;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;

    // Find data range
    const allData = data.datasets.flatMap(dataset => dataset.data);
    const minValue = Math.min(...allData);
    const maxValue = Math.max(...allData);
    const range = maxValue - minValue || 1;

    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + chartWidth, y);
      ctx.stroke();
    }

    // Vertical grid lines
    const stepX = chartWidth / (data.labels.length - 1 || 1);
    for (let i = 0; i < data.labels.length; i++) {
      const x = padding + stepX * i;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, padding + chartHeight);
      ctx.stroke();
    }

    // Draw data lines
    data.datasets.forEach((dataset, datasetIndex) => {
      ctx.strokeStyle = dataset.borderColor;
      ctx.lineWidth = 2;
      ctx.beginPath();

      dataset.data.forEach((value, index) => {
        const x = padding + stepX * index;
        const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Draw data points
      ctx.fillStyle = dataset.borderColor;
      dataset.data.forEach((value, index) => {
        const x = padding + stepX * index;
        const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });
    });

    // Draw title
    ctx.fillStyle = '#1f2937';
    ctx.font = '16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, 30);

    // Draw y-axis labels
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight / 5) * i;
      const value = maxValue - (range / 5) * i;
      ctx.fillText(value.toFixed(1), padding - 10, y + 4);
    }

    // Draw x-axis labels
    ctx.textAlign = 'center';
    data.labels.forEach((label, index) => {
      const x = padding + stepX * index;
      ctx.fillText(label, x, canvas.height - 20);
    });
  };

  const renderChart = (chartType: 'tests' | 'success' | 'performance') => {
    if (!metrics?.trends || !chartRefs[chartType].current) return;

    const canvas = chartRefs[chartType].current;
    let chartData: ChartData;
    let title: string;

    switch (chartType) {
      case 'tests':
        chartData = {
          labels: metrics.trends.testsOverTime.map(t => 
            new Date(t.timestamp).toLocaleDateString()
          ),
          datasets: [{
            label: 'Tests Count',
            data: metrics.trends.testsOverTime.map(t => t.count),
            borderColor: '#3b82f6',
            backgroundColor: '#3b82f6',
          }]
        };
        title = 'Tests Over Time';
        break;
      case 'success':
        chartData = {
          labels: metrics.trends.successRateOverTime.map(t => 
            new Date(t.timestamp).toLocaleDateString()
          ),
          datasets: [{
            label: 'Success Rate',
            data: metrics.trends.successRateOverTime.map(t => t.rate * 100),
            borderColor: '#10b981',
            backgroundColor: '#10b981',
          }]
        };
        title = 'Success Rate Over Time (%)';
        break;
      case 'performance':
        chartData = {
          labels: metrics.trends.performanceOverTime.map(t => 
            new Date(t.timestamp).toLocaleDateString()
          ),
          datasets: [{
            label: 'Avg Response Time',
            data: metrics.trends.performanceOverTime.map(t => t.avgTime),
            borderColor: '#f59e0b',
            backgroundColor: '#f59e0b',
          }]
        };
        title = 'Average Response Time (ms)';
        break;
    }

    drawLineChart(canvas, chartData, title);
  };

  useEffect(() => {
    if (metrics?.trends) {
      // Render all charts
      renderChart('tests');
      renderChart('success');
      renderChart('performance');
    }
  }, [metrics?.trends]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (metrics?.trends) {
        setTimeout(() => {
          renderChart('tests');
          renderChart('success');
          renderChart('performance');
        }, 100);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [metrics?.trends]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={period === 'hour' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('hour')}
          >
            Hourly
          </Button>
          <Button
            variant={period === 'day' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('day')}
          >
            Daily
          </Button>
          <Button
            variant={period === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('week')}
          >
            Weekly
          </Button>
          <Button
            variant={period === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('month')}
          >
            Monthly
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant={selectedChart === 'tests' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedChart('tests')}
          >
            Tests
          </Button>
          <Button
            variant={selectedChart === 'success' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedChart('success')}
          >
            Success Rate
          </Button>
          <Button
            variant={selectedChart === 'performance' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedChart('performance')}
          >
            Performance
          </Button>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6">
        {/* Selected Chart - Large */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <canvas
            ref={chartRefs[selectedChart]}
            className="w-full"
            style={{ height: `${height}px` }}
          />
        </div>

        {/* Other Charts - Small */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.entries(chartRefs).map(([chartType, ref]) => {
            if (chartType === selectedChart) return null;
            
            return (
              <div key={chartType} className="bg-white rounded-lg border border-gray-200 p-4">
                <canvas
                  ref={ref}
                  className="w-full cursor-pointer"
                  style={{ height: `${height / 2}px` }}
                  onClick={() => setSelectedChart(chartType as 'tests' | 'success' | 'performance')}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <span>Tests Volume</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span>Success Rate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
            <span>Response Time</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceCharts;