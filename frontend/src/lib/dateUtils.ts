// Utility functions for consistent date formatting across SSR and client-side rendering
// These functions avoid hydration errors by using consistent formatting

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toISOString().replace('T', ' ').split('.')[0]; // Returns YYYY-MM-DD HH:mm:ss format
}

export function formatTime(date: string | Date): string {
  const d = new Date(date);
  return d.toISOString().split('T')[1].split('.')[0]; // Returns HH:mm:ss format
}

export function formatRelativeTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  } else if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}m ago`;
  } else if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}h ago`;
  } else {
    return formatDate(date);
  }
}

// For charts and data that needs consistent labeling
export function formatChartLabel(date: string | Date): string {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}`; // Returns MM/DD format
}