'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';

interface YAMLImportExportProps {
  onImportSuccess?: (count: number) => void;
}

export default function YAMLImportExport({ onImportSuccess }: YAMLImportExportProps) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [yamlContent, setYamlContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleImport = async () => {
    if (!yamlContent.trim()) {
      setError('Please enter YAML content');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/yaml/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ yamlContent })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(result.message);
        setYamlContent('');
        onImportSuccess?.(result.data.length);
        setTimeout(() => {
          setShowImportModal(false);
          setSuccess(null);
        }, 2000);
      } else {
        setError(result.error || 'Failed to import YAML');
      }
    } catch (err) {
      setError('Network error: Failed to import YAML');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!yamlContent.trim()) {
      setError('Please enter YAML content');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/yaml/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ yamlContent })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(`✓ YAML is valid (${result.configCount} configuration${result.configCount > 1 ? 's' : ''})`);
      } else {
        setError(result.error || 'YAML validation failed');
      }
    } catch (err) {
      setError('Network error: Failed to validate YAML');
    } finally {
      setLoading(false);
    }
  };

  const handleExportAll = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/yaml/export');
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prompt-cards-export-${Date.now()}.yaml`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setSuccess('Export downloaded successfully');
      } else {
        const result = await response.json();
        setError(result.error || 'Failed to export YAML');
      }
    } catch (err) {
      setError('Network error: Failed to export YAML');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setYamlContent('');
    setError(null);
    setSuccess(null);
    setShowImportModal(false);
  };

  return (
    <div className="space-y-4">
      {(error || success) && (
        <div className={`p-4 rounded-md ${error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <p className={error ? 'text-red-800' : 'text-green-800'}>
            {error || success}
          </p>
        </div>
      )}

      <div className="flex space-x-4">
        <Button onClick={() => setShowImportModal(true)} variant="outline">
          Import YAML
        </Button>
        <Button onClick={handleExportAll} disabled={loading} variant="outline">
          {loading ? <LoadingSpinner size="sm" /> : 'Export All to YAML'}
        </Button>
      </div>

      <Modal 
        isOpen={showImportModal} 
        onClose={resetModal}
        title="Import Prompt Cards from YAML"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Promptfoo YAML Configuration
            </label>
            <textarea
              value={yamlContent}
              onChange={(e) => setYamlContent(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder={`Paste your Promptfoo YAML configuration here:

prompts:
  - "Translate the following text to French: {{input}}"
providers:
  - ollama:chat:llama2:7b
tests:
  - vars:
      input: "Hello world"
    assert:
      - type: contains
        value: "Bonjour"
description: "Translation prompt example"`}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-green-800 text-sm">{success}</p>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-gray-200">
            <div className="space-x-2">
              <Button 
                onClick={handleValidate}
                variant="outline"
                disabled={loading}
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Validate'}
              </Button>
            </div>
            <div className="space-x-2">
              <Button 
                onClick={resetModal}
                variant="outline"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleImport}
                disabled={loading || !yamlContent.trim()}
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Import'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-md">
        <h4 className="font-medium mb-2">YAML Import/Export</h4>
        <ul className="space-y-1 text-sm">
          <li>• <strong>Import:</strong> Paste Promptfoo-compatible YAML to create prompt cards with test cases</li>
          <li>• <strong>Export:</strong> Download all prompt cards as Promptfoo YAML configuration</li>
          <li>• <strong>Format:</strong> Compatible with <a href="https://github.com/promptfoo/promptfoo" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Promptfoo</a> evaluation framework</li>
        </ul>
      </div>
    </div>
  );
}