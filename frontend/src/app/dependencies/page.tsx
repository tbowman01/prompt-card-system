import React from 'react';
import DependencyDashboard from '../../components/Dependencies/DependencyDashboard';

export default function DependenciesPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <DependencyDashboard />
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Dependency Dashboard - Security & Compliance Monitoring',
  description: 'Comprehensive dependency management with vulnerability scanning, license compliance, and automated update workflows.',
};