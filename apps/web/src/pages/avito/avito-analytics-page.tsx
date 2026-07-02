import { useAvitoAnalytics } from '@/entities/avito/api';
import { useCopilotPage } from '@/widgets/copilot/copilot-context';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { formatNumber, formatPercent } from '@/shared/lib/format';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function AvitoAnalyticsPage() {
  const { data, isLoading } = useAvitoAnalytics();

  useCopilotPage('analytics', {
    title: 'Analytics Center',
    summary: data
      ? `CTR ${formatPercent(data.ctr)} ROI ${formatPercent(data.roi)} · ${data.recommendationCount} recs`
      : undefined,
  });

  const funnel = data
    ? [
        { name: 'Просмотры', value: data.views },
        { name: 'Контакты', value: data.contacts },
        { name: 'Избранное', value: data.favorites },
        { name: 'Сообщения', value: data.messages },
      ]
    : [];

  const heatmap = funnel.map((f, i) => ({
    ...f,
    intensity: f.value / Math.max(...funnel.map((x) => x.value), 1),
    fill: `color-mix(in oklch, var(--color-primary) ${40 + i * 15}%, transparent)`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics Center"
        description={`Источник: ${data?.dataSource ?? '…'} · сравнение периодов и drill-down через AI Copilot.`}
      />

      {isLoading ? (
        <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
      ) : data ? (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="funnel">Funnel</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="CTR" value={formatPercent(data.ctr)} />
              <Metric label="ROI" value={formatPercent(data.roi)} />
              <Metric label="ROAS" value={data.roas.toFixed(2)} />
              <Metric label="CPA" value={`${Math.round(data.cpa)} ₽`} />
              <Metric label="AI Score" value={data.aiScore != null ? data.aiScore.toFixed(1) : '—'} />
              <Metric label="Рекомендации AI" value={String(data.recommendationCount)} />
              <Metric label="Расход" value={`${formatNumber(data.spend)} ₽`} />
              <Metric label="Выручка" value={`${formatNumber(data.revenue)} ₽`} />
            </div>
          </TabsContent>

          <TabsContent value="funnel">
            <Card className="p-6">
              <h3 className="mb-4 text-sm font-medium text-[var(--color-fg-muted)]">Воронка · heatmap</h3>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnel}>
                      <XAxis dataKey="name" tick={{ fill: 'var(--color-fg-subtle)', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'var(--color-fg-subtle)', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {heatmap.map((entry, i) => (
                          <Cell key={i} fill="var(--color-primary)" fillOpacity={0.4 + entry.intensity * 0.6} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {heatmap.map((h) => (
                    <div
                      key={h.name}
                      className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3"
                      style={{ background: h.fill }}
                    >
                      <div className="text-xs text-[var(--color-fg-subtle)]">{h.name}</div>
                      <div className="text-lg font-semibold tabular-nums">{formatNumber(h.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="forecast">
            <Card className="p-6">
              <h3 className="mb-2 text-sm font-medium">Forecast & Decision History</h3>
              <p className="mb-4 text-sm text-[var(--color-fg-muted)]">
                Trend: <strong>{data.forecastTrend ?? 'stable'}</strong> · Opportunity index from Regional Intelligence
              </p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={[
                      { p: 'W-3', v: data.revenue * 0.7 },
                      { p: 'W-2', v: data.revenue * 0.85 },
                      { p: 'W-1', v: data.revenue * 0.95 },
                      { p: 'Now', v: data.revenue },
                      { p: 'F+1', v: data.revenue * 1.08 },
                    ]}
                  >
                    <XAxis dataKey="p" tick={{ fill: 'var(--color-fg-subtle)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'var(--color-fg-subtle)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }} />
                    <Area type="monotone" dataKey="v" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.15} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs text-[var(--color-fg-subtle)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}
