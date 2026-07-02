import { useTimeline } from '@/entities/commerce/api';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';

export function HistoryPage() {
  const { data: events, isLoading } = useTimeline();

  return (
    <div className="space-y-6">
      <PageHeader title="Activity Timeline" description="Единая лента событий: сообщения, сделки, решения AI, автоматизации." />
      <Card className="p-2">
        {isLoading && [...Array(8)].map((_, i) => <Skeleton key={i} className="m-3 h-12 rounded-[var(--radius-md)]" />)}
        <div className="relative ml-4 border-l border-[var(--color-border)] pl-6">
          {events?.map((e: { id: string; type: string; occurredAt: string; aggregateType: string }) => (
            <div key={e.id} className="relative mb-6 last:mb-2">
              <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-primary)] ring-4 ring-[var(--color-bg-elevated)]" />
              <div className="text-sm font-medium">{e.type}</div>
              <div className="text-xs text-[var(--color-fg-subtle)]">
                {e.aggregateType} · {new Date(e.occurredAt).toLocaleString('ru-RU')}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
