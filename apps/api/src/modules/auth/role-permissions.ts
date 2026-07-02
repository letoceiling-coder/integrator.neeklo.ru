import { Permission, Role } from '@neeklo/contracts';

/** Default permission sets per role. Users may also carry explicit extra permissions. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.OWNER]: Object.values(Permission),
  [Role.ADMIN]: Object.values(Permission),
  [Role.MANAGER]: [
    Permission.AdRead,
    Permission.AdWrite,
    Permission.AdPublish,
    Permission.ChatRead,
    Permission.ChatWrite,
    Permission.AnalyticsRead,
  ],
  [Role.ANALYST]: [Permission.AdRead, Permission.AnalyticsRead, Permission.ChatRead],
  [Role.VIEWER]: [Permission.AdRead, Permission.AnalyticsRead],
};

export function permissionsForRole(role: Role, extra: string[] = []): string[] {
  return [...new Set<string>([...(ROLE_PERMISSIONS[role] ?? []), ...extra])];
}
