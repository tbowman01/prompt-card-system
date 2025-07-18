import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Input,
  Label,
  Progress,
  Alert,
  AlertDescription
} from '@/components/ui';
import { Download, FileText, BarChart3, DollarSign, TrendingUp, Calendar, Filter } from 'lucide-react';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'executive' | 'detailed' | 'cost' | 'performance' | 'custom';
  supportedFormats: string[];
}

interface ReportData {
  id: string;
  title: string;
  description: string;
  generatedAt: Date;
  metadata: {
    totalExecutions: number;
    totalCost: number;
    averagePerformance: number;
    successRate: number;
    generationTime: number;
  };
  summary: {
    keyMetrics: Array<{
      label: string;
      value: string | number;
      trend?: 'up' | 'down' | 'stable';
    }>;
    insights: Array<{
      title: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
  };
}

interface ReportFilters {
  startDate?: string;
  endDate?: string;
  promptCardId?: number;
  model?: string;
  status?: 'passed' | 'failed' | 'all';
}

const ReportDashboard: React.FC = () => {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    status: 'all'
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentReport, setCurrentReport] = useState<ReportData | null>(null);
  const [reportHistory, setReportHistory] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
    loadReportHistory();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/reports/templates');
      const data = await response.json();
      
      if (data.success) {
        setTemplates(data.data);
        if (data.data.length > 0) {
          setSelectedTemplate(data.data[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      setError('Failed to load report templates');
    }
  };

  const loadReportHistory = async () => {
    try {
      const response = await fetch('/api/reports/history?limit=10');
      const data = await response.json();
      
      if (data.success) {
        setReportHistory(data.data);
      }
    } catch (error) {
      console.error('Error loading report history:', error);
    }
  };

  const generateReport = async () => {
    if (!selectedTemplate) return;

    setIsGenerating(true);
    setError(null);
    setGenerationProgress(0);

    try {
      const response = await fetch(`/api/reports/generate/${selectedTemplate}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters,
          options: {
            saveToHistory: true,
            userId: 'current-user'
          }
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCurrentReport(data.data);
        setGenerationProgress(100);
        loadReportHistory(); // Refresh history
        
        // Show success message
        setError(null);
      } else {
        setError(data.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      setError('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const exportReport = async (format: string) => {
    if (!currentReport) return;

    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/export/${currentReport.id}/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          includeCharts: true,
          includeRawData: format === 'excel',
          customizations: {
            theme: 'corporate',
            colors: {
              primary: '#2563eb',
              secondary: '#64748b',
              accent: '#10b981'
            }
          }
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `report_${currentReport.id}_${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to export report');
      }
    } catch (error) {
      console.error('Error exporting report:', error);
      setError('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const getTemplateIcon = (type: string) => {
    switch (type) {
      case 'executive': return <TrendingUp className="w-4 h-4" />;
      case 'cost': return <DollarSign className="w-4 h-4" />;
      case 'performance': return <BarChart3 className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatMetricValue = (value: string | number) => {
    if (typeof value === 'number') {
      if (value < 1000) return value.toFixed(1);
      if (value < 1000000) return (value / 1000).toFixed(1) + 'K';
      return (value / 1000000).toFixed(1) + 'M';
    }
    return value;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Advanced Report Dashboard</h1>
        <p className="text-gray-600">Generate comprehensive reports with PDF/Excel export capabilities</p>
      </div>

      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate">Generate Report</TabsTrigger>
          <TabsTrigger value="current">Current Report</TabsTrigger>
          <TabsTrigger value="history">Report History</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Report Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="template">Report Template</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger id="template">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center gap-2">
                            {getTemplateIcon(template.type)}
                            <span>{template.name}</span>
                            <Badge variant="secondary">{template.type}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Test Status</Label>
                  <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value as any})}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tests</SelectItem>
                      <SelectItem value="passed">Passed Only</SelectItem>
                      <SelectItem value="failed">Failed Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  />
                </div>
              </div>

              {selectedTemplate && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Selected Template Details</h4>
                  <p className="text-blue-800 text-sm">
                    {templates.find(t => t.id === selectedTemplate)?.description}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {templates.find(t => t.id === selectedTemplate)?.supportedFormats.map(format => (
                      <Badge key={format} variant="outline" className="text-blue-700 border-blue-200">
                        {format.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Button 
                onClick={generateReport} 
                disabled={isGenerating || !selectedTemplate}
                className="w-full"
              >
                {isGenerating ? 'Generating Report...' : 'Generate Report'}
              </Button>

              {isGenerating && (
                <div className="space-y-2">
                  <Progress value={generationProgress} className="w-full" />
                  <p className="text-sm text-gray-600 text-center">
                    Generating report... {generationProgress}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="current" className="space-y-6">
          {currentReport ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{currentReport.title}</span>
                    <Badge variant="outline">
                      Generated {new Date(currentReport.generatedAt).toLocaleDateString()}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">{currentReport.description}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-700">
                        {formatMetricValue(currentReport.metadata.totalExecutions)}
                      </div>
                      <div className="text-sm text-blue-600">Total Executions</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-700">
                        {currentReport.metadata.successRate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-green-600">Success Rate</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-700">
                        ${currentReport.metadata.totalCost.toFixed(2)}
                      </div>
                      <div className="text-sm text-purple-600">Total Cost</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-700">
                        {currentReport.metadata.averagePerformance.toFixed(0)}ms
                      </div>
                      <div className="text-sm text-orange-600">Avg Performance</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    <Button 
                      onClick={() => exportReport('pdf')} 
                      disabled={isExporting}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export PDF
                    </Button>
                    <Button 
                      onClick={() => exportReport('excel')} 
                      disabled={isExporting}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export Excel
                    </Button>
                    <Button 
                      onClick={() => exportReport('csv')} 
                      disabled={isExporting}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </Button>
                  </div>

                  {currentReport.summary.insights.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Key Insights</h4>
                      {currentReport.summary.insights.slice(0, 3).map((insight, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-medium">{insight.title}</h5>
                            <Badge className={getSeverityColor(insight.severity)}>
                              {insight.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{insight.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No report generated yet. Go to the Generate Report tab to create your first report.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Report History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reportHistory.length > 0 ? (
                <div className="space-y-3">
                  {reportHistory.map((report, index) => (
                    <div key={report.id} className="p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{report.title}</h4>
                          <p className="text-sm text-gray-600">{report.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>Generated: {new Date(report.generated_at).toLocaleDateString()}</span>
                            <span>Executions: {report.total_executions}</span>
                            <span>Cost: ${report.total_cost?.toFixed(2) || '0.00'}</span>
                            <span>Success Rate: {report.success_rate?.toFixed(1) || '0.0'}%</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(`/api/reports/history/${report.id}`, '_blank')}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No reports in history yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportDashboard;