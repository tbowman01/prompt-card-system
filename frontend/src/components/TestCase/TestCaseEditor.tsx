'use client';

import { useState } from 'react';
import { TestCase, CreateTestCaseRequest, AssertionType } from '@/types';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';

interface TestCaseEditorProps {
  promptCardId: number;
  testCases: TestCase[];
  variables: string[];
  onTestCasesChange: (testCases: TestCase[]) => void;
}

interface NewTestCase {
  name: string;
  input_variables: Record<string, string>;
  expected_output: string;
  assertions: AssertionType[];
}

const assertionTypes = [
  { value: 'contains', label: 'Contains' },
  { value: 'not-contains', label: 'Does not contain' },
  { value: 'equals', label: 'Equals' },
  { value: 'not-equals', label: 'Does not equal' },
  { value: 'regex', label: 'Matches regex' },
  { value: 'length', label: 'Length' }
];

export default function TestCaseEditor({ promptCardId, testCases, variables, onTestCasesChange }: TestCaseEditorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTestCase, setNewTestCase] = useState<NewTestCase>({
    name: '',
    input_variables: {},
    expected_output: '',
    assertions: []
  });

  // Initialize input variables for new test case
  const initializeNewTestCase = () => {
    const inputVars: Record<string, string> = {};
    variables.forEach(variable => {
      inputVars[variable] = '';
    });
    
    setNewTestCase({
      name: '',
      input_variables: inputVars,
      expected_output: '',
      assertions: []
    });
    setShowAddForm(true);
  };

  const handleSaveTestCase = async () => {
    if (!newTestCase.name.trim()) {
      setError('Test case name is required');
      return;
    }

    // Check if all variables have values
    const missingVars = variables.filter(v => !newTestCase.input_variables[v]?.trim());
    if (missingVars.length > 0) {
      setError(`Please provide values for: ${missingVars.join(', ')}`);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const testCaseData: CreateTestCaseRequest = {
        prompt_card_id: promptCardId,
        name: newTestCase.name,
        input_variables: newTestCase.input_variables,
        expected_output: newTestCase.expected_output || undefined,
        assertions: newTestCase.assertions
      };

      const response = await fetch('/api/test-cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCaseData)
      });

      const result = await response.json();

      if (result.success) {
        onTestCasesChange([...testCases, result.data]);
        setShowAddForm(false);
        setNewTestCase({
          name: '',
          input_variables: {},
          expected_output: '',
          assertions: []
        });
      } else {
        setError(result.error || 'Failed to save test case');
      }
    } catch (err) {
      setError('Network error: Failed to save test case');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTestCase = async (id: number) => {
    if (!confirm('Are you sure you want to delete this test case?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/test-cases/${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        onTestCasesChange(testCases.filter(tc => tc.id !== id));
      } else {
        setError(result.error || 'Failed to delete test case');
      }
    } catch (err) {
      setError('Network error: Failed to delete test case');
    } finally {
      setLoading(false);
    }
  };

  const addAssertion = () => {
    setNewTestCase(prev => ({
      ...prev,
      assertions: [
        ...prev.assertions,
        { type: 'contains' as const, value: '', description: '' }
      ]
    }));
  };

  const updateAssertion = (index: number, field: keyof AssertionType, value: string | number) => {
    setNewTestCase(prev => ({
      ...prev,
      assertions: prev.assertions.map((assertion, i) => 
        i === index ? { ...assertion, [field]: value } : assertion
      )
    }));
  };

  const removeAssertion = (index: number) => {
    setNewTestCase(prev => ({
      ...prev,
      assertions: prev.assertions.filter((_, i) => i !== index)
    }));
  };

  const renderInputVariables = (inputVars: Record<string, any>, isEditing: boolean = false) => {
    return (
      <div className="space-y-2">
        {Object.entries(inputVars).map(([key, value]) => (
          <div key={key} className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 w-24">{key}:</span>
            {isEditing ? (
              <input
                type="text"
                value={newTestCase.input_variables[key] || ''}
                onChange={(e) => setNewTestCase(prev => ({
                  ...prev,
                  input_variables: { ...prev.input_variables, [key]: e.target.value }
                }))}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder={`Enter value for ${key}`}
              />
            ) : (
              <span className="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded font-mono">
                {value}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Existing Test Cases */}
      {testCases.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-900">Existing Test Cases</h3>
          {testCases.map((testCase) => (
            <div key={testCase.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-medium text-gray-900">{testCase.name}</h4>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleDeleteTestCase(testCase.id)}
                  disabled={loading}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  Delete
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Input Variables:</h5>
                  {renderInputVariables(testCase.input_variables)}
                </div>

                <div>
                  {testCase.expected_output && (
                    <div className="mb-3">
                      <h5 className="text-sm font-medium text-gray-700 mb-1">Expected Output:</h5>
                      <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        {testCase.expected_output}
                      </p>
                    </div>
                  )}

                  {testCase.assertions.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Assertions:</h5>
                      <div className="space-y-1">
                        {testCase.assertions.map((assertion, index) => (
                          <Badge key={index} variant="outline" className="mr-2">
                            {assertion.type}: {assertion.value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add New Test Case */}
      {!showAddForm ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500 mb-4">
            {testCases.length === 0 ? 'No test cases yet.' : 'Add more test cases to validate your prompt.'}
          </p>
          <Button onClick={initializeNewTestCase} disabled={variables.length === 0}>
            Add Test Case
          </Button>
          {variables.length === 0 && (
            <p className="text-sm text-gray-400 mt-2">
              Add variables to your prompt template first
            </p>
          )}
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
          <h3 className="text-md font-medium text-gray-900 mb-4">Add New Test Case</h3>
          
          <div className="space-y-4">
            {/* Test Case Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Test Case Name *
              </label>
              <input
                type="text"
                value={newTestCase.name}
                onChange={(e) => setNewTestCase(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe what this test case validates"
              />
            </div>

            {/* Input Variables */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Input Variables *
              </label>
              {renderInputVariables(newTestCase.input_variables, true)}
            </div>

            {/* Expected Output */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Output (optional)
              </label>
              <textarea
                value={newTestCase.expected_output}
                onChange={(e) => setNewTestCase(prev => ({ ...prev, expected_output: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe what the expected output should contain"
              />
            </div>

            {/* Assertions */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Assertions (optional)
                </label>
                <Button type="button" variant="outline" size="sm" onClick={addAssertion}>
                  Add Assertion
                </Button>
              </div>
              
              {newTestCase.assertions.map((assertion, index) => (
                <div key={index} className="border border-gray-200 rounded p-3 mb-2 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <select
                      value={assertion.type}
                      onChange={(e) => updateAssertion(index, 'type', e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      {assertionTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    
                    <input
                      type={assertion.type === 'length' ? 'number' : 'text'}
                      value={assertion.value}
                      onChange={(e) => updateAssertion(index, 'value', 
                        assertion.type === 'length' ? Number(e.target.value) : e.target.value
                      )}
                      placeholder="Assertion value"
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    
                    <div className="flex space-x-1">
                      <input
                        type="text"
                        value={assertion.description || ''}
                        onChange={(e) => updateAssertion(index, 'description', e.target.value)}
                        placeholder="Description (optional)"
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => removeAssertion(index)}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowAddForm(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={handleSaveTestCase}
                disabled={loading}
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Save Test Case'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}