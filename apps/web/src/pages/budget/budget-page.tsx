import { useAvitoAnalytics, useBudgetImport } from '@/entities/avito/api';
import { useBudget } from '@/entities/commerce/api';
import { useCopilotPage } from '@/widgets/copilot/copilot-context';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { formatMoney, formatPercent } from '@/shared/lib/format';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useState } from 'react';

export function BudgetPage() {
  const { data, isLoading } = useBudget();
  const { data: analytics } = useAvitoAnalytics();
  const importBudget = useBudgetImport();
  const [importAmount, setImportAmount] = useState('');

  useCopilotPage('budget', {
    title: 'Budget Center',
    summary: data ? `Spend ${data.totalSpend} ROI ${data.roi}` : undefined,
  });

  const chartData = data?.byRegion?.slice(0, 10) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Budget Center" description="ROI · ROAS · CPA · Forecast · AI recommendations · manual import." />

      {isLoading ? (
        <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard label="Бюджет" value={formatMoney(data.budgetTotal)} />
            <MetricCard label="Расход" value={formatMoney(data.totalSpend)} />
            <MetricCard label="ROI" value={formatPercent(data.roi)} />
            <MetricCard label="ROAS" value={data.roas.toFixed(2)} />
            <MetricCard label="CPA" value={formatMoney(analytics?.cpa ?? 0)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-6 lg:col-span-2">
              <h3 className="mb-4 text-sm font-medium text-[var(--color-fg-muted)]">Расходы по регионам</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="spend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="regionId" tick={{ fill: 'var(--color-fg-subtle)', fontSize: 10 }} />
                    <YAxis tick={{ fill: 'var(--color-fg-subtle)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }} />
                    <Area type="monotone" dataKey="spend" stroke="var(--color-primary)" fill="url(#spend)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="space-y-4 p-6">
              <h3 className="text-sm font-medium">Manual import</h3>
              <p className="text-xs text-[var(--color-fg-subtle)]">Когда Avito billing API недоступен</p>
              <Input
                type="number"
                placeholder="Сумма расхода"
                value={importAmount}
                onChange={(e) => setImportAmount(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  importBudget.mutate({ amount: Number(importAmount), category: 'promotion', note: 'manual import' })
                }
                disabled={!importAmount || importBudget.isPending}
              >
                Импортировать
              </Button>
              {analytics?.recommendationCount ? (
                <p className="text-xs text-[var(--color-primary)]">
                  AI: {analytics.recommendationCount} рекомендаций по бюджету
                </p>
              ) : null}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs text-[var(--color-fg-subtle)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}
