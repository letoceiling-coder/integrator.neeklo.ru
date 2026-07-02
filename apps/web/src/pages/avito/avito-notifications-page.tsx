import { useAvitoNotifications, useMediaAssets } from '@/entities/avito/api';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';

export function AvitoNotificationsPage() {
  const { data: notifications, isLoading } = useAvitoNotifications(true);
  const { data: assets } = useMediaAssets();

  return (
    <div className="space-y-6">
      <PageHeader title="Notification Center" description="In-app + Telegram/MAX/Email (stub channels)." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-4 text-sm font-medium">Непрочитанные</h3>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <ul className="space-y-3 text-sm">
              {notifications?.map((n: { id: string; title: string; body: string; createdAt: string }) => (
                <li key={n.id} className="rounded border border-[var(--color-border)] p-3">
                  <div className="font-medium">{n.title}</div>
                  <div className="text-[var(--color-fg-subtle)]">{n.body}</div>
                </li>
              ))}
              {!notifications?.length ? <p className="text-[var(--color-fg-subtle)]">Нет уведомлений</p> : null}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 text-sm font-medium">Media assets (Selectel)</h3>
          <ul className="space-y-2 text-xs font-mono">
            {assets?.slice(0, 8).map((a: { id: string; kind: string; publicUrl: string }) => (
              <li key={a.id} className="truncate">
                {a.kind}: {a.publicUrl}
              </li>
            ))}
            {!assets?.length ? <p className="font-sans text-sm text-[var(--color-fg-subtle)]">Нет медиа</p> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
