import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import type { Actor } from '@neeklo/contracts';

export interface RequestContext {
  tenantId: string;
  actor: Actor;
  correlationId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Ambient per-request context so command handlers can stamp events with tenant/actor/correlation
 * without threading them through every signature. Populated by {@link ContextMiddleware}.
 */
@Injectable()
export class RequestContextService {
  run<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run(ctx, fn);
  }

  get(): RequestContext | undefined {
    return storage.getStore();
  }

  require(): RequestContext {
    const ctx = storage.getStore();
    if (!ctx) throw new Error('RequestContext is not available in this execution scope');
    return ctx;
  }

  static newCorrelationId(): string {
    return uuid();
  }
}
