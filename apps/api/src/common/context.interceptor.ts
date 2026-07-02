import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ActorType, type CurrentUser } from '@neeklo/contracts';
import { RequestContextService, type RequestContext } from '../platform/context/request-context';

/**
 * Establishes the ambient {@link RequestContext} for the duration of the handler. Runs after
 * guards, so `req.user` is available; the correlation id links every event a request produces.
 */
@Injectable()
export class ContextInterceptor implements NestInterceptor {
  constructor(private readonly ctx: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as CurrentUser | undefined;
    const correlationId =
      (req.headers['x-correlation-id'] as string | undefined) ?? RequestContextService.newCorrelationId();

    const requestContext: RequestContext = {
      tenantId: user?.tenantId ?? 'system',
      actor: user ? { type: ActorType.USER, id: user.id } : { type: ActorType.SYSTEM, id: null },
      correlationId,
    };

    return new Observable((subscriber) => {
      this.ctx.run(requestContext, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
