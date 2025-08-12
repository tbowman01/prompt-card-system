/**
 * Review Workflow Service
 * Handles document review processes, approval chains, and version control
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseConnection } from '../../database/connection';
import { Server } from 'socket.io';
import CommunicationService from './CommunicationService';

export interface ReviewWorkflow {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  steps: ReviewStep[];
  settings: WorkflowSettings;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewStep {
  stepNumber: number;
  name: string;
  description?: string;
  reviewers: ReviewerConfig[];
  approvalMode: 'any' | 'all' | 'majority';
  requiredApprovals: number;
  autoAssign: boolean;
  timeoutHours?: number;
  skipConditions?: SkipCondition[];
  metadata?: Record<string, any>;
}

export interface ReviewerConfig {
  type: 'user' | 'role' | 'group';
  identifier: string;
  isOptional: boolean;
  weight: number;
}

export interface WorkflowSettings {
  autoStart: boolean;
  parallelSteps: boolean;
  allowSelfReview: boolean;
  requireComments: boolean;
  notifyOnStart: boolean;
  notifyOnComplete: boolean;
  emailNotifications: boolean;
  deadlineEnforcement: 'none' | 'warning' | 'strict';
  branchingEnabled: boolean;
  versionControl: VersionControlSettings;
}

export interface VersionControlSettings {
  createBranches: boolean;
  branchNaming: string;
  autoMerge: boolean;
  conflictResolution: 'manual' | 'auto' | 'reviewer';
  preserveHistory: boolean;
}

export interface SkipCondition {
  type: 'document_type' | 'author_role' | 'change_size' | 'custom';
  condition: string;
  value: any;
}

export interface DocumentReview {
  id: string;
  documentId: string;
  documentVersionId?: string;
  workflowId?: string;
  currentStep: number;
  status: ReviewStatus;
  requestedBy: string;
  createdAt: Date;
  completedAt?: Date;
  metadata: {
    totalSteps: number;
    completedSteps: number;
    pendingReviewers: string[];
    changes?: DocumentChange[];
    branchId?: string;
  };
}

export interface ReviewAssignment {
  id: string;
  reviewId: string;
  assigneeId: string;
  stepNumber: number;
  status: AssignmentStatus;
  decision?: ReviewDecision;
  feedback?: string;
  timeSpent?: number;
  assignedAt: Date;
  completedAt?: Date;
  dueDate?: Date;
  reminders: ReminderLog[];
}

export interface DocumentChange {
  id: string;
  type: 'content' | 'metadata' | 'permissions';
  field: string;
  oldValue: any;
  newValue: any;
  author: string;
  timestamp: Date;
  description?: string;
}

export interface ReminderLog {
  sentAt: Date;
  type: 'deadline' | 'overdue' | 'escalation';
  method: 'email' | 'notification' | 'slack';
}

export type ReviewStatus = 'draft' | 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled' | 'escalated';
export type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'declined' | 'expired';
export type ReviewDecision = 'approve' | 'reject' | 'request_changes' | 'abstain';

export interface ReviewMetrics {
  averageReviewTime: number;
  approvalRate: number;
  rejectionRate: number;
  escalationRate: number;
  reviewerWorkload: Map<string, number>;
  bottleneckSteps: number[];
  timeToApproval: number;
  reviewQuality: number;
}

export class ReviewWorkflowService extends EventEmitter {
  private db: DatabaseConnection;
  private io: Server;
  private communicationService: CommunicationService;
  private activeReviews: Map<string, DocumentReview> = new Map();
  private workflowTemplates: Map<string, ReviewWorkflow> = new Map();

  constructor(io: Server, communicationService: CommunicationService) {
    super();
    this.db = new DatabaseConnection();
    this.io = io;
    this.communicationService = communicationService;
    this.loadWorkflowTemplates();
    this.startReminderScheduler();
  }

  /**
   * Create a new review workflow
   */
  public async createWorkflow(workflowData: {
    workspaceId: string;
    name: string;
    description: string;
    steps: ReviewStep[];
    settings: WorkflowSettings;
    createdBy: string;
  }): Promise<ReviewWorkflow> {
    const workflowId = uuidv4();
    const now = new Date();

    const workflow: ReviewWorkflow = {
      id: workflowId,
      workspaceId: workflowData.workspaceId,
      name: workflowData.name,
      description: workflowData.description,
      steps: workflowData.steps,
      settings: workflowData.settings,
      isActive: true,
      createdBy: workflowData.createdBy,
      createdAt: now,
      updatedAt: now
    };

    try {
      await this.db.query(`
        INSERT INTO collaboration.review_workflows (
          id, workspace_id, name, description, steps, settings, is_active, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        workflowId,
        workflow.workspaceId,
        workflow.name,
        workflow.description,
        JSON.stringify(workflow.steps),
        JSON.stringify(workflow.settings),
        workflow.isActive,
        workflow.createdBy,
        workflow.createdAt,
        workflow.updatedAt
      ]);

      this.workflowTemplates.set(workflowId, workflow);

      // Emit workflow created event
      this.emit('workflow-created', workflow);

      return workflow;
    } catch (error) {
      console.error('Error creating workflow:', error);
      throw error;
    }
  }

  /**
   * Start a document review
   */
  public async startReview(reviewData: {
    documentId: string;
    workflowId?: string;
    requestedBy: string;
    customReviewers?: ReviewerConfig[];
    dueDate?: Date;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    comments?: string;
  }): Promise<DocumentReview> {
    const reviewId = uuidv4();
    const now = new Date();

    try {
      // Get document information
      const documentResult = await this.db.query(`
        SELECT d.*, dv.version_number, dv.content
        FROM collaboration.documents d
        LEFT JOIN collaboration.document_versions dv ON d.id = dv.document_id
        WHERE d.id = $1
        ORDER BY dv.version_number DESC
        LIMIT 1
      `, [reviewData.documentId]);

      if (documentResult.rows.length === 0) {
        throw new Error('Document not found');
      }

      const document = documentResult.rows[0];
      let workflow: ReviewWorkflow | undefined;

      if (reviewData.workflowId) {
        workflow = this.workflowTemplates.get(reviewData.workflowId);
        if (!workflow) {
          const workflowResult = await this.getWorkflowById(reviewData.workflowId);
          workflow = workflowResult;
        }
      }

      // Create version snapshot for review
      const versionId = await this.createVersionSnapshot(reviewData.documentId, document.version + 1, reviewData.requestedBy);

      // Create review record
      const review: DocumentReview = {
        id: reviewId,
        documentId: reviewData.documentId,
        documentVersionId: versionId,
        workflowId: reviewData.workflowId,
        currentStep: 1,
        status: 'pending',
        requestedBy: reviewData.requestedBy,
        createdAt: now,
        metadata: {
          totalSteps: workflow?.steps.length || 1,
          completedSteps: 0,
          pendingReviewers: [],
          changes: []
        }
      };

      await this.db.query(`
        INSERT INTO collaboration.document_reviews (
          id, document_id, document_version_id, workflow_id, current_step, status, requested_by, created_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        reviewId,
        review.documentId,
        review.documentVersionId,
        review.workflowId,
        review.currentStep,
        review.status,
        review.requestedBy,
        review.createdAt,
        JSON.stringify(review.metadata)
      ]);

      // Assign reviewers for first step
      await this.assignReviewersForStep(review, workflow?.steps[0] || this.createDefaultStep(reviewData.customReviewers));

      this.activeReviews.set(reviewId, review);

      // Send notifications
      await this.sendReviewStartNotifications(review, workflow);

      // Emit review started event
      this.emit('review-started', review);

      return review;
    } catch (error) {
      console.error('Error starting review:', error);
      throw error;
    }
  }

  /**
   * Submit review decision
   */
  public async submitReview(assignmentId: string, decision: {
    decision: ReviewDecision;
    feedback?: string;
    timeSpent?: number;
    suggestions?: DocumentChange[];
  }): Promise<boolean> {
    try {
      // Get assignment
      const assignmentResult = await this.db.query(`
        SELECT ra.*, dr.id as review_id, dr.document_id, dr.workflow_id, dr.current_step
        FROM collaboration.review_assignments ra
        JOIN collaboration.document_reviews dr ON ra.review_id = dr.id
        WHERE ra.id = $1 AND ra.status = 'pending'
      `, [assignmentId]);

      if (assignmentResult.rows.length === 0) {
        return false;
      }

      const assignment = assignmentResult.rows[0];
      const reviewId = assignment.review_id;
      const now = new Date();

      // Update assignment
      await this.db.query(`
        UPDATE collaboration.review_assignments
        SET status = 'completed', decision = $1, feedback = $2, time_spent = $3, completed_at = $4
        WHERE id = $5
      `, [
        decision.decision,
        decision.feedback,
        decision.timeSpent,
        now,
        assignmentId
      ]);

      // Get review and check if step is complete
      const review = await this.getReviewById(reviewId);
      if (!review) {
        return false;
      }

      const stepComplete = await this.checkStepCompletion(review, assignment.step_number);
      
      if (stepComplete) {
        await this.processStepCompletion(review, assignment.step_number, decision.decision);
      }

      // Create activity log
      await this.communicationService.createNotification({
        userId: review.requestedBy,
        type: 'review_completed',
        title: 'Review decision submitted',
        content: `A reviewer has submitted their decision: ${decision.decision}`,
        data: {
          reviewId,
          documentId: review.documentId,
          decision: decision.decision,
          assignmentId
        },
        priority: decision.decision === 'reject' ? 'high' : 'medium',
        category: 'workflow'
      });

      // Emit review decision event
      this.emit('review-decision', {
        reviewId,
        assignmentId,
        decision: decision.decision,
        feedback: decision.feedback
      });

      return true;
    } catch (error) {
      console.error('Error submitting review:', error);
      return false;
    }
  }

  /**
   * Get review by ID
   */
  public async getReviewById(reviewId: string): Promise<DocumentReview | null> {
    try {
      // Check cache first
      const cached = this.activeReviews.get(reviewId);
      if (cached) {
        return cached;
      }

      const result = await this.db.query(`
        SELECT * FROM collaboration.document_reviews WHERE id = $1
      `, [reviewId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const review: DocumentReview = {
        id: row.id,
        documentId: row.document_id,
        documentVersionId: row.document_version_id,
        workflowId: row.workflow_id,
        currentStep: row.current_step,
        status: row.status,
        requestedBy: row.requested_by,
        createdAt: new Date(row.created_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
        metadata: JSON.parse(row.metadata || '{}')
      };

      return review;
    } catch (error) {
      console.error('Error getting review by id:', error);
      return null;
    }
  }

  /**
   * Get reviews for document
   */
  public async getDocumentReviews(documentId: string, status?: ReviewStatus[]): Promise<DocumentReview[]> {
    try {
      let query = `
        SELECT dr.*, u.username as requester_name, u.first_name, u.last_name
        FROM collaboration.document_reviews dr
        JOIN collaboration.users u ON dr.requested_by = u.id
        WHERE dr.document_id = $1
      `;
      
      const params: any[] = [documentId];
      
      if (status && status.length > 0) {
        query += ` AND dr.status = ANY($2)`;
        params.push(status);
      }
      
      query += ` ORDER BY dr.created_at DESC`;

      const result = await this.db.query(query, params);
      
      return result.rows.map(row => ({
        id: row.id,
        documentId: row.document_id,
        documentVersionId: row.document_version_id,
        workflowId: row.workflow_id,
        currentStep: row.current_step,
        status: row.status,
        requestedBy: row.requested_by,
        createdAt: new Date(row.created_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
        metadata: {
          ...JSON.parse(row.metadata || '{}'),
          requesterName: row.requester_name,
          firstName: row.first_name,
          lastName: row.last_name
        }
      }));
    } catch (error) {
      console.error('Error getting document reviews:', error);
      return [];
    }
  }

  /**
   * Get user's assigned reviews
   */
  public async getUserAssignments(userId: string, status?: AssignmentStatus[]): Promise<ReviewAssignment[]> {
    try {
      let query = `
        SELECT ra.*, dr.document_id, d.title as document_title, u.username as requester_name
        FROM collaboration.review_assignments ra
        JOIN collaboration.document_reviews dr ON ra.review_id = dr.id
        JOIN collaboration.documents d ON dr.document_id = d.id
        JOIN collaboration.users u ON dr.requested_by = u.id
        WHERE ra.assignee_id = $1
      `;
      
      const params: any[] = [userId];
      
      if (status && status.length > 0) {
        query += ` AND ra.status = ANY($2)`;
        params.push(status);
      }
      
      query += ` ORDER BY ra.assigned_at DESC`;

      const result = await this.db.query(query, params);
      
      return result.rows.map(row => ({
        id: row.id,
        reviewId: row.review_id,
        assigneeId: row.assignee_id,
        stepNumber: row.step_number,
        status: row.status,
        decision: row.decision,
        feedback: row.feedback,
        timeSpent: row.time_spent,
        assignedAt: new Date(row.assigned_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
        dueDate: row.due_date ? new Date(row.due_date) : undefined,
        reminders: [] // TODO: Load reminders
      }));
    } catch (error) {
      console.error('Error getting user assignments:', error);
      return [];
    }
  }

  /**
   * Get workflow templates for workspace
   */
  public async getWorkspaceWorkflows(workspaceId: string): Promise<ReviewWorkflow[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM collaboration.review_workflows 
        WHERE workspace_id = $1 AND is_active = true
        ORDER BY name
      `, [workspaceId]);
      
      return result.rows.map(row => ({
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        description: row.description,
        steps: JSON.parse(row.steps),
        settings: JSON.parse(row.settings),
        isActive: row.is_active,
        createdBy: row.created_by,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } catch (error) {
      console.error('Error getting workspace workflows:', error);
      return [];
    }
  }

  /**
   * Generate review metrics
   */
  public async getReviewMetrics(workspaceId: string, dateRange?: { start: Date; end: Date }): Promise<ReviewMetrics> {
    try {
      let query = `
        SELECT 
          dr.status,
          ra.decision,
          ra.assignee_id,
          ra.time_spent,
          ra.step_number,
          EXTRACT(EPOCH FROM (ra.completed_at - ra.assigned_at)) / 3600 as review_hours,
          EXTRACT(EPOCH FROM (dr.completed_at - dr.created_at)) / 3600 as total_hours
        FROM collaboration.document_reviews dr
        JOIN collaboration.documents d ON dr.document_id = d.id
        JOIN collaboration.review_assignments ra ON dr.id = ra.review_id
        WHERE d.workspace_id = $1
      `;
      
      const params: any[] = [workspaceId];
      
      if (dateRange) {
        query += ` AND dr.created_at >= $2 AND dr.created_at <= $3`;
        params.push(dateRange.start, dateRange.end);
      }

      const result = await this.db.query(query, params);
      const data = result.rows;

      const metrics: ReviewMetrics = {
        averageReviewTime: 0,
        approvalRate: 0,
        rejectionRate: 0,
        escalationRate: 0,
        reviewerWorkload: new Map(),
        bottleneckSteps: [],
        timeToApproval: 0,
        reviewQuality: 0
      };

      if (data.length === 0) {
        return metrics;
      }

      // Calculate metrics
      const completedReviews = data.filter(d => d.review_hours > 0);
      metrics.averageReviewTime = completedReviews.reduce((sum, d) => sum + d.review_hours, 0) / completedReviews.length;
      
      const approvedCount = data.filter(d => d.decision === 'approve').length;
      const rejectedCount = data.filter(d => d.decision === 'reject').length;
      const escalatedCount = data.filter(d => d.status === 'escalated').length;
      
      const totalDecisions = approvedCount + rejectedCount;
      if (totalDecisions > 0) {
        metrics.approvalRate = approvedCount / totalDecisions;
        metrics.rejectionRate = rejectedCount / totalDecisions;
      }
      
      metrics.escalationRate = escalatedCount / data.length;
      
      // Calculate reviewer workload
      const workloadMap = new Map<string, number>();
      data.forEach(d => {
        if (d.assignee_id) {
          workloadMap.set(d.assignee_id, (workloadMap.get(d.assignee_id) || 0) + 1);
        }
      });
      metrics.reviewerWorkload = workloadMap;
      
      // Find bottleneck steps
      const stepTimes = new Map<number, number[]>();
      data.forEach(d => {
        if (d.step_number && d.review_hours > 0) {
          const times = stepTimes.get(d.step_number) || [];
          times.push(d.review_hours);
          stepTimes.set(d.step_number, times);
        }
      });
      
      const stepAverages = new Map<number, number>();
      for (const [step, times] of stepTimes.entries()) {
        const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
        stepAverages.set(step, avg);
      }
      
      const avgTime = Array.from(stepAverages.values()).reduce((sum, avg) => sum + avg, 0) / stepAverages.size;
      metrics.bottleneckSteps = Array.from(stepAverages.entries())
        .filter(([, time]) => time > avgTime * 1.5)
        .map(([step]) => step);
      
      // Calculate time to approval
      const approvedReviews = data.filter(d => d.status === 'approved' && d.total_hours > 0);
      if (approvedReviews.length > 0) {
        metrics.timeToApproval = approvedReviews.reduce((sum, d) => sum + d.total_hours, 0) / approvedReviews.length;
      }
      
      // Review quality (based on feedback length, change requests, etc.)
      const qualityIndicators = data.filter(d => d.decision === 'request_changes' || (d.feedback && d.feedback.length > 50));
      metrics.reviewQuality = qualityIndicators.length / data.length;

      return metrics;
    } catch (error) {
      console.error('Error getting review metrics:', error);
      return {
        averageReviewTime: 0,
        approvalRate: 0,
        rejectionRate: 0,
        escalationRate: 0,
        reviewerWorkload: new Map(),
        bottleneckSteps: [],
        timeToApproval: 0,
        reviewQuality: 0
      };
    }
  }

  // Private helper methods

  private async loadWorkflowTemplates(): Promise<void> {
    try {
      const result = await this.db.query(`
        SELECT * FROM collaboration.review_workflows WHERE is_active = true
      `);
      
      for (const row of result.rows) {
        const workflow: ReviewWorkflow = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          description: row.description,
          steps: JSON.parse(row.steps),
          settings: JSON.parse(row.settings),
          isActive: row.is_active,
          createdBy: row.created_by,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        };
        
        this.workflowTemplates.set(workflow.id, workflow);
      }
    } catch (error) {
      console.error('Error loading workflow templates:', error);
    }
  }

  private async getWorkflowById(workflowId: string): Promise<ReviewWorkflow | undefined> {
    try {
      const result = await this.db.query(`
        SELECT * FROM collaboration.review_workflows WHERE id = $1
      `, [workflowId]);
      
      if (result.rows.length === 0) {
        return undefined;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        description: row.description,
        steps: JSON.parse(row.steps),
        settings: JSON.parse(row.settings),
        isActive: row.is_active,
        createdBy: row.created_by,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } catch (error) {
      console.error('Error getting workflow by id:', error);
      return undefined;
    }
  }

  private async createVersionSnapshot(documentId: string, versionNumber: number, authorId: string): Promise<string> {
    try {
      // Get current document content
      const docResult = await this.db.query(`
        SELECT title, content FROM collaboration.documents WHERE id = $1
      `, [documentId]);
      
      if (docResult.rows.length === 0) {
        throw new Error('Document not found');
      }
      
      const doc = docResult.rows[0];
      const versionId = uuidv4();
      
      await this.db.query(`
        INSERT INTO collaboration.document_versions (
          id, document_id, version_number, title, content, changes_summary, author_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        versionId,
        documentId,
        versionNumber,
        doc.title,
        doc.content,
        'Review version snapshot',
        authorId
      ]);
      
      return versionId;
    } catch (error) {
      console.error('Error creating version snapshot:', error);
      throw error;
    }
  }

  private createDefaultStep(customReviewers?: ReviewerConfig[]): ReviewStep {
    return {
      stepNumber: 1,
      name: 'Review',
      reviewers: customReviewers || [{
        type: 'role',
        identifier: 'editor',
        isOptional: false,
        weight: 1
      }],
      approvalMode: 'any',
      requiredApprovals: 1,
      autoAssign: true
    };
  }

  private async assignReviewersForStep(review: DocumentReview, step: ReviewStep): Promise<void> {
    try {
      for (const reviewerConfig of step.reviewers) {
        const reviewers = await this.resolveReviewers(reviewerConfig, review.documentId);
        
        for (const reviewerId of reviewers) {
          const assignmentId = uuidv4();
          const dueDate = step.timeoutHours ? 
            new Date(Date.now() + step.timeoutHours * 60 * 60 * 1000) : 
            undefined;
          
          await this.db.query(`
            INSERT INTO collaboration.review_assignments (
              id, review_id, assignee_id, step_number, status, assigned_at, due_date
            ) VALUES ($1, $2, $3, $4, 'pending', NOW(), $5)
          `, [
            assignmentId,
            review.id,
            reviewerId,
            step.stepNumber,
            dueDate
          ]);
          
          // Send assignment notification
          await this.communicationService.createNotification({
            userId: reviewerId,
            type: 'review_requested',
            title: 'Review requested',
            content: 'You have been assigned to review a document',
            data: {
              reviewId: review.id,
              documentId: review.documentId,
              assignmentId,
              dueDate
            },
            priority: 'high',
            category: 'workflow'
          });
        }
      }
    } catch (error) {
      console.error('Error assigning reviewers for step:', error);
      throw error;
    }
  }

  private async resolveReviewers(config: ReviewerConfig, documentId: string): Promise<string[]> {
    try {
      switch (config.type) {
        case 'user':
          return [config.identifier];
        
        case 'role':
          // Get users with specific role in the workspace
          const roleResult = await this.db.query(`
            SELECT DISTINCT u.id
            FROM collaboration.documents d
            JOIN collaboration.workspace_memberships wm ON d.workspace_id = wm.workspace_id
            JOIN collaboration.users u ON wm.user_id = u.id
            WHERE d.id = $1 AND wm.role = $2 AND u.status = 'active'
          `, [documentId, config.identifier]);
          
          return roleResult.rows.map(row => row.id);
        
        case 'group':
          // TODO: Implement group resolution
          return [];
        
        default:
          return [];
      }
    } catch (error) {
      console.error('Error resolving reviewers:', error);
      return [];
    }
  }

  private async checkStepCompletion(review: DocumentReview, stepNumber: number): Promise<boolean> {
    try {
      const workflow = review.workflowId ? this.workflowTemplates.get(review.workflowId) : undefined;
      const step = workflow?.steps.find(s => s.stepNumber === stepNumber);
      
      if (!step) {
        return true; // Default to complete if no step definition
      }
      
      const assignmentsResult = await this.db.query(`
        SELECT decision, status FROM collaboration.review_assignments
        WHERE review_id = $1 AND step_number = $2
      `, [review.id, stepNumber]);
      
      const assignments = assignmentsResult.rows;
      const completedAssignments = assignments.filter(a => a.status === 'completed');
      const approvals = completedAssignments.filter(a => a.decision === 'approve');
      const rejections = completedAssignments.filter(a => a.decision === 'reject');
      
      // Check if step requirements are met
      switch (step.approvalMode) {
        case 'any':
          return completedAssignments.length > 0;
        
        case 'all':
          return completedAssignments.length === assignments.length;
        
        case 'majority':
          return approvals.length > assignments.length / 2;
        
        default:
          return approvals.length >= step.requiredApprovals;
      }
    } catch (error) {
      console.error('Error checking step completion:', error);
      return false;
    }
  }

  private async processStepCompletion(review: DocumentReview, stepNumber: number, lastDecision: ReviewDecision): Promise<void> {
    try {
      const workflow = review.workflowId ? this.workflowTemplates.get(review.workflowId) : undefined;
      const isLastStep = !workflow || stepNumber >= workflow.steps.length;
      
      if (lastDecision === 'reject') {
        // Reject the entire review
        await this.db.query(`
          UPDATE collaboration.document_reviews
          SET status = 'rejected', completed_at = NOW()
          WHERE id = $1
        `, [review.id]);
        
        this.emit('review-completed', { ...review, status: 'rejected' });
      } else if (isLastStep) {
        // Approve the review
        await this.db.query(`
          UPDATE collaboration.document_reviews
          SET status = 'approved', completed_at = NOW()
          WHERE id = $1
        `, [review.id]);
        
        this.emit('review-completed', { ...review, status: 'approved' });
      } else {
        // Move to next step
        const nextStep = workflow!.steps[stepNumber]; // stepNumber is 0-indexed after increment
        await this.db.query(`
          UPDATE collaboration.document_reviews
          SET current_step = $1, status = 'in_progress'
          WHERE id = $2
        `, [stepNumber + 1, review.id]);
        
        await this.assignReviewersForStep(review, nextStep);
        
        this.emit('review-step-completed', { ...review, currentStep: stepNumber + 1 });
      }
    } catch (error) {
      console.error('Error processing step completion:', error);
      throw error;
    }
  }

  private async sendReviewStartNotifications(review: DocumentReview, workflow?: ReviewWorkflow): Promise<void> {
    try {
      // Get document collaborators
      const collaboratorsResult = await this.db.query(`
        SELECT DISTINCT u.id, u.username
        FROM collaboration.documents d
        JOIN collaboration.workspace_memberships wm ON d.workspace_id = wm.workspace_id
        JOIN collaboration.users u ON wm.user_id = u.id
        WHERE d.id = $1 AND u.id != $2 AND u.status = 'active'
      `, [review.documentId, review.requestedBy]);
      
      for (const collaborator of collaboratorsResult.rows) {
        await this.communicationService.createNotification({
          userId: collaborator.id,
          type: 'review_requested',
          title: 'Document review started',
          content: `A review has been started for a document${workflow ? ` using ${workflow.name} workflow` : ''}`,
          data: {
            reviewId: review.id,
            documentId: review.documentId,
            workflowName: workflow?.name
          },
          priority: 'medium',
          category: 'workflow'
        });
      }
    } catch (error) {
      console.error('Error sending review start notifications:', error);
    }
  }

  private startReminderScheduler(): void {
    // Check for overdue reviews every hour
    setInterval(async () => {
      await this.processOverdueReviews();
    }, 3600000); // 1 hour
  }

  private async processOverdueReviews(): Promise<void> {
    try {
      const overdueResult = await this.db.query(`
        SELECT ra.id, ra.assignee_id, ra.due_date, dr.document_id, d.title
        FROM collaboration.review_assignments ra
        JOIN collaboration.document_reviews dr ON ra.review_id = dr.id
        JOIN collaboration.documents d ON dr.document_id = d.id
        WHERE ra.status = 'pending' AND ra.due_date < NOW()
      `);
      
      for (const assignment of overdueResult.rows) {
        await this.communicationService.createNotification({
          userId: assignment.assignee_id,
          type: 'deadline_reminder',
          title: 'Review overdue',
          content: `Your review for "${assignment.title}" is overdue`,
          data: {
            assignmentId: assignment.id,
            documentId: assignment.document_id,
            dueDate: assignment.due_date
          },
          priority: 'urgent',
          category: 'workflow'
        });
      }
    } catch (error) {
      console.error('Error processing overdue reviews:', error);
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.activeReviews.clear();
    this.workflowTemplates.clear();
  }
}

export default ReviewWorkflowService;