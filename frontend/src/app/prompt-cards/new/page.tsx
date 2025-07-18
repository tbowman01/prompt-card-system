'use client';

import PromptCardForm from '@/components/PromptCard/PromptCardForm';

export default function NewPromptCardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <PromptCardForm />
      </div>
    </div>
  );
}