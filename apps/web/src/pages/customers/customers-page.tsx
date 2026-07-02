import { useState } from 'react';
import { useCustomers, useCustomer360 } from '@/entities/commerce/api';
import { useCopilotPage } from '@/widgets/copilot/copilot-context';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { Card } from '@/shared/ui/card';
import { PageHeader } from '@/widgets/page-header/page-header';
import { formatPercent } from '@/shared/lib/format';

export function CustomersPage() {
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: customers, isLoading } = useCustomers(q || undefined);
  const { data: profile, isLoading: profileLoading } = useCustomer360(selectedId);

  useCopilotPage('customers', {
    title: profile?.displayName ?? 'Customer 360',
    entityType: 'customer',
    entityId: selectedId ?? undefined,
    summary: profile ? `AI ${Math.round(profile.aiScore)} · ${profile.totalDeals} deals` : `${customers?.length ?? 0} customers`,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Customer 360" description="Полный профиль клиента: контакты, интересы, сделки, AI Score." />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="p-4">
          <Input placeholder="Поиск клиентов…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4" />
          <div className="space-y-1">
            {isLoading && [...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 rounded-[var(--radius-md)]" />)}
            {customers?.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`w-full rounded-[var(--radius-md)] px-3 py-2.5 text-left transition hover:bg-[var(--color-surface-hover)] ${selectedId === c.id ? 'bg-[var(--color-surface)]' : ''}`}
              >
                <div className="font-medium">{c.displayName}</div>
                <div className="text-xs text-[var(--color-fg-subtle)]">{c.channel} · AI {Math.round(c.aiScore)}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="min-h-[480px] p-6">
          {profileLoading && <Skeleton className="h-full min-h-[400px]" />}
          {profile && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">{profile.displayName}</h2>
                <p className="text-sm text-[var(--color-fg-subtle)]">{profile.phone ?? profile.email ?? '—'}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Stat label="AI Score" value={Math.round(profile.aiScore).toString()} />
                <Stat label="Вероятность покупки" value={formatPercent(profile.purchaseProbability)} />
                <Stat label="Сделок" value={String(profile.totalDeals)} />
              </div>
              {profile.interests?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((i: string) => (
                    <Badge key={i} tone="info">{i}</Badge>
                  ))}
                </div>
              )}
              {profile.aiSummary && (
                <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 text-sm hairline">
                  <div className="mb-2 text-xs font-medium text-[var(--color-fg-subtle)]">AI Summary</div>
                  {profile.aiSummary}
                </div>
              )}
            </div>
          )}
          {!selectedId && !profileLoading && (
            <p className="flex h-full items-center justify-center text-sm text-[var(--color-fg-subtle)]">Выберите клиента</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 hairline">
      <div className="text-xs text-[var(--color-fg-subtle)]">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
