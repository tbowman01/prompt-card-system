'use client';

import PromptCardList from '@/components/PromptCard/PromptCardList';
import YAMLImportExport from '@/components/YAML/YAMLImportExport';
import { useState } from 'react';

export default function PromptCardsPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleImportSuccess = (count: number) => {
    // Trigger a refresh of the prompt cards list
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* YAML Import/Export Section */}
        <div className="mb-8 bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">YAML Operations</h2>
          <YAMLImportExport onImportSuccess={handleImportSuccess} />
        </div>

        {/* Prompt Cards List */}
        <PromptCardList key={refreshTrigger} />
      </div>
    </div>
  );
}