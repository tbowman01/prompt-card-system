'use client';

import React from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Header from '@/components/Header/Header';

interface ClientLayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="prompt-card-theme">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Header 
          user={{
            name: 'Demo User',
            email: 'demo@example.com'
          }}
        />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {children}
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}