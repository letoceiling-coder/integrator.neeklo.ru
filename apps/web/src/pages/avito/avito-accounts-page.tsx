import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { useAvitoAccounts, useSyncAvitoAccount } from '@/entities/avito/api';
import { useDisconnectAvitoOAuth, useOAuthAvitoAccounts, useRefreshAvitoOAuth } from '@/entities/oauth/api';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';
import type { OAuthAccountStatusDto } from '@neeklo/contracts';

function healthTone(health: OAuthAccountStatusDto['health']) {
  if (health === 'healthy') return 'success' as const;
  if (health === 'degraded') return 'warning' as const;
  if (health === 'unhealthy') return 'danger' as const;
  return 'neutral' as const;
}

export function AvitoAccountsPage() {
  const { data: accounts, isLoading } = useAvitoAccounts();
  const { data: oauthAccounts } = useOAuthAvitoAccounts();
  const sync = useSyncAvitoAccount();
  const refresh = useRefreshAvitoOAuth();
  const disconnect = useDisconnectAvitoOAuth();

  const oauthByAccount = useMemo(() => {
    const map = new Map<string, OAuthAccountStatusDto>();
    for (const o of oauthAccounts ?? []) map.set(o.accountId, o);
    return map;
  }, [oauthAccounts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avito Account Center"
        description="Мультиаккаунт, OAuth, синхронизация. Подключение — в OAuth Debug Center."
      />

      <Card className="p-4 text-sm space-y-2">
        <Link to="/settings/oauth" className="text-[var(--color-primary)] hover:underline block">
          → OAuth Debug Center — Connection Wizard, Validation, Health, Production Checklist
        </Link>
        <Link to="/avito/live" className="text-[var(--color-primary)] hover:underline block">
          → Avito Live Platform — Sync Dashboard, Explorer, Webhooks, Health
        </Link>
      </Card>

      {isLoading ? (
        <Skeleton className="h-48 rounded-[var(--radius-lg)]" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts?.map((a) => {
            const oauth = oauthByAccount.get(a.id);
            return (
              <Card key={a.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{a.displayName}</h3>
                    <p className="text-xs text-[var(--color-fg-subtle)]">
                      {a.externalAccountId ? `Avito #${a.externalAccountId}` : 'Не привязан'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={a.status === 'ready' || a.status === 'authorized' ? 'success' : a.status === 'error' ? 'danger' : 'neutral'}>
                      {oauth?.connected ? '✓ Connected' : a.status}
                    </Badge>
                    {oauth ? <Badge tone={healthTone(oauth.health)}>{oauth.health}</Badge> : null}
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-[var(--color-fg-subtle)]">Последняя синхронизация</dt>
                    <dd>{a.lastSyncAt ? new Date(a.lastSyncAt).toLocaleString() : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-fg-subtle)]">Token expiration</dt>
                    <dd>{oauth?.tokenExpiresAt ? new Date(oauth.tokenExpiresAt).toLocaleString() : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-fg-subtle)]">Last refresh</dt>
                    <dd>{oauth?.lastRefreshAt ? new Date(oauth.lastRefreshAt).toLocaleString() : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-fg-subtle)]">Last success</dt>
                    <dd>{oauth?.lastSuccessAt ? new Date(oauth.lastSuccessAt).toLocaleString() : '—'}</dd>
                  </div>
                </dl>
                {oauth?.lastError || a.lastSyncError ? (
                  <p className="text-xs text-[var(--color-danger)]">{oauth?.lastError ?? a.lastSyncError}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => sync.mutate(a.id)} disabled={sync.isPending}>
                    Синхронизировать
                  </Button>
                  {oauth?.connected ? (
                    <Button size="sm" variant="secondary" onClick={() => refresh.mutate(a.id)} disabled={refresh.isPending}>
                      Refresh token
                    </Button>
                  ) : null}
                  {oauth ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => disconnect.mutate({ accountId: a.id, reason: 'user_disconnect' })}
                      disabled={disconnect.isPending}
                    >
                      Отключить
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
          {!accounts?.length ? (
            <Card className="p-6 text-sm text-[var(--color-fg-subtle)] md:col-span-2">
              Подключите Avito через{' '}
              <Link to="/settings/oauth" className="text-[var(--color-primary)]">
                OAuth Debug Center
              </Link>
              .
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
