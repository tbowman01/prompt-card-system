import { ValidationError } from '../errors/ValidationError';

export class PromptSanitizer {
  private static readonly DANGEROUS_PATTERNS = [
    /ignore\s+.*instructions/i,
    /system\s+.*prompt/i,
    /jailbreak/i,
    /password|api.*key|secret/i,
    /role.*play/i,
    /pretend/i,
    /act.*as/i,
    /override/i,
    /you.*must/i,
    /required.*to/i,
    /force|compel/i
  ];

  public static sanitizePrompt(prompt: string): string {
    if (!prompt || typeof prompt !== 'string') {
      throw new ValidationError('Invalid prompt format');
    }

    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(prompt)) {
        throw new ValidationError(`Prompt contains potentially dangerous content`);
      }
    }

    // Basic sanitization
    return prompt
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/data:/gi, '') // Remove data: protocol
      .trim();
  }

  public static validateInput(input: any): void {
    if (!input || typeof input !== 'object') {
      throw new ValidationError('Invalid input format');
    }

    // Validate required fields
    if (!input.prompt) {
      throw new ValidationError('Prompt is required');
    }

    // Validate field types
    if (typeof input.prompt !== 'string') {
      throw new ValidationError('Prompt must be a string');
    }

    // Length validation
    if (input.prompt.length > 10000) {
      throw new ValidationError('Prompt exceeds maximum length');
    }

    if (input.prompt.length < 10) {
      throw new ValidationError('Prompt is too short');
    }
  }
}
