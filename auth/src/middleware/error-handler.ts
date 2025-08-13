import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export interface SecurityError extends Error {
  statusCode?: number;
  code?: string;
  securityLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const securityError = error as SecurityError;
  
  // Log security-relevant errors
  if (securityError.securityLevel === 'critical' || securityError.securityLevel === 'high') {
    request.log.error({
      error: error.message,
      stack: error.stack,
      statusCode: securityError.statusCode,
      code: securityError.code,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      url: request.url,
      method: request.method,
      timestamp: new Date().toISOString()
    }, `Security error: ${error.message}`);
  }

  // Default status code
  const statusCode = securityError.statusCode || 500;

  // Security-first error response (don't leak internal details)
  const response = {
    success: false,
    error: getPublicErrorMessage(statusCode),
    code: securityError.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
    requestId: request.id
  };

  // Add additional context for development
  if (process.env.NODE_ENV === 'development') {
    (response as any).details = error.message;
  }

  reply.status(statusCode).send(response);
}

function getPublicErrorMessage(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Invalid request';
    case 401:
      return 'Authentication required';
    case 403:
      return 'Access denied';
    case 404:
      return 'Resource not found';
    case 409:
      return 'Conflict with existing resource';
    case 422:
      return 'Invalid input data';
    case 429:
      return 'Too many requests';
    case 500:
      return 'Internal server error';
    default:
      return 'An error occurred';
  }
}