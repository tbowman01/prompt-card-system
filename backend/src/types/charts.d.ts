import { ChartConfiguration, ChartType } from 'chart.js';

// Custom chart data interface compatible with Chart.js
export interface CustomChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
  }>;
  options?: {
    responsive?: boolean;
    maintainAspectRatio?: boolean;
    plugins?: any;
    scales?: any;
  };
}

// Chart.js compatible dataset interface
export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  fill?: boolean;
  tension?: number;
  type?: ChartType;
}

// Specific chart types for different visualizations
export interface LineChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor?: string;
    fill?: boolean;
    tension?: number;
  }>;
}

export interface BarChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string | string[];
    borderColor?: string;
    borderWidth?: number;
  }>;
}

export interface PieChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string[];
    borderColor?: string[];
    borderWidth?: number;
  }>;
}

// Chart configuration types
export interface ChartOptions {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  plugins?: {
    legend?: {
      display?: boolean;
      position?: 'top' | 'bottom' | 'left' | 'right';
    };
    tooltip?: {
      enabled?: boolean;
      mode?: 'index' | 'dataset' | 'point' | 'nearest';
    };
    title?: {
      display?: boolean;
      text?: string;
    };
  };
  scales?: {
    x?: {
      display?: boolean;
      title?: {
        display?: boolean;
        text?: string;
      };
    };
    y?: {
      display?: boolean;
      beginAtZero?: boolean;
      title?: {
        display?: boolean;
        text?: string;
      };
    };
  };
}

// Export default chart configuration
export const DEFAULT_CHART_OPTIONS: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top',
    },
    tooltip: {
      enabled: true,
      mode: 'index',
    },
  },
  scales: {
    x: {
      display: true,
    },
    y: {
      display: true,
      beginAtZero: true,
    },
  },
};