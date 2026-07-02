import { useAiCost, useAiDashboard, useAiRuns, useAiObservability } from '@/entities/ai/api';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function AiCostPage() {
  const { data: cost, isLoading: costLoading } = useAiCost();
  const { data: dashboard } = useAiDashboard();
  const { data: runs, isLoading: runsLoading } = useAiRuns(10);
  const { data: health } = useAiObservability();

  return (
    <div className="space-y-6">
      <PageHeader title="AI Cost Center" description="Стоимость по моделям, агентам и pipeline." />

      {costLoading ? (
        <Skeleton className="h-48 rounded-[var(--radius-lg)]" />
      ) : cost ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Всего USD" value={`$${cost.totalCostUsd.toFixed(4)}`} />
            <MetricCard label="Runs" value={String(cost.runCount)} />
            <MetricCard label="Tokens in" value={cost.totalTokensIn.toLocaleString()} />
            <MetricCard label="Tokens out" value={cost.totalTokensOut.toLocaleString()} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <h3 className="mb-4 text-sm font-medium text-[var(--color-fg-muted)]">По моделям</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cost.byModel}>
                    <XAxis dataKey="model" tick={{ fill: 'var(--color-fg-subtle)', fontSize: 10 }} />
                    <YAxis tick={{ fill: 'var(--color-fg-subtle)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }} />
                    <Bar dataKey="costUsd" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="mb-4 text-sm font-medium text-[var(--color-fg-muted)]">Pipeline health</h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-[var(--color-fg-subtle)]">Runs 24h</dt>
                  <dd className="text-xl font-semibold">{health?.runs24h ?? dashboard?.health.runs24h ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-fg-subtle)]">Avg latency</dt>
                  <dd className="text-xl font-semibold">{health?.avgLatencyMs ?? dashboard?.health.avgLatencyMs ?? '—'} ms</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-fg-subtle)]">Error rate</dt>
                  <dd className="text-xl font-semibold">
                    {((health?.errorRate ?? dashboard?.health.errorRate ?? 0) * 100).toFixed(1)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--color-fg-subtle)]">Agents</dt>
                  <dd className="text-xl font-semibold">{dashboard?.agents ?? '—'}</dd>
                </div>
              </dl>
            </Card>
          </div>
        </>
      ) : null}

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-medium text-[var(--color-fg-muted)]">Последние runs</h3>
        {runsLoading ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-fg-subtle)]">
                  <th className="pb-2 pr-4">Task</th>
                  <th className="pb-2 pr-4">Model</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Cost</th>
                  <th className="pb-2">Latency</th>
                </tr>
              </thead>
              <tbody>
                {runs?.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--color-border)]">
                    <td className="py-2 pr-4">{r.taskType}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.model}</td>
                    <td className="py-2 pr-4">{r.status}</td>
                    <td className="py-2 pr-4 tabular-nums">${r.costUsd.toFixed(4)}</td>
                    <td className="py-2 tabular-nums">{r.latencyMs ?? '—'} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
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
