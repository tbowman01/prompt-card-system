import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

// Incident Types and Severity Levels
export enum IncidentSeverity {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum IncidentType {
  SECURITY_BREACH = 'security_breach',
  DATA_BREACH = 'data_breach',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  MALWARE_DETECTION = 'malware_detection',
  DDOS_ATTACK = 'ddos_attack',
  SQL_INJECTION = 'sql_injection',
  XSS_ATTACK = 'xss_attack',
  BRUTE_FORCE = 'brute_force',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  DATA_EXFILTRATION = 'data_exfiltration',
  SYSTEM_COMPROMISE = 'system_compromise',
  INSIDER_THREAT = 'insider_threat'
}

export enum IncidentStatus {
  NEW = 'new',
  ACKNOWLEDGED = 'acknowledged',
  INVESTIGATING = 'investigating',
  CONTAINED = 'contained',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export interface SecurityIncident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  source: string;
  affectedSystems: string[];
  evidenceFiles: string[];
  timeline: IncidentTimelineEntry[];
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  metadata: {
    sourceIP?: string;
    userAgent?: string;
    userId?: string;
    endpoint?: string;
    payload?: any;
    attackVector?: string;
    impactAssessment?: string;
    mitigationSteps?: string[];
  };
}

export interface IncidentTimelineEntry {
  id: string;
  timestamp: Date;
  action: string;
  actor: string;
  description: string;
  automated: boolean;
}

export interface ResponseAction {
  id: string;
  name: string;
  description: string;
  automated: boolean;
  triggerConditions: {
    types: IncidentType[];
    severities: IncidentSeverity[];
    sources?: string[];
  };
  action: (incident: SecurityIncident) => Promise<void>;
}

export interface SecurityAlert {
  id: string;
  incidentId?: string;
  severity: IncidentSeverity;
  message: string;
  source: string;
  timestamp: Date;
  acknowledged: boolean;
  metadata: any;
}

export class IncidentResponseSystem extends EventEmitter {
  private incidents = new Map<string, SecurityIncident>();
  private alerts = new Map<string, SecurityAlert>();
  private responseActions = new Map<string, ResponseAction>();
  private incidentsLogPath: string;
  private alertsLogPath: string;
  
  constructor() {
    super();
    this.incidentsLogPath = path.join(process.cwd(), 'logs', 'incidents.json');
    this.alertsLogPath = path.join(process.cwd(), 'logs', 'security-alerts.json');
    
    this.initializeResponseActions();
    this.loadPersistedData();
  }
  
  private async initializeResponseActions(): Promise<void> {\n    // Automated response actions\n    const responseActions: Omit<ResponseAction, 'id'>[] = [\n      {\n        name: 'Block Suspicious IP',\n        description: 'Automatically block IP addresses showing suspicious behavior',\n        automated: true,\n        triggerConditions: {\n          types: [IncidentType.BRUTE_FORCE, IncidentType.SQL_INJECTION, IncidentType.XSS_ATTACK],\n          severities: [IncidentSeverity.MEDIUM, IncidentSeverity.HIGH, IncidentSeverity.CRITICAL]\n        },\n        action: async (incident: SecurityIncident) => {\n          if (incident.metadata.sourceIP) {\n            console.log(`AUTOMATED: Blocking IP ${incident.metadata.sourceIP}`);\n            // In production, integrate with firewall/WAF API\n            await this.addTimelineEntry(incident.id, {\n              action: 'ip_blocked',\n              actor: 'system',\n              description: `Automatically blocked IP ${incident.metadata.sourceIP}`,\n              automated: true\n            });\n          }\n        }\n      },\n      {\n        name: 'Revoke User Sessions',\n        description: 'Revoke all active sessions for a compromised user account',\n        automated: true,\n        triggerConditions: {\n          types: [IncidentType.UNAUTHORIZED_ACCESS, IncidentType.PRIVILEGE_ESCALATION],\n          severities: [IncidentSeverity.HIGH, IncidentSeverity.CRITICAL]\n        },\n        action: async (incident: SecurityIncident) => {\n          if (incident.metadata.userId) {\n            console.log(`AUTOMATED: Revoking sessions for user ${incident.metadata.userId}`);\n            // In production, integrate with auth service\n            await this.addTimelineEntry(incident.id, {\n              action: 'sessions_revoked',\n              actor: 'system',\n              description: `Automatically revoked all sessions for user ${incident.metadata.userId}`,\n              automated: true\n            });\n          }\n        }\n      },\n      {\n        name: 'Enable Rate Limiting',\n        description: 'Enable aggressive rate limiting for affected endpoints',\n        automated: true,\n        triggerConditions: {\n          types: [IncidentType.DDOS_ATTACK, IncidentType.BRUTE_FORCE],\n          severities: [IncidentSeverity.HIGH, IncidentSeverity.CRITICAL]\n        },\n        action: async (incident: SecurityIncident) => {\n          console.log('AUTOMATED: Enabling aggressive rate limiting');\n          // In production, update rate limiting configuration\n          await this.addTimelineEntry(incident.id, {\n            action: 'rate_limiting_enabled',\n            actor: 'system',\n            description: 'Automatically enabled aggressive rate limiting',\n            automated: true\n          });\n        }\n      },\n      {\n        name: 'Generate Security Report',\n        description: 'Generate detailed security report for critical incidents',\n        automated: true,\n        triggerConditions: {\n          types: Object.values(IncidentType),\n          severities: [IncidentSeverity.CRITICAL]\n        },\n        action: async (incident: SecurityIncident) => {\n          await this.generateIncidentReport(incident.id);\n          await this.addTimelineEntry(incident.id, {\n            action: 'report_generated',\n            actor: 'system',\n            description: 'Automatically generated detailed incident report',\n            automated: true\n          });\n        }\n      },\n      {\n        name: 'Notify Security Team',\n        description: 'Send immediate notification to security team for high/critical incidents',\n        automated: true,\n        triggerConditions: {\n          types: Object.values(IncidentType),\n          severities: [IncidentSeverity.HIGH, IncidentSeverity.CRITICAL]\n        },\n        action: async (incident: SecurityIncident) => {\n          await this.sendSecurityNotification(incident);\n          await this.addTimelineEntry(incident.id, {\n            action: 'team_notified',\n            actor: 'system',\n            description: 'Automatically notified security team',\n            automated: true\n          });\n        }\n      }\n    ];\n    \n    for (const action of responseActions) {\n      const actionId = createHash('md5').update(action.name).digest('hex');\n      this.responseActions.set(actionId, { id: actionId, ...action });\n    }\n  }\n  \n  public async createIncident(incidentData: {\n    type: IncidentType;\n    severity: IncidentSeverity;\n    title: string;\n    description: string;\n    source: string;\n    affectedSystems?: string[];\n    metadata?: any;\n  }): Promise<SecurityIncident> {\n    const incidentId = this.generateIncidentId();\n    \n    const incident: SecurityIncident = {\n      id: incidentId,\n      type: incidentData.type,\n      severity: incidentData.severity,\n      status: IncidentStatus.NEW,\n      title: incidentData.title,\n      description: incidentData.description,\n      source: incidentData.source,\n      affectedSystems: incidentData.affectedSystems || [],\n      evidenceFiles: [],\n      timeline: [],\n      createdAt: new Date(),\n      updatedAt: new Date(),\n      metadata: incidentData.metadata || {}\n    };\n    \n    this.incidents.set(incidentId, incident);\n    \n    // Add initial timeline entry\n    await this.addTimelineEntry(incidentId, {\n      action: 'incident_created',\n      actor: 'system',\n      description: `Incident created: ${incident.title}`,\n      automated: true\n    });\n    \n    // Trigger automated response actions\n    await this.executeResponseActions(incident);\n    \n    // Persist to file\n    await this.persistIncidents();\n    \n    this.emit('incidentCreated', incident);\n    \n    return incident;\n  }\n  \n  private generateIncidentId(): string {\n    const timestamp = Date.now().toString(36);\n    const random = Math.random().toString(36).substring(2, 8);\n    return `INC-${timestamp}-${random}`.toUpperCase();\n  }\n  \n  public async updateIncidentStatus(\n    incidentId: string, \n    status: IncidentStatus, \n    actor: string = 'system',\n    notes?: string\n  ): Promise<void> {\n    const incident = this.incidents.get(incidentId);\n    if (!incident) {\n      throw new Error(`Incident ${incidentId} not found`);\n    }\n    \n    const oldStatus = incident.status;\n    incident.status = status;\n    incident.updatedAt = new Date();\n    \n    if (status === IncidentStatus.RESOLVED || status === IncidentStatus.CLOSED) {\n      incident.resolvedAt = new Date();\n    }\n    \n    await this.addTimelineEntry(incidentId, {\n      action: 'status_changed',\n      actor,\n      description: `Status changed from ${oldStatus} to ${status}${notes ? `: ${notes}` : ''}`,\n      automated: actor === 'system'\n    });\n    \n    await this.persistIncidents();\n    \n    this.emit('incidentStatusChanged', { incidentId, oldStatus, newStatus: status, actor });\n  }\n  \n  public async addTimelineEntry(\n    incidentId: string, \n    entry: {\n      action: string;\n      actor: string;\n      description: string;\n      automated: boolean;\n    }\n  ): Promise<void> {\n    const incident = this.incidents.get(incidentId);\n    if (!incident) {\n      throw new Error(`Incident ${incidentId} not found`);\n    }\n    \n    const timelineEntry: IncidentTimelineEntry = {\n      id: createHash('md5').update(`${incidentId}-${Date.now()}-${entry.action}`).digest('hex'),\n      timestamp: new Date(),\n      ...entry\n    };\n    \n    incident.timeline.push(timelineEntry);\n    incident.updatedAt = new Date();\n    \n    this.incidents.set(incidentId, incident);\n    \n    this.emit('timelineEntryAdded', { incidentId, entry: timelineEntry });\n  }\n  \n  private async executeResponseActions(incident: SecurityIncident): Promise<void> {\n    for (const [actionId, action] of this.responseActions.entries()) {\n      if (!action.automated) continue;\n      \n      // Check if action should trigger for this incident\n      const shouldTrigger = \n        action.triggerConditions.types.includes(incident.type) &&\n        action.triggerConditions.severities.includes(incident.severity) &&\n        (!action.triggerConditions.sources || \n         action.triggerConditions.sources.includes(incident.source));\n      \n      if (shouldTrigger) {\n        try {\n          await action.action(incident);\n          console.log(`Executed automated response action: ${action.name} for incident ${incident.id}`);\n        } catch (error) {\n          console.error(`Failed to execute response action ${action.name}:`, error);\n          await this.addTimelineEntry(incident.id, {\n            action: 'action_failed',\n            actor: 'system',\n            description: `Failed to execute ${action.name}: ${error}`,\n            automated: true\n          });\n        }\n      }\n    }\n  }\n  \n  public async createAlert(alertData: {\n    incidentId?: string;\n    severity: IncidentSeverity;\n    message: string;\n    source: string;\n    metadata?: any;\n  }): Promise<SecurityAlert> {\n    const alertId = createHash('md5').update(\n      `${Date.now()}-${alertData.source}-${alertData.message}`\n    ).digest('hex');\n    \n    const alert: SecurityAlert = {\n      id: alertId,\n      incidentId: alertData.incidentId,\n      severity: alertData.severity,\n      message: alertData.message,\n      source: alertData.source,\n      timestamp: new Date(),\n      acknowledged: false,\n      metadata: alertData.metadata || {}\n    };\n    \n    this.alerts.set(alertId, alert);\n    \n    await this.persistAlerts();\n    \n    this.emit('alertCreated', alert);\n    \n    // Auto-create incident for high/critical unlinked alerts\n    if (!alert.incidentId && \n        (alert.severity === IncidentSeverity.HIGH || alert.severity === IncidentSeverity.CRITICAL)) {\n      await this.createIncidentFromAlert(alert);\n    }\n    \n    return alert;\n  }\n  \n  private async createIncidentFromAlert(alert: SecurityAlert): Promise<void> {\n    const incident = await this.createIncident({\n      type: this.inferIncidentTypeFromAlert(alert),\n      severity: alert.severity,\n      title: `Auto-generated from alert: ${alert.message}`,\n      description: `This incident was automatically created from a ${alert.severity} severity alert from ${alert.source}`,\n      source: alert.source,\n      metadata: alert.metadata\n    });\n    \n    // Link alert to incident\n    alert.incidentId = incident.id;\n    this.alerts.set(alert.id, alert);\n    \n    await this.addTimelineEntry(incident.id, {\n      action: 'alert_linked',\n      actor: 'system',\n      description: `Alert ${alert.id} linked to incident`,\n      automated: true\n    });\n  }\n  \n  private inferIncidentTypeFromAlert(alert: SecurityAlert): IncidentType {\n    const message = alert.message.toLowerCase();\n    const source = alert.source.toLowerCase();\n    \n    if (message.includes('sql') || message.includes('injection')) {\n      return IncidentType.SQL_INJECTION;\n    }\n    if (message.includes('xss') || message.includes('script')) {\n      return IncidentType.XSS_ATTACK;\n    }\n    if (message.includes('brute force') || message.includes('login attempts')) {\n      return IncidentType.BRUTE_FORCE;\n    }\n    if (message.includes('ddos') || message.includes('rate limit')) {\n      return IncidentType.DDOS_ATTACK;\n    }\n    if (message.includes('unauthorized') || message.includes('access denied')) {\n      return IncidentType.UNAUTHORIZED_ACCESS;\n    }\n    if (source.includes('auth') || message.includes('authentication')) {\n      return IncidentType.UNAUTHORIZED_ACCESS;\n    }\n    \n    return IncidentType.SECURITY_BREACH; // Default\n  }\n  \n  public getIncident(incidentId: string): SecurityIncident | undefined {\n    return this.incidents.get(incidentId);\n  }\n  \n  public getIncidents(filters?: {\n    status?: IncidentStatus[];\n    severity?: IncidentSeverity[];\n    type?: IncidentType[];\n    dateFrom?: Date;\n    dateTo?: Date;\n    assignedTo?: string;\n  }): SecurityIncident[] {\n    let incidents = Array.from(this.incidents.values());\n    \n    if (filters) {\n      if (filters.status) {\n        incidents = incidents.filter(i => filters.status!.includes(i.status));\n      }\n      if (filters.severity) {\n        incidents = incidents.filter(i => filters.severity!.includes(i.severity));\n      }\n      if (filters.type) {\n        incidents = incidents.filter(i => filters.type!.includes(i.type));\n      }\n      if (filters.dateFrom) {\n        incidents = incidents.filter(i => i.createdAt >= filters.dateFrom!);\n      }\n      if (filters.dateTo) {\n        incidents = incidents.filter(i => i.createdAt <= filters.dateTo!);\n      }\n      if (filters.assignedTo) {\n        incidents = incidents.filter(i => i.assignedTo === filters.assignedTo);\n      }\n    }\n    \n    return incidents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());\n  }\n  \n  public async generateIncidentReport(incidentId: string): Promise<string> {\n    const incident = this.incidents.get(incidentId);\n    if (!incident) {\n      throw new Error(`Incident ${incidentId} not found`);\n    }\n    \n    const report = {\n      incident: {\n        id: incident.id,\n        type: incident.type,\n        severity: incident.severity,\n        status: incident.status,\n        title: incident.title,\n        description: incident.description,\n        source: incident.source,\n        affectedSystems: incident.affectedSystems,\n        assignedTo: incident.assignedTo,\n        createdAt: incident.createdAt,\n        updatedAt: incident.updatedAt,\n        resolvedAt: incident.resolvedAt,\n        duration: incident.resolvedAt \n          ? incident.resolvedAt.getTime() - incident.createdAt.getTime()\n          : Date.now() - incident.createdAt.getTime()\n      },\n      timeline: incident.timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),\n      relatedAlerts: Array.from(this.alerts.values())\n        .filter(alert => alert.incidentId === incidentId),\n      metadata: incident.metadata,\n      reportGeneratedAt: new Date(),\n      reportGeneratedBy: 'IncidentResponseSystem'\n    };\n    \n    // Save report to file\n    const reportsDir = path.join(process.cwd(), 'reports', 'incidents');\n    await fs.mkdir(reportsDir, { recursive: true });\n    \n    const reportPath = path.join(reportsDir, `${incidentId}-report.json`);\n    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));\n    \n    return reportPath;\n  }\n  \n  private async sendSecurityNotification(incident: SecurityIncident): Promise<void> {\n    // In production, integrate with notification services (email, Slack, PagerDuty, etc.)\n    console.log(`🚨 SECURITY ALERT: ${incident.severity.toUpperCase()} incident created`);\n    console.log(`ID: ${incident.id}`);\n    console.log(`Type: ${incident.type}`);\n    console.log(`Title: ${incident.title}`);\n    console.log(`Description: ${incident.description}`);\n    console.log(`Source: ${incident.source}`);\n    \n    if (incident.metadata.sourceIP) {\n      console.log(`Source IP: ${incident.metadata.sourceIP}`);\n    }\n    \n    if (incident.affectedSystems.length > 0) {\n      console.log(`Affected Systems: ${incident.affectedSystems.join(', ')}`);\n    }\n  }\n  \n  public getSecurityMetrics(): {\n    totalIncidents: number;\n    openIncidents: number;\n    criticalIncidents: number;\n    averageResolutionTime: number;\n    incidentsByType: Record<IncidentType, number>;\n    incidentsBySeverity: Record<IncidentSeverity, number>;\n    recentIncidents: number;\n  } {\n    const incidents = Array.from(this.incidents.values());\n    const now = Date.now();\n    const last24Hours = now - 24 * 60 * 60 * 1000;\n    \n    const openIncidents = incidents.filter(i => \n      i.status !== IncidentStatus.RESOLVED && i.status !== IncidentStatus.CLOSED\n    ).length;\n    \n    const criticalIncidents = incidents.filter(i => \n      i.severity === IncidentSeverity.CRITICAL &&\n      i.status !== IncidentStatus.RESOLVED && \n      i.status !== IncidentStatus.CLOSED\n    ).length;\n    \n    const resolvedIncidents = incidents.filter(i => i.resolvedAt);\n    const averageResolutionTime = resolvedIncidents.length > 0 \n      ? resolvedIncidents.reduce((sum, i) => \n          sum + (i.resolvedAt!.getTime() - i.createdAt.getTime()), 0\n        ) / resolvedIncidents.length\n      : 0;\n    \n    const incidentsByType = incidents.reduce((acc, i) => {\n      acc[i.type] = (acc[i.type] || 0) + 1;\n      return acc;\n    }, {} as Record<IncidentType, number>);\n    \n    const incidentsBySeverity = incidents.reduce((acc, i) => {\n      acc[i.severity] = (acc[i.severity] || 0) + 1;\n      return acc;\n    }, {} as Record<IncidentSeverity, number>);\n    \n    const recentIncidents = incidents.filter(i => \n      i.createdAt.getTime() > last24Hours\n    ).length;\n    \n    return {\n      totalIncidents: incidents.length,\n      openIncidents,\n      criticalIncidents,\n      averageResolutionTime,\n      incidentsByType,\n      incidentsBySeverity,\n      recentIncidents\n    };\n  }\n  \n  private async persistIncidents(): Promise<void> {\n    try {\n      await fs.mkdir(path.dirname(this.incidentsLogPath), { recursive: true });\n      const data = Array.from(this.incidents.entries());\n      await fs.writeFile(this.incidentsLogPath, JSON.stringify(data, null, 2));\n    } catch (error) {\n      console.error('Failed to persist incidents:', error);\n    }\n  }\n  \n  private async persistAlerts(): Promise<void> {\n    try {\n      await fs.mkdir(path.dirname(this.alertsLogPath), { recursive: true });\n      const data = Array.from(this.alerts.entries());\n      await fs.writeFile(this.alertsLogPath, JSON.stringify(data, null, 2));\n    } catch (error) {\n      console.error('Failed to persist alerts:', error);\n    }\n  }\n  \n  private async loadPersistedData(): Promise<void> {\n    try {\n      // Load incidents\n      const incidentsData = await fs.readFile(this.incidentsLogPath, 'utf8');\n      const incidents: [string, any][] = JSON.parse(incidentsData);\n      \n      for (const [id, incident] of incidents) {\n        this.incidents.set(id, {\n          ...incident,\n          createdAt: new Date(incident.createdAt),\n          updatedAt: new Date(incident.updatedAt),\n          resolvedAt: incident.resolvedAt ? new Date(incident.resolvedAt) : undefined,\n          timeline: incident.timeline.map((entry: any) => ({\n            ...entry,\n            timestamp: new Date(entry.timestamp)\n          }))\n        });\n      }\n    } catch (error) {\n      // Ignore if file doesn't exist\n    }\n    \n    try {\n      // Load alerts\n      const alertsData = await fs.readFile(this.alertsLogPath, 'utf8');\n      const alerts: [string, any][] = JSON.parse(alertsData);\n      \n      for (const [id, alert] of alerts) {\n        this.alerts.set(id, {\n          ...alert,\n          timestamp: new Date(alert.timestamp)\n        });\n      }\n    } catch (error) {\n      // Ignore if file doesn't exist\n    }\n  }\n  \n  public destroy(): void {\n    this.removeAllListeners();\n    this.incidents.clear();\n    this.alerts.clear();\n    this.responseActions.clear();\n  }\n}\n\n// Global incident response system\nlet globalIncidentResponse: IncidentResponseSystem | null = null;\n\nexport const getIncidentResponseSystem = (): IncidentResponseSystem => {\n  if (!globalIncidentResponse) {\n    globalIncidentResponse = new IncidentResponseSystem();\n  }\n  return globalIncidentResponse;\n};\n\nexport default IncidentResponseSystem;