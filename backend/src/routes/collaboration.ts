/**
 * Collaboration API Routes
 * REST endpoints for enterprise collaboration features
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import EnhancedCollaborationService from '../services/collaboration/EnhancedCollaborationService';
import EnterpriseAuthService from '../services/auth/EnterpriseAuthService';
import CollaborationAnalytics from '../services/collaboration/CollaborationAnalytics';
import ReviewWorkflowService from '../services/collaboration/ReviewWorkflowService';
import CommunicationService from '../services/collaboration/CommunicationService';
import { DatabaseConnection } from '../database/connection';
import { Server } from 'socket.io';

const router = Router();
const db = new DatabaseConnection();

// Services will be injected
let collaborationService: EnhancedCollaborationService;
let authService: EnterpriseAuthService;
let analytics: CollaborationAnalytics;
let reviewService: ReviewWorkflowService;
let communicationService: CommunicationService;

// Initialize services
export function initializeCollaborationServices(io: Server): void {
  authService = new EnterpriseAuthService();
  communicationService = new CommunicationService(io);
  reviewService = new ReviewWorkflowService(io, communicationService);
  analytics = new CollaborationAnalytics();
  collaborationService = new EnhancedCollaborationService(io, {
    maxConcurrentUsers: 100,
    analyticsEnabled: true,
    performanceMonitoring: true
  });
}

// Authentication middleware
const authenticateToken = async (req: Request, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const user = await authService.verifyToken(token);
    if (!user) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// === ORGANIZATION & WORKSPACE ROUTES ===

/**
 * GET /api/collaboration/organizations
 * Get organizations for user
 */
router.get('/organizations', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    const result = await db.query(`
      SELECT o.*, om.role, om.joined_at
      FROM collaboration.organizations o
      JOIN collaboration.organization_memberships om ON o.id = om.organization_id
      WHERE om.user_id = $1 AND o.is_active = true
      ORDER BY o.name
    `, [userId]);
    
    res.json({ organizations: result.rows });
  } catch (error) {
    console.error('Error getting organizations:', error);
    res.status(500).json({ error: 'Failed to get organizations' });
  }
});

/**
 * POST /api/collaboration/organizations
 * Create new organization
 */
router.post('/organizations',
  authenticateToken,
  [
    body('name').isLength({ min: 1, max: 255 }).trim(),
    body('slug').isLength({ min: 1, max: 100 }).isAlphanumeric(),
    body('domain').optional().isEmail(),
    body('subscriptionTier').optional().isIn(['free', 'pro', 'enterprise'])
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { name, slug, domain, subscriptionTier = 'free' } = req.body;
      const userId = req.user.id;
      
      // Check if slug is available
      const existing = await db.query(
        'SELECT id FROM collaboration.organizations WHERE slug = $1',
        [slug]
      );
      
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Organization slug already exists' });
      }
      
      const orgId = require('uuid').v4();
      
      // Create organization
      await db.query(`
        INSERT INTO collaboration.organizations (
          id, name, slug, domain, subscription_tier, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `, [orgId, name, slug, domain, subscriptionTier]);
      
      // Add creator as owner
      await db.query(`
        INSERT INTO collaboration.organization_memberships (
          id, organization_id, user_id, role, status, joined_at
        ) VALUES ($1, $2, $3, 'owner', 'active', NOW())
      `, [require('uuid').v4(), orgId, userId]);
      
      res.status(201).json({ 
        message: 'Organization created successfully',
        organizationId: orgId
      });
    } catch (error) {
      console.error('Error creating organization:', error);
      res.status(500).json({ error: 'Failed to create organization' });
    }
  }
);

/**
 * GET /api/collaboration/workspaces
 * Get workspaces for user
 */
router.get('/workspaces', 
  authenticateToken,
  [
    query('organizationId').optional().isUUID()
  ],
  async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const { organizationId } = req.query;
      
      let query = `
        SELECT w.*, wm.role, wm.joined_at,
               COUNT(DISTINCT d.id) as document_count,
               COUNT(DISTINCT wm2.user_id) as member_count
        FROM collaboration.workspaces w
        JOIN collaboration.workspace_memberships wm ON w.id = wm.workspace_id
        LEFT JOIN collaboration.documents d ON w.id = d.workspace_id
        LEFT JOIN collaboration.workspace_memberships wm2 ON w.id = wm2.workspace_id
        WHERE wm.user_id = $1 AND w.archived_at IS NULL
      `;
      
      const params = [userId];
      
      if (organizationId) {
        query += ` AND w.organization_id = $2`;
        params.push(organizationId as string);
      }
      
      query += ` GROUP BY w.id, wm.role, wm.joined_at ORDER BY w.name`;
      
      const result = await db.query(query, params);
      
      res.json({ workspaces: result.rows });
    } catch (error) {
      console.error('Error getting workspaces:', error);
      res.status(500).json({ error: 'Failed to get workspaces' });
    }
  }
);

/**
 * POST /api/collaboration/workspaces
 * Create new workspace
 */
router.post('/workspaces',
  authenticateToken,
  [
    body('organizationId').isUUID(),
    body('name').isLength({ min: 1, max: 255 }).trim(),
    body('description').optional().isLength({ max: 1000 }),
    body('isPrivate').optional().isBoolean(),
    body('maxCollaborators').optional().isInt({ min: 1, max: 1000 })
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { organizationId, name, description, isPrivate = false, maxCollaborators = 50 } = req.body;
      const userId = req.user.id;
      
      // Check organization membership
      const membership = await db.query(`
        SELECT role FROM collaboration.organization_memberships
        WHERE organization_id = $1 AND user_id = $2 AND status = 'active'
      `, [organizationId, userId]);
      
      if (membership.rows.length === 0) {
        return res.status(403).json({ error: 'Not a member of this organization' });
      }
      
      const workspaceId = require('uuid').v4();
      
      // Create workspace
      await db.query(`
        INSERT INTO collaboration.workspaces (
          id, organization_id, name, description, is_private, max_collaborators, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      `, [workspaceId, organizationId, name, description, isPrivate, maxCollaborators, userId]);
      
      // Add creator as admin
      await db.query(`
        INSERT INTO collaboration.workspace_memberships (
          id, workspace_id, user_id, role, joined_at
        ) VALUES ($1, $2, $3, 'admin', NOW())
      `, [require('uuid').v4(), workspaceId, userId]);
      
      res.status(201).json({ 
        message: 'Workspace created successfully',
        workspaceId
      });
    } catch (error) {
      console.error('Error creating workspace:', error);
      res.status(500).json({ error: 'Failed to create workspace' });
    }
  }
);

// === DOCUMENT COLLABORATION ROUTES ===

/**
 * GET /api/collaboration/documents/:documentId
 * Get document with collaboration info
 */
router.get('/documents/:documentId',
  authenticateToken,
  [
    param('documentId').isUUID()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;
      const userId = req.user.id;
      
      // Check document access
      const hasAccess = await authService.checkDocumentAccess(userId, documentId, 'read');
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Get document with collaboration info
      const result = await db.query(`
        SELECT d.*, w.name as workspace_name, w.organization_id,
               u.username as created_by_username
        FROM collaboration.documents d
        JOIN collaboration.workspaces w ON d.workspace_id = w.id
        JOIN collaboration.users u ON d.created_by = u.id
        WHERE d.id = $1
      `, [documentId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const document = result.rows[0];
      
      // Get active collaborators
      const activeSessions = collaborationService.getDocumentSessions(documentId);
      
      // Get recent comments
      const comments = await communicationService.getDocumentComments(documentId, true);
      
      // Get document versions
      const versions = await db.query(`
        SELECT dv.*, u.username as author_name
        FROM collaboration.document_versions dv
        JOIN collaboration.users u ON dv.author_id = u.id
        WHERE dv.document_id = $1
        ORDER BY dv.version_number DESC
        LIMIT 10
      `, [documentId]);
      
      res.json({
        document,
        activeCollaborators: activeSessions.length,
        collaborators: activeSessions.map(s => ({
          userId: s.userId,
          username: s.metadata.username,
          joinedAt: s.joinedAt,
          lastActivity: s.lastActivity
        })),
        comments: comments.length,
        recentComments: comments.slice(0, 5),
        versions: versions.rows
      });
    } catch (error) {
      console.error('Error getting document:', error);
      res.status(500).json({ error: 'Failed to get document' });
    }
  }
);

/**
 * POST /api/collaboration/documents
 * Create new collaborative document
 */
router.post('/documents',
  authenticateToken,
  [
    body('workspaceId').isUUID(),
    body('title').isLength({ min: 1, max: 255 }).trim(),
    body('content').optional(),
    body('documentType').optional().isIn(['prompt', 'template', 'guide']),
    body('isTemplate').optional().isBoolean(),
    body('tags').optional().isArray()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, title, content = '', documentType = 'prompt', isTemplate = false, tags = [] } = req.body;
      const userId = req.user.id;
      
      // Check workspace access
      const hasAccess = await authService.checkWorkspaceAccess(userId, workspaceId, 'write');
      if (!hasAccess) {
        return res.status(403).json({ error: 'Insufficient permissions to create documents' });
      }
      
      const documentId = require('uuid').v4();
      
      // Create document
      await db.query(`
        INSERT INTO collaboration.documents (
          id, workspace_id, title, content, document_type, is_template, tags, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      `, [documentId, workspaceId, title, content, documentType, isTemplate, JSON.stringify(tags), userId]);
      
      // Create initial version
      await db.query(`
        INSERT INTO collaboration.document_versions (
          id, document_id, version_number, title, content, changes_summary, author_id, created_at
        ) VALUES ($1, $2, 1, $3, $4, 'Initial version', $5, NOW())
      `, [require('uuid').v4(), documentId, title, content, userId]);
      
      // Record analytics
      if (analytics) {
        await analytics.recordMetric({
          workspaceId,
          documentId,
          userId,
          metricType: 'document_views',
          value: 1,
          dimensions: { documentType, isTemplate }
        });
      }
      
      res.status(201).json({ 
        message: 'Document created successfully',
        documentId
      });
    } catch (error) {
      console.error('Error creating document:', error);
      res.status(500).json({ error: 'Failed to create document' });
    }
  }
);

// === COMMENTS & COMMUNICATION ROUTES ===

/**
 * GET /api/collaboration/documents/:documentId/comments
 * Get comments for document
 */
router.get('/documents/:documentId/comments',
  authenticateToken,
  [
    param('documentId').isUUID(),
    query('includeResolved').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;
      const userId = req.user.id;
      const { includeResolved = true, limit = 50, offset = 0 } = req.query;
      
      // Check document access
      const hasAccess = await authService.checkDocumentAccess(userId, documentId, 'read');
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const comments = await communicationService.getDocumentComments(
        documentId,
        includeResolved as boolean
      );
      
      // Apply pagination
      const paginatedComments = comments.slice(
        parseInt(offset as string),
        parseInt(offset as string) + parseInt(limit as string)
      );
      
      res.json({
        comments: paginatedComments,
        total: comments.length,
        hasMore: parseInt(offset as string) + parseInt(limit as string) < comments.length
      });
    } catch (error) {
      console.error('Error getting comments:', error);
      res.status(500).json({ error: 'Failed to get comments' });
    }
  }
);

/**
 * POST /api/collaboration/documents/:documentId/comments
 * Create new comment
 */
router.post('/documents/:documentId/comments',
  authenticateToken,
  [
    param('documentId').isUUID(),
    body('content').isLength({ min: 1, max: 2000 }).trim(),
    body('parentCommentId').optional().isUUID(),
    body('positionData').optional().isObject()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;
      const { content, parentCommentId, positionData } = req.body;
      const userId = req.user.id;
      
      // Check document access
      const hasAccess = await authService.checkDocumentAccess(userId, documentId, 'read');
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const comment = await communicationService.createComment({
        documentId,
        authorId: userId,
        content,
        parentCommentId,
        positionData
      });
      
      res.status(201).json({
        message: 'Comment created successfully',
        comment
      });
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  }
);

/**
 * PUT /api/collaboration/comments/:commentId
 * Update comment
 */
router.put('/comments/:commentId',
  authenticateToken,
  [
    param('commentId').isUUID(),
    body('content').optional().isLength({ min: 1, max: 2000 }).trim(),
    body('resolved').optional().isBoolean()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { commentId } = req.params;
      const { content, resolved } = req.body;
      const userId = req.user.id;
      
      const updatedComment = await communicationService.updateComment(commentId, {
        content,
        resolved,
        resolvedBy: resolved ? userId : undefined
      });
      
      if (!updatedComment) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      res.json({
        message: 'Comment updated successfully',
        comment: updatedComment
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      res.status(500).json({ error: 'Failed to update comment' });
    }
  }
);

// === REVIEW WORKFLOW ROUTES ===

/**
 * GET /api/collaboration/workflows
 * Get review workflows for workspace
 */
router.get('/workflows',
  authenticateToken,
  [
    query('workspaceId').isUUID()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.query;
      const userId = req.user.id;
      
      // Check workspace access
      const hasAccess = await authService.checkWorkspaceAccess(userId, workspaceId as string, 'read');
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const workflows = await reviewService.getWorkspaceWorkflows(workspaceId as string);
      
      res.json({ workflows });
    } catch (error) {
      console.error('Error getting workflows:', error);
      res.status(500).json({ error: 'Failed to get workflows' });
    }
  }
);

/**
 * POST /api/collaboration/workflows
 * Create new review workflow
 */
router.post('/workflows',
  authenticateToken,
  [
    body('workspaceId').isUUID(),
    body('name').isLength({ min: 1, max: 255 }).trim(),
    body('description').optional().isLength({ max: 1000 }),
    body('steps').isArray({ min: 1 }),
    body('settings').isObject()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, name, description, steps, settings } = req.body;
      const userId = req.user.id;
      
      // Check workspace admin access
      const hasAccess = await authService.checkWorkspaceAccess(userId, workspaceId, 'admin');
      if (!hasAccess) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      const workflow = await reviewService.createWorkflow({
        workspaceId,
        name,
        description,
        steps,
        settings,
        createdBy: userId
      });
      
      res.status(201).json({
        message: 'Workflow created successfully',
        workflow
      });
    } catch (error) {
      console.error('Error creating workflow:', error);
      res.status(500).json({ error: 'Failed to create workflow' });
    }
  }
);

/**
 * POST /api/collaboration/documents/:documentId/reviews
 * Start document review
 */
router.post('/documents/:documentId/reviews',
  authenticateToken,
  [
    param('documentId').isUUID(),
    body('workflowId').optional().isUUID(),
    body('customReviewers').optional().isArray(),
    body('dueDate').optional().isISO8601(),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('comments').optional().isLength({ max: 1000 })
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;
      const { workflowId, customReviewers, dueDate, priority = 'medium', comments } = req.body;
      const userId = req.user.id;
      
      // Check document access
      const hasAccess = await authService.checkDocumentAccess(userId, documentId, 'write');
      if (!hasAccess) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      const review = await reviewService.startReview({
        documentId,
        workflowId,
        requestedBy: userId,
        customReviewers,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority,
        comments
      });
      
      res.status(201).json({
        message: 'Review started successfully',
        review
      });
    } catch (error) {
      console.error('Error starting review:', error);
      res.status(500).json({ error: 'Failed to start review' });
    }
  }
);

/**
 * GET /api/collaboration/reviews/assignments
 * Get user's review assignments
 */
router.get('/reviews/assignments',
  authenticateToken,
  [
    query('status').optional().isIn(['pending', 'in_progress', 'completed', 'declined', 'expired'])
  ],
  async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const { status } = req.query;
      
      const assignments = await reviewService.getUserAssignments(
        userId,
        status ? [status as any] : undefined
      );
      
      res.json({ assignments });
    } catch (error) {
      console.error('Error getting assignments:', error);
      res.status(500).json({ error: 'Failed to get assignments' });
    }
  }
);

// === ANALYTICS & METRICS ROUTES ===

/**
 * GET /api/collaboration/analytics/productivity
 * Get productivity metrics
 */
router.get('/analytics/productivity',
  authenticateToken,
  [
    query('workspaceId').optional().isUUID(),
    query('userId').optional().isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, userId: targetUserId, startDate, endDate } = req.query;
      const currentUserId = req.user.id;
      
      // Check permissions
      if (workspaceId) {
        const hasAccess = await authService.checkWorkspaceAccess(currentUserId, workspaceId as string, 'read');
        if (!hasAccess) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
      
      const timeframe = startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : undefined;
      
      const metrics = await analytics.getProductivityMetrics(
        workspaceId as string,
        targetUserId as string,
        timeframe
      );
      
      res.json({ metrics });
    } catch (error) {
      console.error('Error getting productivity metrics:', error);
      res.status(500).json({ error: 'Failed to get productivity metrics' });
    }
  }
);

/**
 * GET /api/collaboration/analytics/patterns
 * Get collaboration patterns
 */
router.get('/analytics/patterns',
  authenticateToken,
  [
    query('workspaceId').isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, startDate, endDate } = req.query;
      const userId = req.user.id;
      
      // Check workspace access
      const hasAccess = await authService.checkWorkspaceAccess(userId, workspaceId as string, 'read');
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const timeframe = startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : undefined;
      
      const patterns = await analytics.detectCollaborationPatterns(
        workspaceId as string,
        timeframe
      );
      
      res.json({ patterns });
    } catch (error) {
      console.error('Error getting collaboration patterns:', error);
      res.status(500).json({ error: 'Failed to get collaboration patterns' });
    }
  }
);

/**
 * GET /api/collaboration/analytics/workspace/:workspaceId/health
 * Get workspace health score
 */
router.get('/analytics/workspace/:workspaceId/health',
  authenticateToken,
  [
    param('workspaceId').isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.params;
      const { startDate, endDate } = req.query;
      const userId = req.user.id;
      
      // Check workspace access
      const hasAccess = await authService.checkWorkspaceAccess(userId, workspaceId, 'read');
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const timeframe = startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : undefined;
      
      const healthScore = await analytics.calculateWorkspaceHealthScore(workspaceId, timeframe);
      
      res.json({ healthScore });
    } catch (error) {
      console.error('Error getting workspace health:', error);
      res.status(500).json({ error: 'Failed to get workspace health' });
    }
  }
);

/**
 * GET /api/collaboration/metrics
 * Get real-time collaboration metrics
 */
router.get('/metrics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const metrics = collaborationService.getMetrics();
    
    res.json({ metrics });
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// === NOTIFICATIONS ROUTES ===

/**
 * GET /api/collaboration/notifications
 * Get user notifications
 */
router.get('/notifications',
  authenticateToken,
  [
    query('read').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    query('types').optional(),
    query('category').optional().isIn(['collaboration', 'system', 'social', 'workflow'])
  ],
  async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const { read, limit = 20, offset = 0, types, category } = req.query;
      
      const notificationTypes = types ? (types as string).split(',') : undefined;
      
      const { notifications, total } = await communicationService.getUserNotifications(userId, {
        read: read !== undefined ? read === 'true' : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        types: notificationTypes as any,
        category: category as any
      });
      
      res.json({
        notifications,
        total,
        hasMore: parseInt(offset as string) + parseInt(limit as string) < total
      });
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({ error: 'Failed to get notifications' });
    }
  }
);

/**
 * PUT /api/collaboration/notifications/read
 * Mark notifications as read
 */
router.put('/notifications/read',
  authenticateToken,
  [
    body('notificationIds').isArray({ min: 1 })
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { notificationIds } = req.body;
      const userId = req.user.id;
      
      const success = await communicationService.markNotificationsRead(notificationIds, userId);
      
      if (success) {
        res.json({ message: 'Notifications marked as read' });
      } else {
        res.status(500).json({ error: 'Failed to mark notifications as read' });
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
  }
);

export default router;