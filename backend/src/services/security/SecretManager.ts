import { randomBytes, createCipher, createDecipher } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

interface SecretConfig {
  key: string;
  value: string;
  encrypted: boolean;
  rotatable: boolean;
  rotationIntervalMs: number;
  lastRotated: Date;
  expiresAt?: Date;
  metadata: {
    environment: string;
    service: string;
    description?: string;
    tags?: string[];
  };
}

interface SecretRotationHistory {
  secretKey: string;
  oldValue: string;
  newValue: string;
  rotatedAt: Date;
  rotatedBy: string;
  reason: 'automatic' | 'manual' | 'compromised';
}

export class SecretManager extends EventEmitter {
  private secrets = new Map<string, SecretConfig>();
  private rotationHistory: SecretRotationHistory[] = [];
  private encryptionKey: string;
  private rotationIntervals = new Map<string, NodeJS.Timeout>();
  private secretsFilePath: string;
  
  constructor(encryptionKey?: string, secretsFilePath?: string) {
    super();
    this.encryptionKey = encryptionKey || this.generateEncryptionKey();
    this.secretsFilePath = secretsFilePath || path.join(process.cwd(), '.secrets.json');
    this.initializeSecrets();
  }
  
  private generateEncryptionKey(): string {
    return randomBytes(32).toString('hex');
  }
  
  private encrypt(text: string): string {
    const cipher = createCipher('aes256', this.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }
  
  private decrypt(encryptedText: string): string {
    const decipher = createDecipher('aes256', this.encryptionKey);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
  
  private async initializeSecrets(): Promise<void> {
    try {
      // Initialize with default secrets
      await this.initializeDefaultSecrets();
      
      // Load secrets from file if exists
      await this.loadSecretsFromFile();
      
      // Start automatic rotation for rotatable secrets
      this.startAutomaticRotation();
      
      this.emit('initialized', { secretCount: this.secrets.size });
    } catch (error) {
      console.error('Failed to initialize secrets:', error);
      this.emit('error', error);
    }\n  }\n  \n  private async initializeDefaultSecrets(): Promise<void> {\n    const defaultSecrets = [\n      {\n        key: 'JWT_SECRET',\n        value: process.env.JWT_SECRET || this.generateStrongSecret(),\n        rotatable: true,\n        rotationIntervalMs: 30 * 24 * 60 * 60 * 1000, // 30 days\n        metadata: {\n          environment: process.env.NODE_ENV || 'development',\n          service: 'authentication',\n          description: 'JWT signing secret',\n          tags: ['auth', 'jwt']\n        }\n      },\n      {\n        key: 'JWT_REFRESH_SECRET',\n        value: process.env.JWT_REFRESH_SECRET || this.generateStrongSecret(),\n        rotatable: true,\n        rotationIntervalMs: 60 * 24 * 60 * 60 * 1000, // 60 days\n        metadata: {\n          environment: process.env.NODE_ENV || 'development',\n          service: 'authentication',\n          description: 'JWT refresh token secret',\n          tags: ['auth', 'jwt', 'refresh']\n        }\n      },\n      {\n        key: 'DATABASE_ENCRYPTION_KEY',\n        value: process.env.DATABASE_ENCRYPTION_KEY || this.generateStrongSecret(64),\n        rotatable: true,\n        rotationIntervalMs: 90 * 24 * 60 * 60 * 1000, // 90 days\n        metadata: {\n          environment: process.env.NODE_ENV || 'development',\n          service: 'database',\n          description: 'Database field encryption key',\n          tags: ['database', 'encryption']\n        }\n      },\n      {\n        key: 'API_RATE_LIMIT_SECRET',\n        value: process.env.API_RATE_LIMIT_SECRET || this.generateStrongSecret(),\n        rotatable: true,\n        rotationIntervalMs: 7 * 24 * 60 * 60 * 1000, // 7 days\n        metadata: {\n          environment: process.env.NODE_ENV || 'development',\n          service: 'security',\n          description: 'Rate limiting bypass secret',\n          tags: ['security', 'rate-limit']\n        }\n      },\n      {\n        key: 'WEBHOOK_SIGNING_SECRET',\n        value: process.env.WEBHOOK_SIGNING_SECRET || this.generateStrongSecret(),\n        rotatable: true,\n        rotationIntervalMs: 14 * 24 * 60 * 60 * 1000, // 14 days\n        metadata: {\n          environment: process.env.NODE_ENV || 'development',\n          service: 'webhooks',\n          description: 'Webhook payload signing secret',\n          tags: ['webhook', 'signing']\n        }\n      }\n    ];\n    \n    for (const secretConfig of defaultSecrets) {\n      if (!this.secrets.has(secretConfig.key)) {\n        await this.setSecret(\n          secretConfig.key,\n          secretConfig.value,\n          {\n            encrypted: true,\n            rotatable: secretConfig.rotatable,\n            rotationIntervalMs: secretConfig.rotationIntervalMs,\n            metadata: secretConfig.metadata\n          }\n        );\n      }\n    }\n  }\n  \n  private generateStrongSecret(length: number = 64): string {\n    return randomBytes(length).toString('base64url');\n  }\n  \n  public async setSecret(\n    key: string, \n    value: string, \n    options: {\n      encrypted?: boolean;\n      rotatable?: boolean;\n      rotationIntervalMs?: number;\n      expiresAt?: Date;\n      metadata?: {\n        environment: string;\n        service: string;\n        description?: string;\n        tags?: string[];\n      };\n    } = {}\n  ): Promise<void> {\n    const {\n      encrypted = true,\n      rotatable = false,\n      rotationIntervalMs = 30 * 24 * 60 * 60 * 1000, // 30 days default\n      expiresAt,\n      metadata = {\n        environment: process.env.NODE_ENV || 'development',\n        service: 'general'\n      }\n    } = options;\n    \n    const secretConfig: SecretConfig = {\n      key,\n      value: encrypted ? this.encrypt(value) : value,\n      encrypted,\n      rotatable,\n      rotationIntervalMs,\n      lastRotated: new Date(),\n      expiresAt,\n      metadata\n    };\n    \n    this.secrets.set(key, secretConfig);\n    \n    // Setup automatic rotation if enabled\n    if (rotatable) {\n      this.setupSecretRotation(key, rotationIntervalMs);\n    }\n    \n    await this.saveSecretsToFile();\n    \n    this.emit('secretSet', { key, encrypted, rotatable });\n  }\n  \n  public getSecret(key: string): string | undefined {\n    const secretConfig = this.secrets.get(key);\n    \n    if (!secretConfig) {\n      this.emit('secretNotFound', { key });\n      return undefined;\n    }\n    \n    // Check if secret is expired\n    if (secretConfig.expiresAt && secretConfig.expiresAt < new Date()) {\n      this.emit('secretExpired', { key, expiresAt: secretConfig.expiresAt });\n      return undefined;\n    }\n    \n    const value = secretConfig.encrypted \n      ? this.decrypt(secretConfig.value)\n      : secretConfig.value;\n    \n    this.emit('secretAccessed', { key, encrypted: secretConfig.encrypted });\n    \n    return value;\n  }\n  \n  public async rotateSecret(key: string, reason: 'automatic' | 'manual' | 'compromised' = 'manual'): Promise<string> {\n    const secretConfig = this.secrets.get(key);\n    \n    if (!secretConfig) {\n      throw new Error(`Secret '${key}' not found`);\n    }\n    \n    if (!secretConfig.rotatable) {\n      throw new Error(`Secret '${key}' is not configured for rotation`);\n    }\n    \n    const oldValue = secretConfig.encrypted \n      ? this.decrypt(secretConfig.value)\n      : secretConfig.value;\n    \n    // Generate new secret value\n    const newValue = this.generateStrongSecret();\n    \n    // Record rotation history\n    const historyEntry: SecretRotationHistory = {\n      secretKey: key,\n      oldValue: oldValue.substring(0, 8) + '...', // Only store partial for audit\n      newValue: newValue.substring(0, 8) + '...',\n      rotatedAt: new Date(),\n      rotatedBy: 'system',\n      reason\n    };\n    \n    this.rotationHistory.push(historyEntry);\n    \n    // Update secret\n    secretConfig.value = secretConfig.encrypted ? this.encrypt(newValue) : newValue;\n    secretConfig.lastRotated = new Date();\n    \n    this.secrets.set(key, secretConfig);\n    \n    await this.saveSecretsToFile();\n    \n    this.emit('secretRotated', { \n      key, \n      reason, \n      rotatedAt: secretConfig.lastRotated \n    });\n    \n    return newValue;\n  }\n  \n  private setupSecretRotation(key: string, intervalMs: number): void {\n    // Clear existing interval if any\n    const existingInterval = this.rotationIntervals.get(key);\n    if (existingInterval) {\n      clearInterval(existingInterval);\n    }\n    \n    // Setup new rotation interval\n    const interval = setInterval(async () => {\n      try {\n        await this.rotateSecret(key, 'automatic');\n        console.log(`Automatically rotated secret: ${key}`);\n      } catch (error) {\n        console.error(`Failed to rotate secret ${key}:`, error);\n        this.emit('rotationError', { key, error });\n      }\n    }, intervalMs);\n    \n    this.rotationIntervals.set(key, interval);\n  }\n  \n  private startAutomaticRotation(): void {\n    for (const [key, secretConfig] of this.secrets.entries()) {\n      if (secretConfig.rotatable) {\n        // Check if rotation is due\n        const nextRotation = new Date(secretConfig.lastRotated.getTime() + secretConfig.rotationIntervalMs);\n        const now = new Date();\n        \n        if (now >= nextRotation) {\n          // Immediate rotation needed\n          setTimeout(async () => {\n            await this.rotateSecret(key, 'automatic');\n          }, 1000);\n        }\n        \n        // Setup future rotations\n        this.setupSecretRotation(key, secretConfig.rotationIntervalMs);\n      }\n    }\n  }\n  \n  public listSecrets(includeValues: boolean = false): Array<{\n    key: string;\n    value?: string;\n    encrypted: boolean;\n    rotatable: boolean;\n    lastRotated: Date;\n    expiresAt?: Date;\n    metadata: any;\n  }> {\n    return Array.from(this.secrets.values()).map(secret => ({\n      key: secret.key,\n      ...(includeValues && { \n        value: secret.encrypted ? this.decrypt(secret.value) : secret.value \n      }),\n      encrypted: secret.encrypted,\n      rotatable: secret.rotatable,\n      lastRotated: secret.lastRotated,\n      expiresAt: secret.expiresAt,\n      metadata: secret.metadata\n    }));\n  }\n  \n  public getRotationHistory(key?: string): SecretRotationHistory[] {\n    if (key) {\n      return this.rotationHistory.filter(entry => entry.secretKey === key);\n    }\n    return [...this.rotationHistory];\n  }\n  \n  public async deleteSecret(key: string): Promise<boolean> {\n    const deleted = this.secrets.delete(key);\n    \n    if (deleted) {\n      // Clear rotation interval\n      const interval = this.rotationIntervals.get(key);\n      if (interval) {\n        clearInterval(interval);\n        this.rotationIntervals.delete(key);\n      }\n      \n      await this.saveSecretsToFile();\n      this.emit('secretDeleted', { key });\n    }\n    \n    return deleted;\n  }\n  \n  private async saveSecretsToFile(): Promise<void> {\n    if (process.env.NODE_ENV === 'test') {\n      return; // Don't save in test environment\n    }\n    \n    try {\n      const secretsData = {\n        secrets: Array.from(this.secrets.entries()),\n        rotationHistory: this.rotationHistory,\n        lastUpdated: new Date().toISOString()\n      };\n      \n      await fs.writeFile(\n        this.secretsFilePath, \n        JSON.stringify(secretsData, null, 2),\n        { mode: 0o600 } // Restrict file permissions\n      );\n    } catch (error) {\n      console.error('Failed to save secrets to file:', error);\n      this.emit('saveError', error);\n    }\n  }\n  \n  private async loadSecretsFromFile(): Promise<void> {\n    try {\n      const fileContent = await fs.readFile(this.secretsFilePath, 'utf8');\n      const data = JSON.parse(fileContent);\n      \n      if (data.secrets) {\n        for (const [key, secretConfig] of data.secrets) {\n          this.secrets.set(key, {\n            ...secretConfig,\n            lastRotated: new Date(secretConfig.lastRotated)\n          });\n        }\n      }\n      \n      if (data.rotationHistory) {\n        this.rotationHistory = data.rotationHistory.map((entry: any) => ({\n          ...entry,\n          rotatedAt: new Date(entry.rotatedAt)\n        }));\n      }\n      \n      this.emit('secretsLoaded', { count: this.secrets.size });\n    } catch (error) {\n      if ((error as any).code !== 'ENOENT') {\n        console.error('Failed to load secrets from file:', error);\n        this.emit('loadError', error);\n      }\n    }\n  }\n  \n  public async exportSecrets(includeValues: boolean = false): Promise<string> {\n    const exportData = {\n      metadata: {\n        exportedAt: new Date().toISOString(),\n        exportedBy: 'SecretManager',\n        includesValues: includeValues\n      },\n      secrets: this.listSecrets(includeValues),\n      rotationHistory: this.rotationHistory\n    };\n    \n    return JSON.stringify(exportData, null, 2);\n  }\n  \n  public getSecurityMetrics(): {\n    totalSecrets: number;\n    rotatableSecrets: number;\n    expiredSecrets: number;\n    recentRotations: number;\n    encryptedSecrets: number;\n  } {\n    const now = new Date();\n    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);\n    \n    const secrets = Array.from(this.secrets.values());\n    \n    return {\n      totalSecrets: secrets.length,\n      rotatableSecrets: secrets.filter(s => s.rotatable).length,\n      expiredSecrets: secrets.filter(s => s.expiresAt && s.expiresAt < now).length,\n      recentRotations: this.rotationHistory.filter(h => h.rotatedAt > last30Days).length,\n      encryptedSecrets: secrets.filter(s => s.encrypted).length\n    };\n  }\n  \n  public destroy(): void {\n    // Clear all rotation intervals\n    for (const interval of this.rotationIntervals.values()) {\n      clearInterval(interval);\n    }\n    \n    this.rotationIntervals.clear();\n    this.secrets.clear();\n    this.rotationHistory = [];\n    \n    this.removeAllListeners();\n  }\n}\n\n// Global secret manager instance\nlet globalSecretManager: SecretManager | null = null;\n\nexport const getSecretManager = (): SecretManager => {\n  if (!globalSecretManager) {\n    globalSecretManager = new SecretManager();\n  }\n  return globalSecretManager;\n};\n\nexport const initializeSecretManager = (encryptionKey?: string, secretsFilePath?: string): SecretManager => {\n  if (globalSecretManager) {\n    globalSecretManager.destroy();\n  }\n  \n  globalSecretManager = new SecretManager(encryptionKey, secretsFilePath);\n  return globalSecretManager;\n};\n\nexport default SecretManager;