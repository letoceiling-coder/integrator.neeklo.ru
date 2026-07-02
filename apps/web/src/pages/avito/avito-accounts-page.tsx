import { useAvitoAccounts, useSyncAvitoAccount } from '@/entities/avito/api';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';

export function AvitoAccountsPage() {
  const { data: accounts, isLoading } = useAvitoAccounts();
  const sync = useSyncAvitoAccount();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avito Account Center"
        description="Мультиаккаунт, статус авторизации, синхронизация и лимиты."
      />

      {isLoading ? (
        <Skeleton className="h-48 rounded-[var(--radius-lg)]" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts?.map((a) => (
            <Card key={a.id} className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">{a.displayName}</h3>
                  <p className="text-xs text-[var(--color-fg-subtle)]">
                    {a.externalAccountId ? `Avito #${a.externalAccountId}` : 'Не привязан'}
                  </p>
                </div>
                <Badge tone={a.status === 'authorized' ? 'success' : a.status === 'error' ? 'danger' : 'neutral'}>
                  {a.status}
                </Badge>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-[var(--color-fg-subtle)]">Последняя синхронизация</dt>
                  <dd>{a.lastSyncAt ? new Date(a.lastSyncAt).toLocaleString() : '—'}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-fg-subtle)]">Лимит сообщений/день</dt>
                  <dd>{a.dailyMessageLimit ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-fg-subtle)]">Баланс</dt>
                  <dd>{a.balanceRub != null ? `${a.balanceRub} ₽` : 'N/A (API)'}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-fg-subtle)]">Sync status</dt>
                  <dd>{a.lastSyncStatus ?? '—'}</dd>
                </div>
              </dl>
              {a.lastSyncError ? (
                <p className="text-xs text-[var(--color-danger)]">{a.lastSyncError}</p>
              ) : null}
              <Button size="sm" variant="secondary" onClick={() => sync.mutate(a.id)} disabled={sync.isPending}>
                Синхронизировать
              </Button>
            </Card>
          ))}
          {!accounts?.length ? (
            <Card className="p-6 text-sm text-[var(--color-fg-subtle)]">
              Подключите Avito-аккаунт в Marketplace → Accounts. Publication/Autoload — отдельный модуль.
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
