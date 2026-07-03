import { Injectable } from '@nestjs/common';
import { Subject, type Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import type { MessageEvent } from '@nestjs/common';

@Injectable()
export class ProductionRealtimeService {
  private readonly bus = new Subject<{ tenantId: string; kind: string; payload: unknown }>();

  publish(tenantId: string, kind: string, payload: unknown) {
    this.bus.next({ tenantId, kind, payload });
  }

  stream(tenantId: string): Observable<MessageEvent> {
    return this.bus.pipe(
      filter((ev) => ev.tenantId === tenantId),
      map((ev) => ({ data: JSON.stringify(ev) }) as MessageEvent),
    );
  }
}
