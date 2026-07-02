import { DealStage } from '@neeklo/contracts';
import { useDealsPipeline } from '@/entities/commerce/api';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';
import { Card } from '@/shared/ui/card';
import { PageHeader } from '@/widgets/page-header/page-header';
import { formatMoney } from '@/shared/lib/format';

const STAGE_LABEL: Record<string, string> = {
  [DealStage.LEAD]: 'Lead',
  [DealStage.INTERESTED]: 'Interested',
  [DealStage.NEGOTIATION]: 'Negotiation',
  [DealStage.OFFER]: 'Offer',
  [DealStage.RESERVED]: 'Reserved',
  [DealStage.PAID]: 'Paid',
  [DealStage.COMPLETED]: 'Completed',
  [DealStage.CANCELLED]: 'Cancelled',
};

export function DealsPage() {
  const { data: pipeline, isLoading } = useDealsPipeline();

  return (
    <div className="space-y-6">
      <PageHeader title="Deal Pipeline" description="Воронка сделок с AI-предложениями смены стадии." />

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-[var(--radius-lg)]" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {pipeline?.filter((col) => col.stage !== DealStage.CANCELLED && col.stage !== DealStage.COMPLETED).map((col) => (
            <Card key={col.stage} className="flex w-72 shrink-0 flex-col">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                <span className="text-sm font-medium">{STAGE_LABEL[col.stage] ?? col.stage}</span>
                <Badge tone="neutral">{col.count}</Badge>
              </div>
              <div className="flex-1 space-y-2 p-3">
                {col.deals.map((deal) => (
                  <div key={deal.id} className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-3 hairline">
                    <div className="font-medium text-sm">{deal.customerName}</div>
                    <div className="mt-1 text-xs text-[var(--color-fg-subtle)]">{deal.adTitle ?? '—'}</div>
                    <div className="mt-2 text-sm tabular-nums">{formatMoney(deal.expectedAmount as number)}</div>
                    {deal.aiSuggestedStage && (
                      <Badge tone="info" className="mt-2">
                        AI → {STAGE_LABEL[deal.aiSuggestedStage]}
                      </Badge>
                    )}
                  </div>
                ))}
                {col.deals.length === 0 && (
                  <p className="py-8 text-center text-xs text-[var(--color-fg-subtle)]">Пусто</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
