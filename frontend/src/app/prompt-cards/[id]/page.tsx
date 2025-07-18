'use client';

import { useParams } from 'next/navigation';
import PromptCardForm from '@/components/PromptCard/PromptCardForm';

export default function EditPromptCardPage() {
  const params = useParams();
  const cardId = params.id ? parseInt(params.id as string) : undefined;

  if (!cardId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Card ID</h1>
          <p className="text-gray-600">The prompt card ID provided is not valid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <PromptCardForm cardId={cardId} />
      </div>
    </div>
  );
}