import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { CurrentUser as CurrentUserDto, Permission } from '@neeklo/contracts';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks a route as accessible without authentication. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = 'permissions';
/** Requires the caller to hold every listed permission. */
export const RequirePermissions = (...permissions: Permission[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Injects the authenticated {@link CurrentUserDto} into a handler parameter. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserDto =>
    ctx.switchToHttp().getRequest().user as CurrentUserDto,
);
