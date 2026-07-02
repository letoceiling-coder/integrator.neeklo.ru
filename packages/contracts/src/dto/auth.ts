import { z } from 'zod';

/** Coarse-grained roles. Fine-grained access is expressed via permissions below. */
export const Role = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  ANALYST: 'analyst',
  VIEWER: 'viewer',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const roleSchema = z.nativeEnum(Role);

/** Permission = `resource:action`. Guards check these, not roles, so RBAC stays flexible. */
export const Permission = {
  AdRead: 'ad:read',
  AdWrite: 'ad:write',
  AdPublish: 'ad:publish',
  ChatRead: 'chat:read',
  ChatWrite: 'chat:write',
  AnalyticsRead: 'analytics:read',
  BudgetWrite: 'budget:write',
  AutomationWrite: 'automation:write',
  SettingsWrite: 'settings:write',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const currentUserSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: roleSchema,
  permissions: z.array(z.string()),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;
