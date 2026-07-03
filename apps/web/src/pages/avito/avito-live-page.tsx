import { useMemo, useState } from 'react';
import { useAvitoAccounts } from '@/entities/avito/api';
import {
  useAvitoLiveDashboard,
  useAvitoLiveExplorer,
  useAvitoLiveHealth,
  useAvitoLiveInspector,
  useAvitoLiveOverview,
  useAvitoLiveScheduleUpdate,
  useAvitoLiveSync,
  useAvitoLiveTimeline,
  useAvitoLiveUsage,
  useAvitoLiveWebhookTest,
  useAvitoLiveWebhooks,
} from '@/entities/avito-live/api';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';
import type { AvitoExplorerNodeDto, AvitoSyncInterval, AvitoSyncWorkerStatus } from '@neeklo/contracts';
import { AVITO_SYNC_INTERVAL_SEC } from '@neeklo/contracts';

const TABS = [
  'Dashboard',
  'Explorer',
  'Overview',
  'API Usage',
  'Webhooks',
  'Timeline',
  'Inspector',
  'Health',
] as const;

type Tab = (typeof TABS)[number];

const INTERVALS = Object.keys(AVITO_SYNC_INTERVAL_SEC) as AvitoSyncInterval[];

function workerTone(s: AvitoSyncWorkerStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  if (s === 'completed') return 'success';
  if (s === 'running') return 'warning';
  if (s === 'failed') return 'danger';
  if (s === 'limited' || s === 'unavailable') return 'neutral';
  return 'neutral';
}

function healthTone(s: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (s === 'pass') return 'success';
  if (s === 'warn') return 'warning';
  if (s === 'fail') return 'danger';
  return 'neutral';
}

export function AvitoLivePage() {
  const { data: accounts, isLoading: accountsLoading } = useAvitoAccounts();
  const [accountId, setAccountId] = useState<string | undefined>();
  const activeId = accountId ?? accounts?.[0]?.id;
  const [tab, setTab] = useState<Tab>('Dashboard');

  const { data: dashboard, isLoading: dashLoading } = useAvitoLiveDashboard(activeId);
  const { data: overview } = useAvitoLiveOverview(activeId);
  const { data: explorer } = useAvitoLiveExplorer(activeId);
  const { data: usage } = useAvitoLiveUsage();
  const { data: webhooks } = useAvitoLiveWebhooks(activeId);
  const { data: timeline } = useAvitoLiveTimeline(activeId);
  const { data: inspector } = useAvitoLiveInspector(activeId);
  const { data: health } = useAvitoLiveHealth(activeId);

  const sync = useAvitoLiveSync();
  const schedule = useAvitoLiveScheduleUpdate();
  const webhookTest = useAvitoLiveWebhookTest();

  const accountOptions = useMemo(() => accounts ?? [], [accounts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avito Live Platform"
        description="Синхронизация, webhooks, read models. Только официальный Avito API — ограничения показаны явно."
        actions={
          activeId ? (
            <Button onClick={() => sync.mutate(activeId)} disabled={sync.isPending}>
              {sync.isPending ? 'Синхронизация…' : 'Полная синхронизация'}
            </Button>
          ) : null
        }
      />

      {accountsLoading ? (
        <Skeleton className="h-10 w-64" />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-[var(--color-fg-subtle)]">Аккаунт</label>
          <select
            className="rounded border px-3 py-1.5 text-sm bg-[var(--color-bg)]"
            value={activeId ?? ''}
            onChange={(e) => setAccountId(e.target.value || undefined)}
          >
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-t ${tab === t ? 'bg-[var(--color-bg-muted)] font-medium' : 'text-[var(--color-fg-subtle)]'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {!activeId ? (
        <Card className="p-6 text-sm">Подключите Avito аккаунт через OAuth Debug Center.</Card>
      ) : null}

      {tab === 'Dashboard' && activeId ? (
        dashLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="p-4">
                <p className="text-xs text-[var(--color-fg-subtle)]">Queue</p>
                <p className="text-2xl font-semibold">{dashboard?.queueDepth ?? 0}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-[var(--color-fg-subtle)]">Active worker</p>
                <p className="text-lg">{dashboard?.activeWorker ?? '—'}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-[var(--color-fg-subtle)]">Requests / hour</p>
                <p className="text-2xl font-semibold">{dashboard?.apiRequestsLastHour ?? 0}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-[var(--color-fg-subtle)]">Rate limit remaining</p>
                <p className="text-2xl font-semibold">{dashboard?.rateLimitRemaining ?? '—'}</p>
              </Card>
            </div>

            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[var(--color-fg-subtle)]">
                    <th className="p-3">Worker</th>
                    <th className="p-3">API</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Last / Next</th>
                    <th className="p-3">Latency</th>
                    <th className="p-3">Interval</th>
                    <th className="p-3">Retry</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard?.workers.map((w) => (
                    <tr key={w.worker} className="border-b">
                      <td className="p-3">
                        <div className="font-medium">{w.label}</div>
                        {w.limitation ? (
                          <div className="text-xs text-[var(--color-fg-subtle)]">{w.limitation}</div>
                        ) : null}
                      </td>
                      <td className="p-3 text-xs font-mono">{w.officialApi}</td>
                      <td className="p-3">
                        <Badge tone={workerTone(w.status)}>{w.status}</Badge>
                      </td>
                      <td className="p-3 text-xs">
                        <div>{w.lastSyncAt ? new Date(w.lastSyncAt).toLocaleString() : '—'}</div>
                        <div className="text-[var(--color-fg-subtle)]">
                          → {w.nextSyncAt ? new Date(w.nextSyncAt).toLocaleString() : '—'}
                        </div>
                      </td>
                      <td className="p-3">{w.latencyMs != null ? `${w.latencyMs}ms` : '—'}</td>
                      <td className="p-3">
                        <select
                          className="text-xs border rounded px-1 py-0.5"
                          value={INTERVALS.find((i) => AVITO_SYNC_INTERVAL_SEC[i] === w.intervalSec) ?? '5m'}
                          onChange={(e) =>
                            schedule.mutate({
                              accountId: activeId,
                              worker: w.worker,
                              interval: e.target.value as AvitoSyncInterval,
                            })
                          }
                        >
                          {INTERVALS.map((i) => (
                            <option key={i} value={i}>
                              {i}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">{w.retryCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )
      ) : null}

      {tab === 'Explorer' && explorer ? (
        <Card className="p-4">
          <ExplorerTree node={explorer} depth={0} />
        </Card>
      ) : null}

      {tab === 'Overview' && overview ? (
        <Card className="p-6 grid gap-4 md:grid-cols-2 text-sm">
          <Field label="Название" value={overview.displayName} />
          <Field label="Avito ID" value={overview.externalAccountId} />
          <Field label="Тип" value={overview.accountType} />
          <Field label="Компания" value={overview.companyName} />
          <Field label="Баланс" value={overview.balanceRub != null ? `${overview.balanceRub} ₽` : null} />
          <Field label="Телефон" value={overview.phone} />
          <Field label="Email" value={overview.email} />
          <Field label="Подключён" value={overview.connectedAt ? new Date(overview.connectedAt).toLocaleString() : null} />
          <Field label="Последний sync" value={overview.lastSyncAt ? new Date(overview.lastSyncAt).toLocaleString() : null} />
          <Field label="API Health" value={overview.apiHealth} />
          <Field label="Webhook" value={overview.webhookStatus} />
          <div className="md:col-span-2">
            <p className="text-[var(--color-fg-subtle)] mb-1">Ограничения API</p>
            {overview.limitations.length ? (
              <ul className="list-disc pl-5 space-y-1">
                {overview.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : (
              <p>—</p>
            )}
          </div>
        </Card>
      ) : null}

      {tab === 'API Usage' && usage ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4 space-y-2 text-sm">
            <Field label="Requests (hour)" value={String(usage.requestsLastHour)} />
            <Field label="Requests (day)" value={String(usage.requestsLastDay)} />
            <Field label="429 errors" value={String(usage.errors429)} />
            <Field label="Avg latency" value={`${usage.avgLatencyMs}ms`} />
            <Field label="Rate limit remaining" value={usage.rateLimitRemaining != null ? String(usage.rateLimitRemaining) : '—'} />
          </Card>
          <Card className="p-4">
            <h3 className="font-medium mb-2">Heaviest requests</h3>
            <ul className="text-xs space-y-2">
              {usage.heaviestRequests.map((h) => (
                <li key={`${h.method}-${h.url}`} className="font-mono">
                  {h.method} {h.url} — {h.count}× ({h.avgLatencyMs}ms avg)
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      {tab === 'Webhooks' && webhooks ? (
        <Card className="p-6 space-y-4 text-sm">
          <Field label="URL" value={webhooks.webhookUrl} />
          <Field label="Status" value={webhooks.status} />
          <Field label="Last received" value={webhooks.lastReceivedAt ? new Date(webhooks.lastReceivedAt).toLocaleString() : '—'} />
          <Field label="Last error" value={webhooks.lastError} />
          <Button size="sm" onClick={() => webhookTest.mutate(activeId!)} disabled={webhookTest.isPending}>
            Test webhook
          </Button>
          <div>
            <h3 className="font-medium mb-2">History</h3>
            <ul className="text-xs space-y-1">
              {webhooks.history.map((h, i) => (
                <li key={`${h.at}-${i}`}>
                  {new Date(h.at).toLocaleString()} — {h.eventType} {h.ok ? '✓' : '✕'}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ) : null}

      {tab === 'Timeline' && timeline ? (
        <Card className="p-4">
          <ul className="space-y-2 text-sm">
            {timeline.map((e) => (
              <li key={e.id} className="flex gap-3 border-b pb-2">
                <span className="text-xs text-[var(--color-fg-subtle)] w-36 shrink-0">
                  {new Date(e.at).toLocaleString()}
                </span>
                <Badge tone={e.kind === 'error' ? 'danger' : 'neutral'}>{e.kind}</Badge>
                <span className="font-medium">{e.title}</span>
                <span className="text-[var(--color-fg-subtle)]">{e.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {tab === 'Inspector' && inspector ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[var(--color-fg-subtle)]">
                <th className="p-3">Entity</th>
                <th className="p-3">Source</th>
                <th className="p-3">Received</th>
                <th className="p-3">Updated</th>
                <th className="p-3">Deleted</th>
                <th className="p-3">Version</th>
                <th className="p-3">Retry</th>
              </tr>
            </thead>
            <tbody>
              {inspector.map((r) => (
                <tr key={r.worker} className="border-b">
                  <td className="p-3">{r.entityType}</td>
                  <td className="p-3 text-xs font-mono">{r.source}</td>
                  <td className="p-3">{r.received}</td>
                  <td className="p-3">{r.updated}</td>
                  <td className="p-3">{r.deleted}</td>
                  <td className="p-3">{r.version}</td>
                  <td className="p-3">{r.retryCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === 'Health' && health ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(health).map(([key, val]) => (
            <Card key={key} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium capitalize">{key}</span>
                <Badge tone={healthTone(typeof val === 'object' && 'status' in val ? val.status : 'pass')}>
                  {typeof val === 'object' && 'status' in val ? val.status : 'pass'}
                </Badge>
              </div>
              <p className="text-xs text-[var(--color-fg-subtle)]">
                {'message' in val && val.message
                  ? val.message
                  : JSON.stringify(val, null, 0).slice(0, 120)}
              </p>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[var(--color-fg-subtle)] text-xs">{label}</dt>
      <dd className="font-medium">{value ?? '—'}</dd>
    </div>
  );
}

function ExplorerTree({ node, depth }: { node: AvitoExplorerNodeDto; depth: number }) {
  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <div className="flex items-center gap-2 py-1">
        <Badge tone={workerTone(node.status)}>{node.status}</Badge>
        <span>{node.label}</span>
        {node.count != null ? <span className="text-xs text-[var(--color-fg-subtle)]">({node.count})</span> : null}
      </div>
      {node.children?.map((c) => (
        <ExplorerTree key={c.id} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}
