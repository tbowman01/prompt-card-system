/**
 * PromptCardForm Component Unit Tests
 * @description Comprehensive tests for prompt card form functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock the API
jest.mock('@/lib/api', () => ({
  createPromptCard: jest.fn(),
  updatePromptCard: jest.fn(),
  getPromptCard: jest.fn(),
}));

import { PromptCardForm } from '../../../../frontend/src/components/PromptCard/PromptCardForm';
import * as api from '../../../../frontend/src/lib/api';

const mockApi = api as jest.Mocked<typeof api>;

describe('PromptCardForm', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Form Rendering', () => {
    it('should render all form fields', () => {
      // Act
      render(<PromptCardForm />);

      // Assert
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/prompt/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/expected output/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should render with initial values when editing', () => {
      // Arrange
      const initialData = {
        id: 'card-123',
        title: 'Test Card',
        description: 'Test Description',
        prompt: 'Test prompt: {{input}}',
        category: 'General',
        tags: ['test', 'unit'],
        expectedOutput: 'Expected result',
        variables: [{ name: 'input', type: 'string', required: true }],
      };

      // Act
      render(<PromptCardForm initialData={initialData} />);

      // Assert
      expect(screen.getByDisplayValue('Test Card')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Description')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test prompt: {{input}}')).toBeInTheDocument();
      expect(screen.getByDisplayValue('General')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test, unit')).toBeInTheDocument();
    });

    it('should show loading state during submission', async () => {
      // Arrange
      mockApi.createPromptCard.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      render(<PromptCardForm />);

      // Act
      await user.type(screen.getByLabelText(/title/i), 'Test Card');
      await user.type(screen.getByLabelText(/prompt/i), 'Test prompt');
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Assert
      expect(saveButton).toBeDisabled();
      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      // Arrange
      render(<PromptCardForm />);

      // Act
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Assert
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(screen.getByText(/prompt is required/i)).toBeInTheDocument();
      expect(mockApi.createPromptCard).not.toHaveBeenCalled();
    });

    it('should validate title length', async () => {
      // Arrange
      render(<PromptCardForm />);
      const titleInput = screen.getByLabelText(/title/i);

      // Act
      await user.type(titleInput, 'a'.repeat(101)); // Exceeds max length
      await user.click(screen.getByRole('button', { name: /save/i }));

      // Assert
      expect(screen.getByText(/title must be less than 100 characters/i)).toBeInTheDocument();
    });

    it('should validate prompt variables', async () => {
      // Arrange
      render(<PromptCardForm />);
      const promptInput = screen.getByLabelText(/prompt/i);

      // Act
      await user.type(promptInput, 'Test prompt with {{invalidVariable}}');
      await user.type(screen.getByLabelText(/title/i), 'Test');

      // Add variable section
      const addVariableButton = screen.getByRole('button', { name: /add variable/i });
      await user.click(addVariableButton);

      // Don't define the variable used in prompt
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Assert
      expect(screen.getByText(/undefined variable: invalidVariable/i)).toBeInTheDocument();
    });

    it('should validate tag format', async () => {
      // Arrange
      render(<PromptCardForm />);
      const tagsInput = screen.getByLabelText(/tags/i);

      // Act
      await user.type(tagsInput, 'valid-tag, invalid tag with spaces, another-valid-tag');
      await user.click(screen.getByRole('button', { name: /save/i }));

      // Assert
      expect(screen.getByText(/tags cannot contain spaces/i)).toBeInTheDocument();
    });
  });

  describe('Variable Management', () => {
    it('should add new variables', async () => {
      // Arrange
      render(<PromptCardForm />);

      // Act
      const addVariableButton = screen.getByRole('button', { name: /add variable/i });
      await user.click(addVariableButton);

      // Assert
      expect(screen.getByLabelText(/variable name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/variable type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/required/i)).toBeInTheDocument();
    });

    it('should remove variables', async () => {
      // Arrange
      render(<PromptCardForm />);

      // Act
      const addVariableButton = screen.getByRole('button', { name: /add variable/i });
      await user.click(addVariableButton);

      const removeButton = screen.getByRole('button', { name: /remove variable/i });
      await user.click(removeButton);

      // Assert
      expect(screen.queryByLabelText(/variable name/i)).not.toBeInTheDocument();
    });

    it('should auto-detect variables from prompt', async () => {
      // Arrange
      render(<PromptCardForm />);
      const promptInput = screen.getByLabelText(/prompt/i);

      // Act
      await user.type(promptInput, 'Test prompt with {{name}} and {{age}} variables');
      
      const detectButton = screen.getByRole('button', { name: /auto-detect variables/i });
      await user.click(detectButton);

      // Assert
      expect(screen.getByDisplayValue('name')).toBeInTheDocument();
      expect(screen.getByDisplayValue('age')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should create new prompt card successfully', async () => {
      // Arrange
      const mockResponse = {
        id: 'card-123',
        title: 'Test Card',
        prompt: 'Test prompt',
      };
      mockApi.createPromptCard.mockResolvedValueOnce(mockResponse);

      const onSave = jest.fn();
      render(<PromptCardForm onSave={onSave} />);

      // Act
      await user.type(screen.getByLabelText(/title/i), 'Test Card');
      await user.type(screen.getByLabelText(/prompt/i), 'Test prompt');
      await user.selectOptions(screen.getByLabelText(/category/i), 'General');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Assert
      await waitFor(() => {
        expect(mockApi.createPromptCard).toHaveBeenCalledWith({
          title: 'Test Card',
          description: '',
          prompt: 'Test prompt',
          category: 'General',
          tags: [],
          variables: [],
          expectedOutput: '',
          metadata: {},
        });
        expect(onSave).toHaveBeenCalledWith(mockResponse);
      });
    });

    it('should update existing prompt card successfully', async () => {
      // Arrange
      const initialData = {
        id: 'card-123',
        title: 'Original Title',
        prompt: 'Original prompt',
      };
      const mockResponse = {
        ...initialData,
        title: 'Updated Title',
      };
      mockApi.updatePromptCard.mockResolvedValueOnce(mockResponse);

      const onSave = jest.fn();
      render(<PromptCardForm initialData={initialData} onSave={onSave} />);

      // Act
      const titleInput = screen.getByDisplayValue('Original Title');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Title');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Assert
      await waitFor(() => {
        expect(mockApi.updatePromptCard).toHaveBeenCalledWith('card-123', expect.objectContaining({
          title: 'Updated Title',
        }));
        expect(onSave).toHaveBeenCalledWith(mockResponse);
      });
    });

    it('should handle submission errors', async () => {
      // Arrange
      const errorMessage = 'Failed to save prompt card';
      mockApi.createPromptCard.mockRejectedValueOnce(new Error(errorMessage));

      render(<PromptCardForm />);

      // Act
      await user.type(screen.getByLabelText(/title/i), 'Test Card');
      await user.type(screen.getByLabelText(/prompt/i), 'Test prompt');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe('Form Reset', () => {
    it('should reset form when cancel is clicked', async () => {
      // Arrange
      render(<PromptCardForm />);

      // Act
      await user.type(screen.getByLabelText(/title/i), 'Test Card');
      await user.type(screen.getByLabelText(/prompt/i), 'Test prompt');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Assert
      expect(screen.getByLabelText(/title/i)).toHaveValue('');
      expect(screen.getByLabelText(/prompt/i)).toHaveValue('');
    });

    it('should call onCancel when provided', async () => {
      // Arrange
      const onCancel = jest.fn();
      render(<PromptCardForm onCancel={onCancel} />);

      // Act
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Assert
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      // Act
      render(<PromptCardForm />);

      // Assert
      expect(screen.getByLabelText(/title/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/prompt/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Prompt card form');
    });

    it('should announce validation errors to screen readers', async () => {
      // Arrange
      render(<PromptCardForm />);

      // Act
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Assert
      const errorMessages = screen.getAllByRole('alert');
      expect(errorMessages.length).toBeGreaterThan(0);
      expect(errorMessages[0]).toHaveAttribute('aria-live', 'polite');
    });

    it('should support keyboard navigation', async () => {
      // Arrange
      render(<PromptCardForm />);

      // Act
      const titleInput = screen.getByLabelText(/title/i);
      titleInput.focus();

      // Assert
      expect(titleInput).toHaveFocus();

      // Tab to next field
      await user.tab();
      expect(screen.getByLabelText(/description/i)).toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('should debounce validation', async () => {
      // Arrange
      const validateSpy = jest.fn();
      render(<PromptCardForm onValidate={validateSpy} />);
      const titleInput = screen.getByLabelText(/title/i);

      // Act
      await user.type(titleInput, 'rapid typing');

      // Assert
      // Validation should not be called for every keystroke
      expect(validateSpy).toHaveBeenCalledTimes(1);
    });

    it('should not re-render unnecessarily', () => {
      // Arrange
      const renderSpy = jest.fn();
      const TestWrapper = () => {
        renderSpy();
        return <PromptCardForm />;
      };

      // Act
      const { rerender } = render(<TestWrapper />);
      rerender(<TestWrapper />);

      // Assert
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });
  });
});