import { useEffect, useState } from 'react';
import { useAvitoAnalytics, useAvitoDashboard } from '@/entities/avito/api';
import { useBudget } from '@/entities/commerce/api';
import { useAds } from '@/entities/ad/api';
import { useAiRun } from '@/entities/ai/api';
import { useCopilotPage } from '@/widgets/copilot/copilot-context';
import { Card } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function ExecutivePage() {
  const { data: analytics } = useAvitoAnalytics();
  const { data: dash } = useAvitoDashboard();
  const { data: budget } = useBudget();
  const { data: ads } = useAds({ limit: 200 });
  const report = useAiRun();
  const [reportText, setReportText] = useState<string | null>(null);

  useCopilotPage('executive', {
    title: 'Executive Mode',
    summary: `ROI ${analytics?.roi ?? 0}, revenue ${budget?.totalRevenue ?? 0}`,
  });

  useEffect(() => {
    if (reportText || report.isPending) return;
    report.mutate(
      {
        taskType: 'analytics',
        input: `Executive report (Russian): KPIs, risks, opportunities. ROI ${analytics?.roi}, ROAS ${analytics?.roas}, accounts ${dash?.accounts}, knowledge docs ${dash?.knowledgeDocs}`,
        skillIds: ['analytics'],
      },
      { onSuccess: (r) => setReportText(r.output) },
    );
  }, [reportText, report, analytics, dash, budget]);

  const chartData =
    ads?.items?.slice(0, 12).map((a, i) => ({
      name: `#${i + 1}`,
      revenue: a.metrics.revenue.amount,
      spend: a.metrics.spend.amount,
    })) ?? [];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] space-y-6 bg-[var(--color-bg)] p-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Executive Mode</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-subtle)]">KPI владельца бизнеса · AI Report · Forecast · Risks</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ExecKpi label="Выручка" value={formatMoney(budget?.totalRevenue ?? analytics?.revenue ?? 0)} />
        <ExecKpi label="ROI" value={formatPercent(analytics?.roi ?? budget?.roi ?? 0)} />
        <ExecKpi label="ROAS" value={(analytics?.roas ?? budget?.roas ?? 0).toFixed(2)} />
        <ExecKpi label="Контакты" value={formatNumber(analytics?.contacts ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-4 text-sm font-medium">Revenue vs Spend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-success)" fill="var(--color-success)" fillOpacity={0.15} />
                <Area type="monotone" dataKey="spend" stroke="var(--color-danger)" fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 text-sm font-medium">AI Executive Report</h3>
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--color-fg-muted)]">
            {reportText ?? (report.isPending ? <Skeleton className="h-40" /> : '…')}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="mb-3 text-sm font-medium">Opportunity & Risks</h3>
        <dl className="grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-[var(--color-fg-subtle)]">AI Recommendations</dt>
            <dd className="text-xl font-semibold">{analytics?.recommendationCount ?? 0}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-fg-subtle)]">Forecast trend</dt>
            <dd className="text-xl font-semibold capitalize">{analytics?.forecastTrend ?? 'stable'}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-fg-subtle)]">Connected accounts</dt>
            <dd className="text-xl font-semibold">{dash?.accounts ?? 0}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

function ExecKpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs text-[var(--color-fg-subtle)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}
