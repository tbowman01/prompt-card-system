'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  Thermometer, 
  Clock, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Filter,
  Calendar,
  Zap,
  Target
} from 'lucide-react';

interface PerformanceDataPoint {
  timestamp: number;
  endpoint: string;
  method: string;
  responseTime: number;
  requests: number;
  errors: number;
  status: number;
}

interface HeatmapCell {
  hour: number;
  day: number;
  value: number;
  label: string;
  details: {
    avgResponseTime: number;
    totalRequests: number;
    errorRate: number;
    p95ResponseTime: number;
  };
}

interface PerformanceHeatmapProps {
  data: any;
  config?: any;
  isFullscreen?: boolean;
}

const PerformanceHeatmap: React.FC<PerformanceHeatmapProps> = ({
  data,
  config = {},
  isFullscreen = false
}) => {
  const [performanceData, setPerformanceData] = useState<PerformanceDataPoint[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<'responseTime' | 'requests' | 'errors' | 'errorRate'>('responseTime');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('all');
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);
  
  const heatmapRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data?.performance) {
      setPerformanceData(data.performance);
    }
  }, [data]);

  useEffect(() => {
    generateHeatmapData();
  }, [performanceData, selectedMetric, timeRange, selectedEndpoint]);

  const generateHeatmapData = () => {
    if (!performanceData.length) return;

    const filteredData = performanceData.filter(point => {
      if (selectedEndpoint !== 'all' && point.endpoint !== selectedEndpoint) {
        return false;
      }
      
      const now = Date.now();
      const timeRangeMs = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      }[timeRange];
      
      return point.timestamp >= now - timeRangeMs;
    });

    // Group data by hour and day
    const groupedData = new Map<string, PerformanceDataPoint[]>();
    
    filteredData.forEach(point => {
      const date = new Date(point.timestamp);
      const day = date.getDay(); // 0 = Sunday, 6 = Saturday
      const hour = date.getHours();
      const key = `${day}-${hour}`;
      
      if (!groupedData.has(key)) {
        groupedData.set(key, []);
      }
      groupedData.get(key)!.push(point);
    });

    // Generate heatmap cells
    const cells: HeatmapCell[] = [];
    
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`;
        const points = groupedData.get(key) || [];
        
        let value = 0;
        let avgResponseTime = 0;
        let totalRequests = 0;
        let totalErrors = 0;
        let p95ResponseTime = 0;
        
        if (points.length > 0) {
          const responseTimes = points.map(p => p.responseTime).sort((a, b) => a - b);
          avgResponseTime = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
          totalRequests = points.reduce((sum, p) => sum + p.requests, 0);
          totalErrors = points.reduce((sum, p) => sum + p.errors, 0);
          p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
          
          switch (selectedMetric) {
            case 'responseTime':
              value = avgResponseTime;
              break;
            case 'requests':
              value = totalRequests;
              break;
            case 'errors':
              value = totalErrors;
              break;
            case 'errorRate':
              value = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
              break;
          }
        }

        cells.push({
          hour,
          day,
          value,
          label: getDayName(day) + ' ' + hour + ':00',
          details: {
            avgResponseTime,
            totalRequests,
            errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
            p95ResponseTime
          }
        });
      }
    }

    setHeatmapData(cells);
  };

  const getDayName = (day: number): string => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[day];
  };

  const getMetricLabel = (metric: string): string => {
    switch (metric) {
      case 'responseTime':
        return 'Avg Response Time (ms)';
      case 'requests':
        return 'Total Requests';
      case 'errors':
        return 'Total Errors';
      case 'errorRate':
        return 'Error Rate (%)';
      default:
        return metric;
    }
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'responseTime':
        return <Clock className="h-4 w-4" />;
      case 'requests':
        return <Activity className="h-4 w-4" />;
      case 'errors':
        return <TrendingDown className="h-4 w-4" />;
      case 'errorRate':
        return <Target className="h-4 w-4" />;
      default:
        return <Thermometer className="h-4 w-4" />;
    }
  };

  const renderHeatmap = () => {
    if (!heatmapRef.current || !heatmapData.length) return;

    const svg = d3.select(heatmapRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 40, right: 20, bottom: 40, left: 80 };
    const width = (heatmapRef.current.clientWidth || 800) - margin.left - margin.right;
    const height = 200 - margin.top - margin.bottom;

    const cellWidth = width / 24;
    const cellHeight = height / 7;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Color scale
    const values = heatmapData.map(d => d.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);

    const colorScale = selectedMetric === 'errors' || selectedMetric === 'errorRate'
      ? d3.scaleSequential(d3.interpolateReds).domain([minValue, maxValue])
      : d3.scaleSequential(d3.interpolateBlues).domain([minValue, maxValue]);

    // Draw cells
    const cells = g.selectAll('.cell')
      .data(heatmapData)
      .enter().append('g')
      .attr('class', 'cell');

    cells.append('rect')
      .attr('x', d => d.hour * cellWidth)
      .attr('y', d => d.day * cellHeight)
      .attr('width', cellWidth - 1)
      .attr('height', cellHeight - 1)
      .attr('fill', d => d.value === 0 ? '#f3f4f6' : colorScale(d.value))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        setSelectedCell(d);
        if (tooltipRef.current) {
          const tooltip = d3.select(tooltipRef.current);
          tooltip.style('opacity', 1)
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`);
        }
      })
      .on('mouseout', () => {
        setSelectedCell(null);
        if (tooltipRef.current) {
          d3.select(tooltipRef.current).style('opacity', 0);
        }
      });

    // Add value labels for larger cells
    if (cellWidth > 30 && cellHeight > 20) {
      cells.append('text')
        .attr('x', d => d.hour * cellWidth + cellWidth / 2)
        .attr('y', d => d.day * cellHeight + cellHeight / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', d => d.value > maxValue * 0.5 ? 'white' : 'black')
        .text(d => {
          if (d.value === 0) return '';
          if (selectedMetric === 'errorRate') return d.value.toFixed(1) + '%';
          if (selectedMetric === 'responseTime') return d.value.toFixed(0);
          return d.value.toFixed(0);
        });
    }

    // Y-axis (days)
    const yAxis = g.append('g')
      .attr('class', 'y-axis');

    yAxis.selectAll('.day-label')
      .data([0, 1, 2, 3, 4, 5, 6])
      .enter().append('text')
      .attr('class', 'day-label')
      .attr('x', -10)
      .attr('y', d => d * cellHeight + cellHeight / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('font-size', '12px')
      .attr('fill', '#374151')
      .text(d => getDayName(d));

    // X-axis (hours)
    const xAxis = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${height + 10})`);

    xAxis.selectAll('.hour-label')
      .data([0, 6, 12, 18])
      .enter().append('text')
      .attr('class', 'hour-label')
      .attr('x', d => d * cellWidth + cellWidth / 2)
      .attr('y', 0)
      .attr('dy', '0.71em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#374151')
      .text(d => `${d}:00`);

    // Title
    g.append('text')
      .attr('x', width / 2)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', '#111827')
      .text(getMetricLabel(selectedMetric));
  };

  useEffect(() => {
    if (heatmapData.length > 0) {
      renderHeatmap();
    }
  }, [heatmapData, selectedMetric]);

  const endpoints = [...new Set(performanceData.map(point => point.endpoint))];
  
  const getOverallStats = () => {
    const filtered = performanceData.filter(point => {
      if (selectedEndpoint !== 'all' && point.endpoint !== selectedEndpoint) {
        return false;
      }
      const now = Date.now();
      const timeRangeMs = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      }[timeRange];
      return point.timestamp >= now - timeRangeMs;
    });

    if (filtered.length === 0) {
      return { avgResponseTime: 0, totalRequests: 0, errorRate: 0, p95ResponseTime: 0 };
    }

    const responseTimes = filtered.map(p => p.responseTime).sort((a, b) => a - b);
    const avgResponseTime = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
    const totalRequests = filtered.reduce((sum, p) => sum + p.requests, 0);
    const totalErrors = filtered.reduce((sum, p) => sum + p.errors, 0);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    const p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;

    return { avgResponseTime, totalRequests, errorRate, p95ResponseTime };
  };

  const stats = getOverallStats();

  return (
    <div className="h-full flex flex-col">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
        <div className="flex items-center space-x-2">
          <Thermometer className="h-5 w-5 text-gray-600" />
          <span className="font-semibold">Performance Heatmap</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as any)}
            className="px-3 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="responseTime">Response Time</option>
            <option value="requests">Requests</option>
            <option value="errors">Errors</option>
            <option value="errorRate">Error Rate</option>
          </select>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>

          <select
            value={selectedEndpoint}
            onChange={(e) => setSelectedEndpoint(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="all">All Endpoints</option>
            {endpoints.map(endpoint => (
              <option key={endpoint} value={endpoint}>{endpoint}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-lg font-bold text-blue-900">
              {stats.avgResponseTime.toFixed(0)}ms
            </span>
          </div>
          <p className="text-xs text-blue-700 mt-1">Avg Response Time</p>
        </div>

        <div className="bg-green-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <Activity className="h-4 w-4 text-green-600" />
            <span className="text-lg font-bold text-green-900">
              {stats.totalRequests.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-green-700 mt-1">Total Requests</p>
        </div>

        <div className="bg-red-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <Target className="h-4 w-4 text-red-600" />
            <span className="text-lg font-bold text-red-900">
              {stats.errorRate.toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-red-700 mt-1">Error Rate</p>
        </div>

        <div className="bg-purple-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            <span className="text-lg font-bold text-purple-900">
              {stats.p95ResponseTime.toFixed(0)}ms
            </span>
          </div>
          <p className="text-xs text-purple-700 mt-1">P95 Response Time</p>
        </div>
      </div>

      {/* Heatmap */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4">
        {heatmapData.length > 0 ? (
          <>
            <svg
              ref={heatmapRef}
              width="100%"
              height={isFullscreen ? "400" : "300"}
              className="overflow-visible"
            />
            
            {/* Legend */}
            <div className="mt-4 flex items-center justify-center space-x-4 text-sm text-gray-600">
              <span>Low</span>
              <div className="flex space-x-1">
                {Array.from({ length: 10 }, (_, i) => {
                  const values = heatmapData.map(d => d.value);
                  const maxValue = Math.max(...values);
                  const minValue = Math.min(...values);
                  const colorScale = selectedMetric === 'errors' || selectedMetric === 'errorRate'
                    ? d3.scaleSequential(d3.interpolateReds).domain([minValue, maxValue])
                    : d3.scaleSequential(d3.interpolateBlues).domain([minValue, maxValue]);
                  
                  const value = minValue + (maxValue - minValue) * (i / 9);
                  return (
                    <div
                      key={i}
                      className="w-4 h-4 border border-gray-300"
                      style={{ backgroundColor: colorScale(value) }}
                    />
                  );
                })}
              </div>
              <span>High</span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Thermometer className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No performance data available</p>
              <p className="text-sm">Data will appear as requests are processed</p>
            </div>
          </div>
        )}
      </div>

      {/* Insights */}
      {isFullscreen && heatmapData.length > 0 && (
        <div className="mt-4 bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Performance Insights</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="font-medium text-gray-700 mb-2">Peak Hours</h5>
              <div className="space-y-1">
                {getTopPerformanceSlots('highest').map((slot, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span>{slot.label}</span>
                    <Badge variant="secondary">
                      {selectedMetric === 'errorRate' ? `${slot.value.toFixed(1)}%` : slot.value.toFixed(0)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h5 className="font-medium text-gray-700 mb-2">Best Performance</h5>
              <div className="space-y-1">
                {getTopPerformanceSlots('lowest').map((slot, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span>{slot.label}</span>
                    <Badge variant="default">
                      {selectedMetric === 'errorRate' ? `${slot.value.toFixed(1)}%` : slot.value.toFixed(0)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute bg-black bg-opacity-80 text-white p-2 rounded text-xs pointer-events-none opacity-0 transition-opacity z-10"
      >
        {selectedCell && (
          <div>
            <div className="font-medium">{selectedCell.label}</div>
            <div>Avg Response: {selectedCell.details.avgResponseTime.toFixed(0)}ms</div>
            <div>Requests: {selectedCell.details.totalRequests}</div>
            <div>Error Rate: {selectedCell.details.errorRate.toFixed(1)}%</div>
            <div>P95: {selectedCell.details.p95ResponseTime.toFixed(0)}ms</div>
          </div>
        )}
      </div>
    </div>
  );

  function getTopPerformanceSlots(type: 'highest' | 'lowest') {
    const sorted = [...heatmapData]
      .filter(d => d.value > 0)
      .sort((a, b) => type === 'highest' ? b.value - a.value : a.value - b.value)
      .slice(0, 3);
    
    return sorted;
  }
};

export default PerformanceHeatmap;