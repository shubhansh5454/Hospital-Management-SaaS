import { logger } from '../utils/logger.ts';
import fs from 'fs';
import path from 'path';

// --- Domain Event Structure ---
export interface DomainEvent<Payload = any> {
  id: string;          // Unique Event ID for Idempotency
  name: string;        // E.g., 'AppointmentCreated', 'InvoicePaid'
  version: number;     // Versioning support
  timestamp: string;   // ISO string of creation
  source: string;      // Event emitter context
  payload: Payload;    // Strongly typed or unstructured payload
  correlationId?: string; // Observability/tracing
}

export type EventSubscriberCallback<T = any> = (event: DomainEvent<T>) => Promise<void> | void;

export interface Subscription {
  id: string;
  eventName: string;
  callback: EventSubscriberCallback;
}

// Persist Event Logs and DLQ for durability and audit trail
const EVENT_LOG_FILE = path.join(process.cwd(), 'src', 'server', 'data', 'event_logs.json');
const DLQ_FILE = path.join(process.cwd(), 'src', 'server', 'data', 'event_dlq.json');

export class EventBus {
  private static subscribers: Map<string, Subscription[]> = new Map();
  private static processedEventIds: Set<string> = new Set(); // In-memory cache for fast Idempotency checks
  private static maxRetries = 3;
  private static retryDelayMs = 1000;

  static {
    // Ensure data directory exists
    const dir = path.join(process.cwd(), 'src', 'server', 'data');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Reset processed event cache
   */
  public static clearIdempotencyCache() {
    this.processedEventIds.clear();
  }

  /**
   * Subscribe to a specific Domain Event
   */
  public static subscribe<T = any>(eventName: string, callback: EventSubscriberCallback<T>): string {
    const subId = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const currentSubs = this.subscribers.get(eventName) || [];
    currentSubs.push({ id: subId, eventName, callback });
    this.subscribers.set(eventName, currentSubs);
    logger.info(`EventBus: Subscribed to event "${eventName}" (Subscription ID: ${subId})`);
    return subId;
  }

  /**
   * Unsubscribe a subscriber
   */
  public static unsubscribe(eventName: string, subId: string): void {
    const currentSubs = this.subscribers.get(eventName) || [];
    const filtered = currentSubs.filter(sub => sub.id !== subId);
    this.subscribers.set(eventName, filtered);
    logger.info(`EventBus: Unsubscribed subscriber ${subId} from "${eventName}"`);
  }

  /**
   * Publish a Domain Event with built-in Idempotency, Retries, Logging, and DLQ
   */
  public static async publish<T = any>(event: DomainEvent<T>): Promise<void> {
    // 1. Check Idempotency (prevent duplicate processing)
    if (this.processedEventIds.has(event.id)) {
      logger.warn(`EventBus [Idempotency Warning]: Event ${event.id} (${event.name}) has already been processed. Ignoring.`);
      return;
    }

    this.processedEventIds.add(event.id);

    // 2. Log event to storage
    await this.logEvent(event);
    logger.info(`EventBus [Publish]: "${event.name}" (ID: ${event.id}) published from ${event.source}`);

    // 3. Find subscribers
    const subs = this.subscribers.get(event.name) || [];
    if (subs.length === 0) {
      logger.debug(`EventBus: No active subscribers registered for event "${event.name}"`);
      return;
    }

    // 4. Dispatch to subscribers with retry mechanisms
    for (const sub of subs) {
      this.executeWithRetry(sub, event);
    }
  }

  /**
   * Execute subscriber callback with exponential backoff retry and DLQ routing on exhaustive failure
   */
  private static async executeWithRetry(sub: Subscription, event: DomainEvent): Promise<void> {
    let attempts = 0;
    while (attempts < this.maxRetries) {
      try {
        attempts++;
        await sub.callback(event);
        logger.debug(`EventBus [Success]: Subscriber ${sub.id} successfully processed "${event.name}" on attempt ${attempts}`);
        return;
      } catch (err: any) {
        logger.error(`EventBus [Error]: Subscriber ${sub.id} failed to process "${event.name}" (Attempt ${attempts}/${this.maxRetries}). Error: ${err.message}`);
        if (attempts < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempts - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Routing to DLQ after exhausting all retries
    logger.error(`EventBus [DLQ Alert]: Exhausted all ${this.maxRetries} retries for subscriber ${sub.id} processing event ${event.id} (${event.name}). Routing to DLQ.`);
    await this.routeToDLQ(sub.id, event);
  }

  /**
   * Log published event to disk
   */
  private static async logEvent(event: DomainEvent): Promise<void> {
    try {
      let logs: DomainEvent[] = [];
      if (fs.existsSync(EVENT_LOG_FILE)) {
        const content = await fs.promises.readFile(EVENT_LOG_FILE, 'utf-8');
        logs = JSON.parse(content || '[]');
      }
      logs.unshift(event);
      if (logs.length > 500) {
        logs.pop(); // Keep only last 500 events
      }
      await fs.promises.writeFile(EVENT_LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8');
    } catch (err) {
      logger.error('Failed to log event to local store:', err);
    }
  }

  /**
   * Route failed event to Dead Letter Queue
   */
  private static async routeToDLQ(subscriberId: string, event: DomainEvent): Promise<void> {
    try {
      let dlq: any[] = [];
      if (fs.existsSync(DLQ_FILE)) {
        const content = await fs.promises.readFile(DLQ_FILE, 'utf-8');
        dlq = JSON.parse(content || '[]');
      }
      dlq.unshift({
        id: `dlq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        subscriberId,
        failedAt: new Date().toISOString(),
        event
      });
      await fs.promises.writeFile(DLQ_FILE, JSON.stringify(dlq, null, 2), 'utf-8');
    } catch (err) {
      logger.error('Failed to route event to DLQ:', err);
    }
  }

  /**
   * Get Event logs for monitoring
   */
  public static async getEventLogs(): Promise<DomainEvent[]> {
    try {
      if (fs.existsSync(EVENT_LOG_FILE)) {
        const content = await fs.promises.readFile(EVENT_LOG_FILE, 'utf-8');
        return JSON.parse(content || '[]');
      }
    } catch {
      // Return fallback
    }
    return [];
  }

  /**
   * Get DLQ records for administrative retry / debugging
   */
  public static async getDLQRecords(): Promise<any[]> {
    try {
      if (fs.existsSync(DLQ_FILE)) {
        const content = await fs.promises.readFile(DLQ_FILE, 'utf-8');
        return JSON.parse(content || '[]');
      }
    } catch {
      // Return fallback
    }
    return [];
  }

  /**
   * Clear DLQ
   */
  public static async clearDLQ(): Promise<void> {
    try {
      await fs.promises.writeFile(DLQ_FILE, JSON.stringify([], null, 2), 'utf-8');
    } catch (err) {
      logger.error('Failed to clear DLQ:', err);
    }
  }
}
