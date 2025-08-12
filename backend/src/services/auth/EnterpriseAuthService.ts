/**
 * Enterprise Authentication Service
 * Handles SSO/SAML authentication, role-based access control, and multi-tenancy
 */

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import saml2 from 'saml2-js';
import { DatabaseConnection } from '../../database/connection';

interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  status: string;
  organizationId?: string;
  permissions: string[];
  roles: string[];
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  ssoEnabled: boolean;
  ssoConfig: any;
  samlConfig: any;
  subscriptionTier: string;
}

interface JWTPayload {
  userId: string;
  organizationId?: string;
  permissions: string[];
  roles: string[];
  iat: number;
  exp: number;
}

interface SAMLResponse {
  user: {
    email: string;
    firstName?: string;
    lastName?: string;
    attributes: Record<string, any>;
  };
}

export class EnterpriseAuthService {
  private db: DatabaseConnection;
  private jwtSecret: string;
  private jwtExpiresIn: string;
  private samlProviders: Map<string, saml2.ServiceProvider> = new Map();

  constructor() {
    this.db = new DatabaseConnection();
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.initializeSAMLProviders();
  }

  /**
   * Initialize SAML providers for organizations
   */
  private async initializeSAMLProviders(): Promise<void> {
    try {
      const orgs = await this.db.query(`
        SELECT id, slug, sso_enabled, saml_config 
        FROM collaboration.organizations 
        WHERE sso_enabled = true AND saml_config IS NOT NULL
      `);

      for (const org of orgs.rows) {
        if (org.saml_config && org.saml_config.entityId) {
          const sp = new saml2.ServiceProvider({
            entity_id: org.saml_config.entityId,
            private_key: org.saml_config.privateKey,
            certificate: org.saml_config.certificate,
            assert_endpoint: `${process.env.BASE_URL}/auth/saml/assert/${org.slug}`,
            force_authn: org.saml_config.forceAuthn || false,
            auth_context: {
              comparison: 'exact',
              class_refs: ['urn:oasis:names:tc:SAML:1.0:am:password']
            },
            nameid_format: org.saml_config.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            sign_get_request: org.saml_config.signGetRequest || false,
            allow_unencrypted_assertion: org.saml_config.allowUnencryptedAssertion || true
          });

          this.samlProviders.set(org.slug, sp);
        }
      }
    } catch (error) {
      console.error('Error initializing SAML providers:', error);
    }
  }

  /**
   * Standard email/password authentication
   */
  public async authenticate(email: string, password: string): Promise<{ user: User; token: string; refreshToken: string } | null> {
    try {
      const result = await this.db.query(`
        SELECT u.*, om.organization_id, om.role as org_role, om.permissions as org_permissions,
               o.name as org_name, o.slug as org_slug
        FROM collaboration.users u
        LEFT JOIN collaboration.organization_memberships om ON u.id = om.user_id
        LEFT JOIN collaboration.organizations o ON om.organization_id = o.id
        WHERE u.email = $1 AND u.status = 'active'
      `, [email]);

      if (result.rows.length === 0) {
        return null;
      }

      const userData = result.rows[0];
      
      // Verify password
      if (!userData.password_hash || !await bcrypt.compare(password, userData.password_hash)) {
        return null;
      }

      // Get user roles and permissions
      const { roles, permissions } = await this.getUserRolesAndPermissions(userData.id, userData.organization_id);

      const user: User = {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
        status: userData.status,
        organizationId: userData.organization_id,
        permissions,
        roles
      };

      // Generate tokens
      const token = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user.id);

      // Update last login
      await this.updateLastLogin(user.id);

      return { user, token, refreshToken };
    } catch (error) {
      console.error('Authentication error:', error);
      return null;
    }
  }

  /**
   * SSO authentication via SAML
   */
  public async authenticateSSO(organizationSlug: string, samlResponse: string): Promise<{ user: User; token: string; refreshToken: string } | null> {
    try {
      const sp = this.samlProviders.get(organizationSlug);
      if (!sp) {
        throw new Error('SAML provider not configured for organization');
      }

      // Get organization
      const orgResult = await this.db.query(`
        SELECT * FROM collaboration.organizations 
        WHERE slug = $1 AND sso_enabled = true
      `, [organizationSlug]);

      if (orgResult.rows.length === 0) {
        throw new Error('Organization not found or SSO not enabled');
      }

      const organization = orgResult.rows[0];
      const identityProvider = new saml2.IdentityProvider(organization.saml_config.idpConfig);

      // Verify SAML response
      return new Promise((resolve, reject) => {
        sp.post_assert(identityProvider, { request_body: samlResponse }, async (err: any, samlResponseData: SAMLResponse) => {
          if (err) {
            reject(err);
            return;
          }

          try {
            // Get or create user
            let user = await this.getUserByEmail(samlResponseData.user.email);
            
            if (!user) {
              // Create new user from SAML response
              user = await this.createUserFromSAML(samlResponseData.user, organization.id);
            } else {
              // Update user if needed
              await this.updateUserFromSAML(user.id, samlResponseData.user, organization.id);
            }

            // Get user roles and permissions
            const { roles, permissions } = await this.getUserRolesAndPermissions(user.id, organization.id);
            user.permissions = permissions;
            user.roles = roles;

            // Generate tokens
            const token = this.generateAccessToken(user);
            const refreshToken = this.generateRefreshToken(user.id);

            // Update last login
            await this.updateLastLogin(user.id);

            resolve({ user, token, refreshToken });
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('SSO authentication error:', error);
      return null;
    }
  }

  /**
   * Generate SAML login URL
   */
  public async getSAMLLoginURL(organizationSlug: string, relayState?: string): Promise<string> {
    const sp = this.samlProviders.get(organizationSlug);
    if (!sp) {
      throw new Error('SAML provider not configured for organization');
    }

    const orgResult = await this.db.query(`
      SELECT saml_config FROM collaboration.organizations 
      WHERE slug = $1 AND sso_enabled = true
    `, [organizationSlug]);

    if (orgResult.rows.length === 0) {
      throw new Error('Organization not found or SSO not enabled');
    }

    const organization = orgResult.rows[0];
    const identityProvider = new saml2.IdentityProvider(organization.saml_config.idpConfig);

    return new Promise((resolve, reject) => {
      sp.create_login_request_url(identityProvider, { relay_state: relayState }, (err: any, loginUrl: string) => {
        if (err) {
          reject(err);
        } else {
          resolve(loginUrl);
        }
      });
    });
  }

  /**
   * Verify JWT token and return user data
   */
  public async verifyToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JWTPayload;
      
      const result = await this.db.query(`
        SELECT u.*, om.organization_id, om.role as org_role
        FROM collaboration.users u
        LEFT JOIN collaboration.organization_memberships om ON u.id = om.user_id
        WHERE u.id = $1 AND u.status = 'active'
      `, [decoded.userId]);

      if (result.rows.length === 0) {
        return null;
      }

      const userData = result.rows[0];
      
      return {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
        status: userData.status,
        organizationId: userData.organization_id,
        permissions: decoded.permissions,
        roles: decoded.roles
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  }

  /**
   * Check if user has specific permission
   */
  public hasPermission(user: User, permission: string): boolean {
    return user.permissions.includes(permission) || user.roles.includes('admin') || user.roles.includes('owner');
  }

  /**
   * Check if user has specific role
   */
  public hasRole(user: User, role: string): boolean {
    return user.roles.includes(role);
  }

  /**
   * Check workspace access
   */
  public async checkWorkspaceAccess(userId: string, workspaceId: string, permission: 'read' | 'write' | 'admin' = 'read'): Promise<boolean> {
    try {
      const result = await this.db.query(`
        SELECT wm.role, wm.permissions
        FROM collaboration.workspace_memberships wm
        WHERE wm.user_id = $1 AND wm.workspace_id = $2
      `, [userId, workspaceId]);

      if (result.rows.length === 0) {
        return false;
      }

      const membership = result.rows[0];
      const rolePermissions = this.getRolePermissions(membership.role);
      const customPermissions = membership.permissions || [];
      const allPermissions = [...rolePermissions, ...customPermissions];

      return this.checkPermissionLevel(allPermissions, permission);
    } catch (error) {
      console.error('Workspace access check error:', error);
      return false;
    }
  }

  /**
   * Check document access
   */
  public async checkDocumentAccess(userId: string, documentId: string, permission: 'read' | 'write' | 'admin' = 'read'): Promise<boolean> {
    try {
      // Check direct document permissions first
      const docPermResult = await this.db.query(`
        SELECT dp.role, dp.permissions
        FROM collaboration.document_permissions dp
        WHERE dp.user_id = $1 AND dp.document_id = $2
      `, [userId, documentId]);

      if (docPermResult.rows.length > 0) {
        const docPerm = docPermResult.rows[0];
        const rolePermissions = this.getRolePermissions(docPerm.role);
        const customPermissions = docPerm.permissions || [];
        const allPermissions = [...rolePermissions, ...customPermissions];
        
        return this.checkPermissionLevel(allPermissions, permission);
      }

      // Check workspace permissions
      const workspaceResult = await this.db.query(`
        SELECT wm.role, wm.permissions
        FROM collaboration.documents d
        JOIN collaboration.workspace_memberships wm ON d.workspace_id = wm.workspace_id
        WHERE d.id = $1 AND wm.user_id = $2
      `, [documentId, userId]);

      if (workspaceResult.rows.length === 0) {
        return false;
      }

      const membership = workspaceResult.rows[0];
      const rolePermissions = this.getRolePermissions(membership.role);
      const customPermissions = membership.permissions || [];
      const allPermissions = [...rolePermissions, ...customPermissions];

      return this.checkPermissionLevel(allPermissions, permission);
    } catch (error) {
      console.error('Document access check error:', error);
      return false;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshAccessToken(refreshToken: string): Promise<{ token: string; refreshToken: string } | null> {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret + '-refresh') as { userId: string };
      
      const result = await this.db.query(`
        SELECT u.*, om.organization_id
        FROM collaboration.users u
        LEFT JOIN collaboration.organization_memberships om ON u.id = om.user_id
        WHERE u.id = $1 AND u.status = 'active'
      `, [decoded.userId]);

      if (result.rows.length === 0) {
        return null;
      }

      const userData = result.rows[0];
      const { roles, permissions } = await this.getUserRolesAndPermissions(userData.id, userData.organization_id);

      const user: User = {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
        status: userData.status,
        organizationId: userData.organization_id,
        permissions,
        roles
      };

      const newToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user.id);

      return { token: newToken, refreshToken: newRefreshToken };
    } catch (error) {
      console.error('Refresh token error:', error);
      return null;
    }
  }

  // Private helper methods

  private async getUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.db.query(`
        SELECT * FROM collaboration.users WHERE email = $1
      `, [email]);

      if (result.rows.length === 0) {
        return null;
      }

      const userData = result.rows[0];
      return {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
        status: userData.status,
        permissions: [],
        roles: []
      };
    } catch (error) {
      console.error('Get user by email error:', error);
      return null;
    }
  }

  private async createUserFromSAML(samlUser: any, organizationId: string): Promise<User> {
    const userId = uuidv4();
    const username = samlUser.email.split('@')[0] + '_' + Math.random().toString(36).substr(2, 5);

    await this.db.query(`
      INSERT INTO collaboration.users (id, email, username, first_name, last_name, email_verified, status)
      VALUES ($1, $2, $3, $4, $5, true, 'active')
    `, [userId, samlUser.email, username, samlUser.firstName, samlUser.lastName]);

    // Add to organization
    await this.db.query(`
      INSERT INTO collaboration.organization_memberships (organization_id, user_id, role, status, joined_at)
      VALUES ($1, $2, 'member', 'active', NOW())
    `, [organizationId, userId]);

    return {
      id: userId,
      email: samlUser.email,
      username,
      firstName: samlUser.firstName,
      lastName: samlUser.lastName,
      status: 'active',
      organizationId,
      permissions: [],
      roles: []
    };
  }

  private async updateUserFromSAML(userId: string, samlUser: any, organizationId: string): Promise<void> {
    await this.db.query(`
      UPDATE collaboration.users 
      SET first_name = $1, last_name = $2, email_verified = true
      WHERE id = $3
    `, [samlUser.firstName, samlUser.lastName, userId]);

    // Ensure user is in organization
    await this.db.query(`
      INSERT INTO collaboration.organization_memberships (organization_id, user_id, role, status, joined_at)
      VALUES ($1, $2, 'member', 'active', NOW())
      ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active'
    `, [organizationId, userId]);
  }

  private async getUserRolesAndPermissions(userId: string, organizationId?: string): Promise<{ roles: string[]; permissions: string[] }> {
    const roles: string[] = [];
    const permissions: string[] = [];

    if (organizationId) {
      const result = await this.db.query(`
        SELECT role, permissions FROM collaboration.organization_memberships
        WHERE user_id = $1 AND organization_id = $2
      `, [userId, organizationId]);

      if (result.rows.length > 0) {
        const membership = result.rows[0];
        roles.push(membership.role);
        if (membership.permissions) {
          permissions.push(...membership.permissions);
        }
      }
    }

    // Add role-based permissions
    for (const role of roles) {
      permissions.push(...this.getRolePermissions(role));
    }

    return {
      roles: [...new Set(roles)],
      permissions: [...new Set(permissions)]
    };
  }

  private getRolePermissions(role: string): string[] {
    const rolePermissions: Record<string, string[]> = {
      'owner': ['*'], // All permissions
      'admin': [
        'workspace:create', 'workspace:read', 'workspace:update', 'workspace:delete',
        'document:create', 'document:read', 'document:update', 'document:delete',
        'user:invite', 'user:remove', 'settings:update'
      ],
      'editor': [
        'workspace:read', 'document:create', 'document:read', 'document:update',
        'comment:create', 'comment:read', 'comment:update'
      ],
      'reviewer': [
        'workspace:read', 'document:read', 'comment:create', 'comment:read',
        'review:create', 'review:update'
      ],
      'viewer': ['workspace:read', 'document:read', 'comment:read'],
      'member': ['workspace:read', 'document:read']
    };

    return rolePermissions[role] || [];
  }

  private checkPermissionLevel(permissions: string[], required: 'read' | 'write' | 'admin'): boolean {
    if (permissions.includes('*')) {
      return true;
    }

    const permissionLevels = {
      'read': ['document:read', 'workspace:read'],
      'write': ['document:update', 'document:create', 'workspace:update'],
      'admin': ['document:delete', 'workspace:delete', 'settings:update']
    };

    return permissionLevels[required].some(perm => permissions.includes(perm));
  }

  private generateAccessToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      organizationId: user.organizationId,
      permissions: user.permissions,
      roles: user.roles,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign({ userId }, this.jwtSecret + '-refresh', { expiresIn: '7d' });
  }

  private async updateLastLogin(userId: string): Promise<void> {
    await this.db.query(`
      UPDATE collaboration.users SET last_login = NOW() WHERE id = $1
    `, [userId]);
  }
}

export default EnterpriseAuthService;