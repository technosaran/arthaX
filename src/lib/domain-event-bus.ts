/**
 * In-memory Domain Event Bus.
 * Implements the Observer Design Pattern for decoupling side-effects (logging, audit trail, cache invalidation)
 * from core business service execution.
 */

export interface DomainEvent<T = any> {
  name: string;
  timestamp: string;
  userId?: string;
  payload: T;
}

export type EventCallback<T = any> = (event: DomainEvent<T>) => void | Promise<void>;

export class DomainEventBus {
  private static instance: DomainEventBus | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  public static getInstance(): DomainEventBus {
    if (!DomainEventBus.instance) {
      DomainEventBus.instance = new DomainEventBus();
    }
    return DomainEventBus.instance;
  }

  /**
   * Subscribes a callback to a specific domain event.
   */
  public subscribe<T = any>(eventName: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }

    const callbacks = this.listeners.get(eventName)!;
    callbacks.add(callback as EventCallback);

    // Return unsubscribe function
    return () => {
      callbacks.delete(callback as EventCallback);
      if (callbacks.size === 0) {
        this.listeners.delete(eventName);
      }
    };
  }

  /**
   * Publishes a domain event to all active subscribers.
   */
  public async publish<T = any>(eventName: string, payload: T, userId?: string): Promise<void> {
    const event: DomainEvent<T> = {
      name: eventName,
      timestamp: new Date().toISOString(),
      userId,
      payload,
    };

    const callbacks = this.listeners.get(eventName);
    if (!callbacks || callbacks.size === 0) return;

    const promises = Array.from(callbacks).map((cb) => {
      try {
        return Promise.resolve(cb(event));
      } catch (err) {
        console.error(`[DomainEventBus] Error handling event ${eventName}:`, err);
        return Promise.resolve();
      }
    });

    await Promise.all(promises);
  }

  /**
   * Clears all listeners. Useful for test cleanup.
   */
  public clear(): void {
    this.listeners.clear();
  }
}

export const domainEventBus = DomainEventBus.getInstance();
