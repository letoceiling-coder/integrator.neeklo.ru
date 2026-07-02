import { CanActivate, ForbiddenException, Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CurrentUser, Permission } from '@neeklo/contracts';
import { PERMISSIONS_KEY } from '../decorators';

/** Enforces `@RequirePermissions(...)` against the current user's effective permission set. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as CurrentUser | undefined;
    if (!user) throw new ForbiddenException({ code: 'forbidden', message: 'Not authenticated' });

    const granted = new Set(user.permissions);
    const missing = required.filter((p) => !granted.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException({
        code: 'insufficient_permissions',
        message: 'Missing required permissions',
        details: { missing },
      });
    }
    return true;
  }
}
