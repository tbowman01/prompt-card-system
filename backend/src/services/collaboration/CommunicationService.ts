/**
 * Communication Service
 * Handles comments, @mentions, notifications, and activity feeds for collaboration
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseConnection } from '../../database/connection';
import { Server } from 'socket.io';
import Redis from 'ioredis';

export interface Comment {
  id: string;
  documentId: string;
  parentCommentId?: string;
  authorId: string;
  content: string;
  positionData?: {
    line?: number;
    character?: number;
    selectionStart?: number;
    selectionEnd?: number;
    context?: string;
  };
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  mentions: string[];
  reactions: Reaction[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  metadata?: Record<string, any>;
}

export interface Reaction {
  id: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

export interface Mention {
  id: string;
  commentId?: string;
  documentId?: string;
  mentionedUserId: string;
  mentionerUserId: string;
  context: string;
  read: boolean;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  data: Record<string, any>;
  read: boolean;
  actionUrl?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'collaboration' | 'system' | 'social' | 'workflow';
  createdAt: Date;
  readAt?: Date;
  expiresAt?: Date;
}

export interface ActivityItem {
  id: string;
  workspaceId?: string;
  documentId?: string;
  userId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  description: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export type NotificationType = 
  | 'comment_mention'
  | 'comment_reply'
  | 'document_shared'
  | 'document_comment'
  | 'review_requested'
  | 'review_completed'
  | 'workspace_invitation'
  | 'system_update'
  | 'deadline_reminder';

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  digest: 'immediate' | 'hourly' | 'daily' | 'weekly' | 'never';
  types: Record<NotificationType, boolean>;
}

export interface ThreadInfo {
  commentId: string;
  totalReplies: number;
  participants: string[];
  lastActivity: Date;
  resolved: boolean;
}

export class CommunicationService extends EventEmitter {
  private db: DatabaseConnection;
  private io: Server;
  private redis: Redis;
  private mentionParser: RegExp;
  private notificationQueue: Map<string, Notification[]> = new Map();

  constructor(io: Server, redisConfig?: any) {
    super();
    this.db = new DatabaseConnection();
    this.io = io;
    this.redis = new Redis(redisConfig || process.env.REDIS_URL);
    this.mentionParser = /@([a-zA-Z0-9._-]+)/g;
    this.setupNotificationProcessing();
  }

  /**
   * Create a new comment
   */
  public async createComment(commentData: {
    documentId: string;
    authorId: string;
    content: string;
    parentCommentId?: string;
    positionData?: Comment['positionData'];
    metadata?: Record<string, any>;
  }): Promise<Comment> {
    const commentId = uuidv4();
    const mentions = this.extractMentions(commentData.content);
    const now = new Date();

    try {
      // Insert comment
      await this.db.query(`
        INSERT INTO collaboration.comments (
          id, document_id, parent_comment_id, author_id, content, 
          position_data, resolved, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8)
      `, [
        commentId,
        commentData.documentId,
        commentData.parentCommentId || null,
        commentData.authorId,
        commentData.content,
        commentData.positionData ? JSON.stringify(commentData.positionData) : null,
        now,
        now
      ]);

      // Process mentions
      const mentionUserIds = await this.processMentions(mentions, commentId, commentData.documentId, commentData.authorId);

      const comment: Comment = {
        id: commentId,
        documentId: commentData.documentId,
        parentCommentId: commentData.parentCommentId,
        authorId: commentData.authorId,
        content: commentData.content,
        positionData: commentData.positionData,
        resolved: false,
        mentions: mentionUserIds,
        reactions: [],
        createdAt: now,
        updatedAt: now,
        metadata: commentData.metadata
      };

      // Create activity log
      await this.createActivityLog({
        workspaceId: await this.getWorkspaceIdForDocument(commentData.documentId),
        documentId: commentData.documentId,
        userId: commentData.authorId,
        action: commentData.parentCommentId ? 'comment_reply' : 'comment_create',
        targetType: 'comment',
        targetId: commentId,
        description: `${commentData.parentCommentId ? 'Replied to comment' : 'Added comment'}`,
        metadata: {
          commentContent: commentData.content.substring(0, 100) + (commentData.content.length > 100 ? '...' : ''),
          mentionCount: mentionUserIds.length
        }
      });

      // Broadcast comment to document participants
      this.io.to(commentData.documentId).emit('comment-created', comment);

      // Send notifications
      await this.sendCommentNotifications(comment);

      return comment;
    } catch (error) {
      console.error('Error creating comment:', error);
      throw error;
    }
  }

  /**
   * Update a comment
   */
  public async updateComment(commentId: string, updates: {
    content?: string;
    positionData?: Comment['positionData'];
    resolved?: boolean;
    resolvedBy?: string;
  }): Promise<Comment | null> {
    try {
      const existingComment = await this.getCommentById(commentId);
      if (!existingComment) {
        return null;
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let valueIndex = 1;

      if (updates.content !== undefined) {
        updateFields.push(`content = $${valueIndex++}`);
        updateValues.push(updates.content);
      }

      if (updates.positionData !== undefined) {
        updateFields.push(`position_data = $${valueIndex++}`);
        updateValues.push(updates.positionData ? JSON.stringify(updates.positionData) : null);
      }

      if (updates.resolved !== undefined) {
        updateFields.push(`resolved = $${valueIndex++}`);
        updateValues.push(updates.resolved);
        
        if (updates.resolved && updates.resolvedBy) {
          updateFields.push(`resolved_by = $${valueIndex++}`, `resolved_at = $${valueIndex++}`);
          updateValues.push(updates.resolvedBy, new Date());
        } else if (!updates.resolved) {
          updateFields.push(`resolved_by = NULL`, `resolved_at = NULL`);
        }
      }

      updateFields.push(`updated_at = $${valueIndex++}`);
      updateValues.push(new Date());
      updateValues.push(commentId);

      await this.db.query(`
        UPDATE collaboration.comments 
        SET ${updateFields.join(', ')}
        WHERE id = $${valueIndex}
      `, updateValues);

      // Process new mentions if content was updated
      if (updates.content !== undefined) {
        const mentions = this.extractMentions(updates.content);
        await this.processMentions(mentions, commentId, existingComment.documentId, existingComment.authorId);
      }

      const updatedComment = await this.getCommentById(commentId);
      if (updatedComment) {
        // Broadcast update
        this.io.to(updatedComment.documentId).emit('comment-updated', updatedComment);
        
        // Create activity log
        await this.createActivityLog({
          workspaceId: await this.getWorkspaceIdForDocument(updatedComment.documentId),
          documentId: updatedComment.documentId,
          userId: existingComment.authorId,
          action: updates.resolved ? 'comment_resolve' : 'comment_update',
          targetType: 'comment',
          targetId: commentId,
          description: updates.resolved ? 'Resolved comment' : 'Updated comment',
          metadata: { resolved: updates.resolved }
        });
      }

      return updatedComment;
    } catch (error) {
      console.error('Error updating comment:', error);
      throw error;
    }
  }

  /**
   * Delete a comment
   */
  public async deleteComment(commentId: string, deletedBy: string): Promise<boolean> {
    try {
      const comment = await this.getCommentById(commentId);
      if (!comment) {
        return false;
      }

      await this.db.query(`
        UPDATE collaboration.comments 
        SET deleted_at = NOW()
        WHERE id = $1
      `, [commentId]);

      // Broadcast deletion
      this.io.to(comment.documentId).emit('comment-deleted', { commentId, deletedBy });

      // Create activity log
      await this.createActivityLog({
        workspaceId: await this.getWorkspaceIdForDocument(comment.documentId),
        documentId: comment.documentId,
        userId: deletedBy,
        action: 'comment_delete',
        targetType: 'comment',
        targetId: commentId,
        description: 'Deleted comment',
        metadata: {}
      });

      return true;
    } catch (error) {
      console.error('Error deleting comment:', error);
      return false;
    }
  }

  /**
   * Add reaction to comment
   */
  public async addReaction(commentId: string, userId: string, emoji: string): Promise<boolean> {
    try {
      const comment = await this.getCommentById(commentId);
      if (!comment) {
        return false;
      }

      // Check if reaction already exists
      const existingReaction = comment.reactions.find(r => r.userId === userId && r.emoji === emoji);
      if (existingReaction) {
        return false;
      }

      const reactionId = uuidv4();
      const reaction: Reaction = {
        id: reactionId,
        userId,
        emoji,
        createdAt: new Date()
      };

      // Store reaction (assuming we add a reactions column or separate table)
      // For now, we'll emit the event and handle it client-side
      
      // Broadcast reaction
      this.io.to(comment.documentId).emit('comment-reaction', {
        commentId,
        reaction
      });

      return true;
    } catch (error) {
      console.error('Error adding reaction:', error);
      return false;
    }
  }

  /**
   * Get comments for document
   */
  public async getDocumentComments(documentId: string, includeResolved: boolean = true): Promise<Comment[]> {
    try {
      let query = `
        SELECT c.*, u.username as author_name, u.first_name, u.last_name, u.avatar_url,
               COUNT(DISTINCT replies.id) as reply_count
        FROM collaboration.comments c
        JOIN collaboration.users u ON c.author_id = u.id
        LEFT JOIN collaboration.comments replies ON c.id = replies.parent_comment_id AND replies.deleted_at IS NULL
        WHERE c.document_id = $1 AND c.deleted_at IS NULL
      `;
      
      const params: any[] = [documentId];
      
      if (!includeResolved) {
        query += ' AND c.resolved = false';
      }
      
      query += ' GROUP BY c.id, u.username, u.first_name, u.last_name, u.avatar_url ORDER BY c.created_at ASC';

      const result = await this.db.query(query, params);
      
      return result.rows.map(row => ({
        id: row.id,
        documentId: row.document_id,
        parentCommentId: row.parent_comment_id,
        authorId: row.author_id,
        content: row.content,
        positionData: row.position_data ? JSON.parse(row.position_data) : undefined,
        resolved: row.resolved,
        resolvedBy: row.resolved_by,
        resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
        mentions: [], // TODO: Load mentions
        reactions: [], // TODO: Load reactions
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        metadata: {
          authorName: row.author_name,
          firstName: row.first_name,
          lastName: row.last_name,
          avatarUrl: row.avatar_url,
          replyCount: parseInt(row.reply_count)
        }
      }));
    } catch (error) {
      console.error('Error getting document comments:', error);
      return [];
    }
  }

  /**
   * Get thread for comment
   */
  public async getCommentThread(parentCommentId: string): Promise<Comment[]> {
    try {
      const result = await this.db.query(`
        SELECT c.*, u.username as author_name, u.first_name, u.last_name, u.avatar_url
        FROM collaboration.comments c
        JOIN collaboration.users u ON c.author_id = u.id
        WHERE (c.id = $1 OR c.parent_comment_id = $1) AND c.deleted_at IS NULL
        ORDER BY c.created_at ASC
      `, [parentCommentId]);

      return result.rows.map(row => ({
        id: row.id,
        documentId: row.document_id,
        parentCommentId: row.parent_comment_id,
        authorId: row.author_id,
        content: row.content,
        positionData: row.position_data ? JSON.parse(row.position_data) : undefined,
        resolved: row.resolved,
        resolvedBy: row.resolved_by,
        resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
        mentions: [],
        reactions: [],
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        metadata: {
          authorName: row.author_name,
          firstName: row.first_name,
          lastName: row.last_name,
          avatarUrl: row.avatar_url
        }
      }));
    } catch (error) {
      console.error('Error getting comment thread:', error);
      return [];
    }
  }

  /**
   * Create notification
   */
  public async createNotification(notificationData: {
    userId: string;
    type: NotificationType;
    title: string;
    content: string;
    data?: Record<string, any>;
    actionUrl?: string;
    priority?: Notification['priority'];
    category?: Notification['category'];
    expiresAt?: Date;
  }): Promise<Notification> {
    const notificationId = uuidv4();
    const now = new Date();

    const notification: Notification = {
      id: notificationId,
      userId: notificationData.userId,
      type: notificationData.type,
      title: notificationData.title,
      content: notificationData.content,
      data: notificationData.data || {},
      read: false,
      actionUrl: notificationData.actionUrl,
      priority: notificationData.priority || 'medium',
      category: notificationData.category || 'collaboration',
      createdAt: now,
      expiresAt: notificationData.expiresAt
    };

    try {
      await this.db.query(`
        INSERT INTO collaboration.notifications (
          id, user_id, type, title, content, data, read, 
          action_url, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        notificationId,
        notification.userId,
        notification.type,
        notification.title,
        notification.content,
        JSON.stringify(notification.data),
        notification.read,
        notification.actionUrl,
        notification.createdAt
      ]);

      // Queue for delivery
      this.queueNotification(notification);

      // Emit real-time notification
      this.io.to(`user:${notification.userId}`).emit('notification', notification);

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get user notifications
   */
  public async getUserNotifications(userId: string, options?: {
    read?: boolean;
    limit?: number;
    offset?: number;
    types?: NotificationType[];
    category?: Notification['category'];
  }): Promise<{ notifications: Notification[]; total: number }> {
    try {
      let query = `
        SELECT * FROM collaboration.notifications 
        WHERE user_id = $1
      `;
      
      const params: any[] = [userId];
      let paramIndex = 2;

      if (options?.read !== undefined) {
        query += ` AND read = $${paramIndex++}`;
        params.push(options.read);
      }

      if (options?.types && options.types.length > 0) {
        query += ` AND type = ANY($${paramIndex++})`;
        params.push(options.types);
      }

      if (options?.category) {
        query += ` AND data->>'category' = $${paramIndex++}`;
        params.push(options.category);
      }

      // Get total count
      const countResult = await this.db.query(
        `SELECT COUNT(*) as total FROM (${query}) as count_query`,
        params
      );
      const total = parseInt(countResult.rows[0].total);

      // Add pagination
      query += ` ORDER BY created_at DESC`;
      
      if (options?.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(options.limit);
      }

      if (options?.offset) {
        query += ` OFFSET $${paramIndex++}`;
        params.push(options.offset);
      }

      const result = await this.db.query(query, params);
      
      const notifications: Notification[] = result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        type: row.type,
        title: row.title,
        content: row.content,
        data: JSON.parse(row.data || '{}'),
        read: row.read,
        actionUrl: row.action_url,
        priority: row.priority || 'medium',
        category: row.category || 'collaboration',
        createdAt: new Date(row.created_at),
        readAt: row.read_at ? new Date(row.read_at) : undefined
      }));

      return { notifications, total };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      return { notifications: [], total: 0 };
    }
  }

  /**
   * Mark notifications as read
   */
  public async markNotificationsRead(notificationIds: string[], userId: string): Promise<boolean> {
    try {
      await this.db.query(`
        UPDATE collaboration.notifications 
        SET read = true, read_at = NOW()
        WHERE id = ANY($1) AND user_id = $2
      `, [notificationIds, userId]);

      // Emit update
      this.io.to(`user:${userId}`).emit('notifications-read', notificationIds);

      return true;
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      return false;
    }
  }

  /**
   * Get workspace activity feed
   */
  public async getWorkspaceActivity(workspaceId: string, options?: {
    limit?: number;
    offset?: number;
    userId?: string;
    actions?: string[];
  }): Promise<{ activities: ActivityItem[]; total: number }> {
    try {
      let query = `
        SELECT a.*, u.username, u.first_name, u.last_name, u.avatar_url,
               d.title as document_title
        FROM collaboration.activity_logs a
        JOIN collaboration.users u ON a.user_id = u.id
        LEFT JOIN collaboration.documents d ON a.document_id = d.id
        WHERE a.workspace_id = $1
      `;
      
      const params: any[] = [workspaceId];
      let paramIndex = 2;

      if (options?.userId) {
        query += ` AND a.user_id = $${paramIndex++}`;
        params.push(options.userId);
      }

      if (options?.actions && options.actions.length > 0) {
        query += ` AND a.action = ANY($${paramIndex++})`;
        params.push(options.actions);
      }

      // Get total count
      const countResult = await this.db.query(
        `SELECT COUNT(*) as total FROM (${query}) as count_query`,
        params
      );
      const total = parseInt(countResult.rows[0].total);

      // Add pagination
      query += ` ORDER BY a.created_at DESC`;
      
      if (options?.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(options.limit);
      }

      if (options?.offset) {
        query += ` OFFSET $${paramIndex++}`;
        params.push(options.offset);
      }

      const result = await this.db.query(query, params);
      
      const activities: ActivityItem[] = result.rows.map(row => ({
        id: row.id,
        workspaceId: row.workspace_id,
        documentId: row.document_id,
        userId: row.user_id,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        description: row.description,
        metadata: {
          ...JSON.parse(row.metadata || '{}'),
          username: row.username,
          firstName: row.first_name,
          lastName: row.last_name,
          avatarUrl: row.avatar_url,
          documentTitle: row.document_title
        },
        createdAt: new Date(row.created_at)
      }));

      return { activities, total };
    } catch (error) {
      console.error('Error getting workspace activity:', error);
      return { activities: [], total: 0 };
    }
  }

  // Private helper methods

  private async getCommentById(commentId: string): Promise<Comment | null> {
    try {
      const result = await this.db.query(`
        SELECT * FROM collaboration.comments WHERE id = $1 AND deleted_at IS NULL
      `, [commentId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        documentId: row.document_id,
        parentCommentId: row.parent_comment_id,
        authorId: row.author_id,
        content: row.content,
        positionData: row.position_data ? JSON.parse(row.position_data) : undefined,
        resolved: row.resolved,
        resolvedBy: row.resolved_by,
        resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
        mentions: [],
        reactions: [],
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } catch (error) {
      console.error('Error getting comment by id:', error);
      return null;
    }
  }

  private extractMentions(content: string): string[] {
    const matches = content.match(this.mentionParser);
    return matches ? matches.map(match => match.substring(1)) : [];
  }

  private async processMentions(mentions: string[], commentId: string, documentId: string, mentionerUserId: string): Promise<string[]> {
    const mentionedUserIds: string[] = [];

    for (const mention of mentions) {
      // Find user by username
      const result = await this.db.query(`
        SELECT id FROM collaboration.users WHERE username = $1 AND status = 'active'
      `, [mention]);

      if (result.rows.length > 0) {
        const mentionedUserId = result.rows[0].id;
        mentionedUserIds.push(mentionedUserId);

        // Create mention record
        await this.db.query(`
          INSERT INTO collaboration.mentions (id, comment_id, document_id, mentioned_user_id, mentioner_user_id, context, read, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, false, NOW())
        `, [
          uuidv4(),
          commentId,
          documentId,
          mentionedUserId,
          mentionerUserId,
          `Mentioned in comment`
        ]);

        // Create mention notification
        await this.createNotification({
          userId: mentionedUserId,
          type: 'comment_mention',
          title: 'You were mentioned',
          content: `You were mentioned in a comment`,
          data: {
            commentId,
            documentId,
            mentionerUserId
          },
          priority: 'high',
          category: 'collaboration'
        });
      }
    }

    return mentionedUserIds;
  }

  private async sendCommentNotifications(comment: Comment): Promise<void> {
    // Notify document collaborators (except the comment author)
    const collaborators = await this.getDocumentCollaborators(comment.documentId);
    
    for (const collaborator of collaborators) {
      if (collaborator.userId !== comment.authorId) {
        await this.createNotification({
          userId: collaborator.userId,
          type: comment.parentCommentId ? 'comment_reply' : 'document_comment',
          title: comment.parentCommentId ? 'New reply' : 'New comment',
          content: `${collaborator.username} ${comment.parentCommentId ? 'replied to' : 'commented on'} the document`,
          data: {
            commentId: comment.id,
            documentId: comment.documentId,
            authorId: comment.authorId,
            parentCommentId: comment.parentCommentId
          },
          priority: 'medium',
          category: 'collaboration'
        });
      }
    }
  }

  private async getDocumentCollaborators(documentId: string): Promise<Array<{ userId: string; username: string }>> {
    try {
      const result = await this.db.query(`
        SELECT DISTINCT u.id as user_id, u.username
        FROM collaboration.documents d
        JOIN collaboration.workspaces w ON d.workspace_id = w.id
        JOIN collaboration.workspace_memberships wm ON w.id = wm.workspace_id
        JOIN collaboration.users u ON wm.user_id = u.id
        WHERE d.id = $1 AND u.status = 'active'
      `, [documentId]);

      return result.rows.map(row => ({
        userId: row.user_id,
        username: row.username
      }));
    } catch (error) {
      console.error('Error getting document collaborators:', error);
      return [];
    }
  }

  private async getWorkspaceIdForDocument(documentId: string): Promise<string | undefined> {
    try {
      const result = await this.db.query(`
        SELECT workspace_id FROM collaboration.documents WHERE id = $1
      `, [documentId]);
      
      return result.rows[0]?.workspace_id;
    } catch (error) {
      console.error('Error getting workspace id for document:', error);
      return undefined;
    }
  }

  private async createActivityLog(activityData: {
    workspaceId?: string;
    documentId?: string;
    userId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    description: string;
    metadata: Record<string, any>;
  }): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO collaboration.activity_logs (
          id, workspace_id, document_id, user_id, action, 
          target_type, target_id, description, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        uuidv4(),
        activityData.workspaceId,
        activityData.documentId,
        activityData.userId,
        activityData.action,
        activityData.targetType,
        activityData.targetId,
        activityData.description,
        JSON.stringify(activityData.metadata)
      ]);
    } catch (error) {
      console.error('Error creating activity log:', error);
    }
  }

  private queueNotification(notification: Notification): void {
    const userQueue = this.notificationQueue.get(notification.userId) || [];
    userQueue.push(notification);
    this.notificationQueue.set(notification.userId, userQueue);
  }

  private setupNotificationProcessing(): void {
    // Process notification queue every 10 seconds
    setInterval(() => {
      this.processNotificationQueue();
    }, 10000);
  }

  private async processNotificationQueue(): Promise<void> {
    for (const [userId, notifications] of this.notificationQueue.entries()) {
      if (notifications.length > 0) {
        // Process external notifications (email, push, etc.)
        // This would integrate with external services
        
        // Clear processed notifications
        this.notificationQueue.set(userId, []);
      }
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    await this.redis.quit();
    this.notificationQueue.clear();
  }
}

export default CommunicationService;