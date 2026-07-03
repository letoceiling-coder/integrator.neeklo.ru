/** Runtime-safe OAuth status values (avoids circular @neeklo/contracts CJS init in Nest bootstrap). */
export const OAuthStatus = {
  PENDING: 'pending',
  CONNECTED: 'connected',
  EXPIRED: 'expired',
  REAUTH_REQUIRED: 'reauth_required',
  DISCONNECTED: 'disconnected',
} as const;

export type OAuthStatusValue = (typeof OAuthStatus)[keyof typeof OAuthStatus];
