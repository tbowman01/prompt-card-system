'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { 
  GitBranch, 
  Clock, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Search,
  Filter,
  Zap,
  Database,
  Server,
  Globe,
  ArrowRight
} from 'lucide-react';

interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  operationName: string;
  serviceName: string;
  startTime: number;
  duration: number;
  status: 'success' | 'error' | 'timeout';
  tags: Record<string, any>;
  logs: Array<{
    timestamp: number;
    level: 'info' | 'warn' | 'error';
    message: string;
    fields?: Record<string, any>;
  }>;
}

interface Trace {
  id: string;
  operationName: string;
  startTime: number;
  duration: number;
  spans: Span[];
  services: string[];
  errorCount: number;
  status: 'success' | 'error' | 'partial';
}

interface DistributedTracingProps {
  data: any;
  config?: any;
  isFullscreen?: boolean;
}

const DistributedTracingViz: React.FC<DistributedTracingProps> = ({
  data,
  config = {},
  isFullscreen = false
}) => {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
  const [filter, setFilter] = useState({
    search: '',
    service: 'all',
    status: 'all',
    minDuration: 0,
    maxDuration: 0
  });
  const [viewMode, setViewMode] = useState<'list' | 'timeline' | 'flamegraph'>('timeline');
  const [traceDetailModal, setTraceDetailModal] = useState(false);
  const [spanDetailModal, setSpanDetailModal] = useState(false);
  
  const timelineRef = useRef<SVGSVGElement>(null);
  const flamegraphRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (data?.traces) {
      setTraces(data.traces);
    }
  }, [data]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'timeout':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getServiceIcon = (serviceName: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      database: <Database className="h-4 w-4" />,
      api: <Server className="h-4 w-4" />,
      frontend: <Globe className="h-4 w-4" />,
      cache: <Zap className="h-4 w-4" />
    };
    
    const serviceType = Object.keys(iconMap).find(key => 
      serviceName.toLowerCase().includes(key)
    );
    
    return iconMap[serviceType || 'api'] || <Activity className="h-4 w-4" />;
  };

  const formatDuration = (duration: number): string => {
    if (duration >= 1000) {
      return `${(duration / 1000).toFixed(2)}s`;
    }
    return `${duration.toFixed(1)}ms`;
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const buildSpanTree = (spans: Span[]): Span[] => {
    const spanMap = new Map(spans.map(span => [span.id, span]));
    const roots: Span[] = [];
    
    spans.forEach(span => {
      if (!span.parentId) {
        roots.push(span);
      } else {
        const parent = spanMap.get(span.parentId);
        if (parent) {
          if (!(parent as any).children) {
            (parent as any).children = [];
          }
          (parent as any).children.push(span);
        }
      }
    });
    
    return roots;
  };

  const renderTimeline = (trace: Trace) => {
    if (!timelineRef.current) return;

    const svg = d3.select(timelineRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 30, left: 200 };
    const width = (timelineRef.current.clientWidth || 800) - margin.left - margin.right;
    const height = Math.max(400, trace.spans.length * 30) - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Time scale
    const minTime = Math.min(...trace.spans.map(s => s.startTime));
    const maxTime = Math.max(...trace.spans.map(s => s.startTime + s.duration));
    const timeScale = d3.scaleLinear()
      .domain([minTime, maxTime])
      .range([0, width]);

    // Y scale for spans
    const yScale = d3.scaleBand()
      .domain(trace.spans.map(s => s.id))
      .range([0, height])
      .padding(0.1);

    // Draw spans
    const spans = g.selectAll('.span')
      .data(trace.spans)
      .enter().append('g')
      .attr('class', 'span')
      .attr('transform', d => `translate(0, ${yScale(d.id)})`);

    // Span backgrounds
    spans.append('rect')
      .attr('x', d => timeScale(d.startTime))
      .attr('width', d => Math.max(1, timeScale(d.startTime + d.duration) - timeScale(d.startTime)))
      .attr('height', yScale.bandwidth())
      .attr('fill', d => {
        switch (d.status) {
          case 'success': return '#10b981';
          case 'error': return '#ef4444';
          case 'timeout': return '#f59e0b';
          default: return '#6b7280';
        }
      })
      .attr('opacity', 0.7)
      .attr('rx', 3)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedSpan(d);
        setSpanDetailModal(true);
      });

    // Span labels
    spans.append('text')
      .attr('x', -5)
      .attr('y', yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('font-size', '12px')
      .attr('fill', '#374151')
      .text(d => `${d.serviceName}: ${d.operationName}`);

    // Duration labels
    spans.append('text')
      .attr('x', d => timeScale(d.startTime) + 5)
      .attr('y', yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('font-size', '10px')
      .attr('fill', 'white')
      .text(d => formatDuration(d.duration));

    // Time axis
    const timeAxis = d3.axisBottom(timeScale)
      .tickFormat(d => `+${((d as number) - minTime).toFixed(0)}ms`);

    g.append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(timeAxis);
  };

  const renderFlamegraph = (trace: Trace) => {
    if (!flamegraphRef.current) return;

    const svg = d3.select(flamegraphRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 30, left: 20 };
    const width = (flamegraphRef.current.clientWidth || 800) - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Build hierarchy
    const spanTree = buildSpanTree(trace.spans);
    
    const hierarchy = d3.hierarchy({ children: spanTree } as any, d => (d as any).children)
      .sum(d => (d as any).duration || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const partition = d3.partition<any>()
      .size([width, height])
      .padding(1);

    const root = partition(hierarchy);

    // Color scale
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Draw rectangles
    const cell = g.selectAll('.cell')
      .data(root.descendants())
      .enter().append('g')
      .attr('class', 'cell');

    cell.append('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', d => d.data.serviceName ? colorScale(d.data.serviceName) : '#f3f4f6')
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (d.data.id) {
          setSelectedSpan(d.data);
          setSpanDetailModal(true);
        }
      });

    // Add labels
    cell.append('text')
      .attr('x', d => (d.x0 + d.x1) / 2)
      .attr('y', d => (d.y0 + d.y1) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', 'white')
      .text(d => {
        const width = d.x1 - d.x0;
        if (width < 50 || !d.data.operationName) return '';
        return d.data.operationName.length > 15 
          ? d.data.operationName.substring(0, 15) + '...' 
          : d.data.operationName;
      });
  };

  useEffect(() => {
    if (selectedTrace) {
      if (viewMode === 'timeline') {
        renderTimeline(selectedTrace);
      } else if (viewMode === 'flamegraph') {
        renderFlamegraph(selectedTrace);
      }
    }
  }, [selectedTrace, viewMode]);

  const filteredTraces = traces.filter(trace => {
    if (filter.search && !trace.operationName.toLowerCase().includes(filter.search.toLowerCase()) &&
        !trace.services.some(s => s.toLowerCase().includes(filter.search.toLowerCase()))) {
      return false;
    }
    if (filter.service !== 'all' && !trace.services.includes(filter.service)) {
      return false;
    }
    if (filter.status !== 'all' && trace.status !== filter.status) {
      return false;
    }
    if (filter.minDuration > 0 && trace.duration < filter.minDuration) {
      return false;
    }
    if (filter.maxDuration > 0 && trace.duration > filter.maxDuration) {
      return false;
    }
    return true;
  });

  const allServices = [...new Set(traces.flatMap(trace => trace.services))];

  return (
    <div className="h-full flex flex-col">
      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <GitBranch className="h-5 w-5 text-gray-600" />
          <span className="font-semibold">Distributed Tracing</span>
          <Badge variant="outline">{filteredTraces.length} traces</Badge>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
          <Button
            variant={viewMode === 'timeline' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('timeline')}
          >
            Timeline
          </Button>
          <Button
            variant={viewMode === 'flamegraph' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('flamegraph')}
          >
            Flamegraph
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search traces..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
            value={filter.search}
            onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>

        <select
          value={filter.service}
          onChange={(e) => setFilter(prev => ({ ...prev, service: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Services</option>
          {allServices.map(service => (
            <option key={service} value={service}>{service}</option>
          ))}
        </select>

        <select
          value={filter.status}
          onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="partial">Partial</option>
        </select>

        <input
          type="number"
          placeholder="Min duration (ms)"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          value={filter.minDuration || ''}
          onChange={(e) => setFilter(prev => ({ ...prev, minDuration: Number(e.target.value) || 0 }))}
        />

        <input
          type="number"
          placeholder="Max duration (ms)"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          value={filter.maxDuration || ''}
          onChange={(e) => setFilter(prev => ({ ...prev, maxDuration: Number(e.target.value) || 0 }))}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'list' ? (
          // List View
          <div className="h-full overflow-auto space-y-2">
            {filteredTraces.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No traces found</p>
              </div>
            ) : (
              filteredTraces.map((trace) => (
                <div
                  key={trace.id}
                  className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedTrace(trace);
                    setTraceDetailModal(true);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {getStatusIcon(trace.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {trace.operationName}
                          </h4>
                          <Badge className={getStatusColor(trace.status)}>
                            {trace.status.toUpperCase()}
                          </Badge>
                          {trace.errorCount > 0 && (
                            <Badge variant="destructive">
                              {trace.errorCount} errors
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatDuration(trace.duration)}
                          </span>
                          <span>{trace.spans.length} spans</span>
                          <span>{trace.services.length} services</span>
                          <span>{formatTimestamp(trace.startTime)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {trace.services.slice(0, 3).map((service, index) => (
                        <div key={service} className="flex items-center space-x-1">
                          {getServiceIcon(service)}
                          <span className="text-xs text-gray-600">{service}</span>
                        </div>
                      ))}
                      {trace.services.length > 3 && (
                        <span className="text-xs text-gray-500">+{trace.services.length - 3}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          // Timeline/Flamegraph View
          <div className="h-full flex">
            {/* Trace List */}
            <div className="w-1/3 border-r border-gray-200 overflow-auto">
              <div className="p-2 border-b border-gray-200">
                <h4 className="font-medium text-gray-900">Select Trace</h4>
              </div>
              <div className="space-y-1 p-2">
                {filteredTraces.map((trace) => (
                  <div
                    key={trace.id}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      selectedTrace?.id === trace.id 
                        ? 'bg-blue-100 border border-blue-300' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedTrace(trace)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">
                        {trace.operationName}
                      </span>
                      {getStatusIcon(trace.status)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDuration(trace.duration)} • {trace.spans.length} spans
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visualization */}
            <div className="flex-1 overflow-auto">
              {selectedTrace ? (
                <div className="p-4">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedTrace.operationName}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>Duration: {formatDuration(selectedTrace.duration)}</span>
                      <span>Spans: {selectedTrace.spans.length}</span>
                      <span>Services: {selectedTrace.services.join(', ')}</span>
                    </div>
                  </div>
                  
                  <div className="w-full">
                    {viewMode === 'timeline' ? (
                      <svg
                        ref={timelineRef}
                        width="100%"
                        height={Math.max(400, selectedTrace.spans.length * 30)}
                        className="border border-gray-200 rounded"
                      />
                    ) : (
                      <svg
                        ref={flamegraphRef}
                        width="100%"
                        height="400"
                        className="border border-gray-200 rounded"
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a trace to view details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Trace Detail Modal */}
      <Modal
        isOpen={traceDetailModal}
        onClose={() => {
          setTraceDetailModal(false);
          setSelectedTrace(null);
        }}
        title="Trace Details"
      >
        {selectedTrace && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="font-medium text-gray-700">Operation:</label>
                <p className="text-gray-600">{selectedTrace.operationName}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Status:</label>
                <Badge className={getStatusColor(selectedTrace.status)}>
                  {selectedTrace.status.toUpperCase()}
                </Badge>
              </div>
              <div>
                <label className="font-medium text-gray-700">Duration:</label>
                <p className="text-gray-600">{formatDuration(selectedTrace.duration)}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Spans:</label>
                <p className="text-gray-600">{selectedTrace.spans.length}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Services:</label>
                <p className="text-gray-600">{selectedTrace.services.join(', ')}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Start Time:</label>
                <p className="text-gray-600">{formatTimestamp(selectedTrace.startTime)}</p>
              </div>
            </div>

            <div>
              <label className="font-medium text-gray-700 block mb-2">Spans:</label>
              <div className="max-h-64 overflow-auto space-y-2">
                {selectedTrace.spans.map((span) => (
                  <div
                    key={span.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                    onClick={() => {
                      setSelectedSpan(span);
                      setSpanDetailModal(true);
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(span.status)}
                      <span className="text-sm">{span.serviceName}: {span.operationName}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDuration(span.duration)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Span Detail Modal */}
      <Modal
        isOpen={spanDetailModal}
        onClose={() => {
          setSpanDetailModal(false);
          setSelectedSpan(null);
        }}
        title="Span Details"
      >
        {selectedSpan && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="font-medium text-gray-700">Operation:</label>
                <p className="text-gray-600">{selectedSpan.operationName}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Service:</label>
                <p className="text-gray-600">{selectedSpan.serviceName}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Status:</label>
                <Badge className={getStatusColor(selectedSpan.status)}>
                  {selectedSpan.status.toUpperCase()}
                </Badge>
              </div>
              <div>
                <label className="font-medium text-gray-700">Duration:</label>
                <p className="text-gray-600">{formatDuration(selectedSpan.duration)}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Start Time:</label>
                <p className="text-gray-600">{formatTimestamp(selectedSpan.startTime)}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Span ID:</label>
                <p className="text-gray-600 font-mono text-xs">{selectedSpan.id}</p>
              </div>
            </div>

            {Object.keys(selectedSpan.tags).length > 0 && (
              <div>
                <label className="font-medium text-gray-700 block mb-2">Tags:</label>
                <div className="bg-gray-50 rounded p-3 max-h-32 overflow-auto">
                  <pre className="text-xs text-gray-600">
                    {JSON.stringify(selectedSpan.tags, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {selectedSpan.logs.length > 0 && (
              <div>
                <label className="font-medium text-gray-700 block mb-2">Logs:</label>
                <div className="max-h-48 overflow-auto space-y-1">
                  {selectedSpan.logs.map((log, index) => (
                    <div key={index} className="text-xs bg-gray-50 rounded p-2">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant={
                          log.level === 'error' ? 'destructive' : 
                          log.level === 'warn' ? 'secondary' : 'default'
                        }>
                          {log.level.toUpperCase()}
                        </Badge>
                        <span className="text-gray-500">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                      <p className="text-gray-700">{log.message}</p>
                      {log.fields && (
                        <pre className="mt-1 text-gray-600">
                          {JSON.stringify(log.fields, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DistributedTracingViz;