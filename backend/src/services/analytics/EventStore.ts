import { Database } from 'better-sqlite3';
import { initializeDatabase } from '../../database/connection';

export interface AnalyticsEvent {
  id?: string;
  event_type: string;
  entity_id: string;
  entity_type: string;
  data: any;
  timestamp: Date;
  user_id?: string;
  session_id?: string;
  metadata?: any;
}

export interface EventQuery {
  event_type?: string;
  entity_type?: string;
  entity_id?: string;
  start_time?: Date;
  end_time?: Date;
  limit?: number;
  offset?: number;
}

export class EventStore {
  private db: Database;
  private static instance: EventStore;

  private constructor() {
    this.db = initializeDatabase();
    this.initializeEventStore();
  }

  public static getInstance(): EventStore {
    if (!EventStore.instance) {
      EventStore.instance = new EventStore();
    }
    return EventStore.instance;
  }

  private initializeEventStore(): void {
    // Create analytics events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        event_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        user_id TEXT,
        session_id TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_entity ON analytics_events(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id);
    `);

    // Create aggregated metrics table for performance
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analytics_metrics (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        metric_type TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        value REAL NOT NULL,
        dimensions TEXT,
        timestamp INTEGER NOT NULL,
        period TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for metrics
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_analytics_metrics_type ON analytics_metrics(metric_type, metric_name);
      CREATE INDEX IF NOT EXISTS idx_analytics_metrics_timestamp ON analytics_metrics(timestamp, period);
    `);
  }

  public async recordEvent(event: AnalyticsEvent): Promise<string> {
    const stmt = this.db.prepare(`
      INSERT INTO analytics_events (event_type, entity_id, entity_type, data, timestamp, user_id, session_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      event.event_type,
      event.entity_id,
      event.entity_type,
      JSON.stringify(event.data),
      event.timestamp.getTime(),
      event.user_id,
      event.session_id,
      event.metadata ? JSON.stringify(event.metadata) : null
    );

    return result.lastInsertRowid.toString();
  }

  public async recordBatch(events: AnalyticsEvent[]): Promise<string[]> {
    const stmt = this.db.prepare(`
      INSERT INTO analytics_events (event_type, entity_id, entity_type, data, timestamp, user_id, session_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      const ids: string[] = [];
      for (const event of events) {
        const result = stmt.run(
          event.event_type,
          event.entity_id,
          event.entity_type,
          JSON.stringify(event.data),
          event.timestamp.getTime(),
          event.user_id,
          event.session_id,
          event.metadata ? JSON.stringify(event.metadata) : null
        );
        ids.push(result.lastInsertRowid.toString());
      }
      return ids;
    });

    return transaction();
  }

  public async getEvents(query: EventQuery): Promise<AnalyticsEvent[]> {
    let sql = `
      SELECT id, event_type, entity_id, entity_type, data, timestamp, user_id, session_id, metadata
      FROM analytics_events
      WHERE 1=1
    `;
    const params: any[] = [];

    if (query.event_type) {
      sql += ` AND event_type = ?`;
      params.push(query.event_type);
    }

    if (query.entity_type) {
      sql += ` AND entity_type = ?`;
      params.push(query.entity_type);
    }

    if (query.entity_id) {
      sql += ` AND entity_id = ?`;
      params.push(query.entity_id);
    }

    if (query.start_time) {
      sql += ` AND timestamp >= ?`;
      params.push(query.start_time.getTime());
    }

    if (query.end_time) {
      sql += ` AND timestamp <= ?`;
      params.push(query.end_time.getTime());
    }

    sql += ` ORDER BY timestamp DESC`;

    if (query.limit) {
      sql += ` LIMIT ?`;
      params.push(query.limit);
    }

    if (query.offset) {
      sql += ` OFFSET ?`;
      params.push(query.offset);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    return rows.map(row => {
      const typedRow = row as any;
      return {
        id: typedRow.id,
        event_type: typedRow.event_type,
        entity_id: typedRow.entity_id,
        entity_type: typedRow.entity_type,
        data: JSON.parse(typedRow.data),
        timestamp: new Date(typedRow.timestamp),
        user_id: typedRow.user_id,
        session_id: typedRow.session_id,
        metadata: typedRow.metadata ? JSON.parse(typedRow.metadata) : null
      };
    });
  }

  public async getEventCount(query: EventQuery): Promise<number> {
    let sql = `
      SELECT COUNT(*) as count
      FROM analytics_events
      WHERE 1=1
    `;
    const params: any[] = [];

    if (query.event_type) {
      sql += ` AND event_type = ?`;
      params.push(query.event_type);
    }

    if (query.entity_type) {
      sql += ` AND entity_type = ?`;
      params.push(query.entity_type);
    }

    if (query.entity_id) {
      sql += ` AND entity_id = ?`;
      params.push(query.entity_id);
    }

    if (query.start_time) {
      sql += ` AND timestamp >= ?`;
      params.push(query.start_time.getTime());
    }

    if (query.end_time) {
      sql += ` AND timestamp <= ?`;
      params.push(query.end_time.getTime());
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params) as any;
    return result.count;
  }

  public async storeMetric(
    metricType: string,
    metricName: string,
    value: number,
    dimensions?: Record<string, any>,
    period: string = 'hour'
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO analytics_metrics (metric_type, metric_name, value, dimensions, timestamp, period)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      metricType,
      metricName,
      value,
      dimensions ? JSON.stringify(dimensions) : null,
      Date.now(),
      period
    );
  }

  public async getMetrics(
    metricType: string,
    metricName: string,
    startTime?: Date,
    endTime?: Date,
    period?: string
  ): Promise<any[]> {
    let sql = `
      SELECT metric_name, value, dimensions, timestamp, period
      FROM analytics_metrics
      WHERE metric_type = ? AND metric_name = ?
    `;
    const params: any[] = [metricType, metricName];

    if (startTime) {
      sql += ` AND timestamp >= ?`;
      params.push(startTime.getTime());
    }

    if (endTime) {
      sql += ` AND timestamp <= ?`;
      params.push(endTime.getTime());
    }

    if (period) {
      sql += ` AND period = ?`;
      params.push(period);
    }

    sql += ` ORDER BY timestamp DESC`;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    return rows.map(row => {
      const typedRow = row as any;
      return {
        metric_name: typedRow.metric_name,
        value: typedRow.value,
        dimensions: typedRow.dimensions ? JSON.parse(typedRow.dimensions) : null,
        timestamp: new Date(typedRow.timestamp),
        period: typedRow.period
      };
    });
  }

  public async clearOldEvents(olderThanDays: number = 90): Promise<number> {
    const cutoffTime = new Date();
    cutoffTime.setDate(cutoffTime.getDate() - olderThanDays);

    const stmt = this.db.prepare(`
      DELETE FROM analytics_events
      WHERE timestamp < ?
    `);

    const result = stmt.run(cutoffTime.getTime());
    return result.changes;
  }
}