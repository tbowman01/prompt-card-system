import React from 'react';
import { Metadata } from 'next';
import SamplePromptGallery from '@/components/SamplePrompts/SamplePromptGallery';

export const metadata: Metadata = {
  title: 'Sample Prompts - Prompt Card System',
  description: 'Explore our collection of high-quality prompt templates for various use cases'
};

export default function SamplePromptsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <SamplePromptGallery />
    </div>
  );
}