import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';

export interface AuditLogEntry {
  timestamp: string;
  requestId: string;
  method: string;
  url: string;
  ip: string;
  userAgent?: string;
  userId?: string;
  action?: string;
  resource?: string;
  statusCode?: number;
  duration?: number;
  securityLevel: 'info' | 'warn' | 'error' | 'critical';
  fingerprint: string;
}

// Security fingerprinting for request tracking
function generateFingerprint(request: FastifyRequest): string {
  const data = {
    ip: request.ip,
    userAgent: request.headers['user-agent'] || 'unknown',
    acceptLanguage: request.headers['accept-language'] || 'unknown'
  };
  
  return createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex')
    .substring(0, 16);
}

export async function auditLogger(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const startTime = Date.now();
  const fingerprint = generateFingerprint(request);
  
  // Initial audit log entry
  const auditEntry: Partial<AuditLogEntry> = {
    timestamp: new Date().toISOString(),
    requestId: request.id,
    method: request.method,
    url: request.url,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    fingerprint,
    securityLevel: 'info'
  };

  // Determine action and resource from URL
  const urlParts = request.url.split('/');
  if (urlParts.includes('auth')) {
    auditEntry.resource = 'authentication';
    
    if (request.url.includes('/login')) {
      auditEntry.action = 'login_attempt';
      auditEntry.securityLevel = 'warn';
    } else if (request.url.includes('/register')) {
      auditEntry.action = 'registration_attempt';
      auditEntry.securityLevel = 'warn';
    } else if (request.url.includes('/logout')) {
      auditEntry.action = 'logout';
    } else if (request.url.includes('/refresh')) {
      auditEntry.action = 'token_refresh';
    }
  }

  // Enhanced security monitoring for sensitive operations
  const sensitivePatterns = ['/admin', '/api-key', '/user', '/permission'];
  if (sensitivePatterns.some(pattern => request.url.includes(pattern))) {
    auditEntry.securityLevel = 'warn';
  }

  // Log completion hook
  reply.addHook('onSend', async (request, reply, payload) => {
    const duration = Date.now() - startTime;
    const finalEntry: AuditLogEntry = {
      ...auditEntry,
      statusCode: reply.statusCode,
      duration,
      securityLevel: reply.statusCode >= 400 ? 'error' : auditEntry.securityLevel || 'info'
    } as AuditLogEntry;

    // Critical security events
    if (reply.statusCode === 401 || reply.statusCode === 403) {
      finalEntry.securityLevel = 'critical';
    }

    // Log based on security level
    switch (finalEntry.securityLevel) {
      case 'critical':
        request.log.error(finalEntry, `CRITICAL: ${finalEntry.action || 'request'} failed`);
        break;
      case 'error':
        request.log.error(finalEntry, `ERROR: ${finalEntry.action || 'request'} failed`);
        break;
      case 'warn':
        request.log.warn(finalEntry, `AUDIT: ${finalEntry.action || 'request'}`);
        break;
      default:
        request.log.info(finalEntry, `AUDIT: ${finalEntry.action || 'request'}`);
    }

    return payload;
  });
}