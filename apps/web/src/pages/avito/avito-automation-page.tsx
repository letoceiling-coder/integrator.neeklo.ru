import { useState } from 'react';
import type { AvitoAutomationRuleUpsertDto, AvitoNotificationPolicyUpsertDto } from '@neeklo/contracts';
import {
  useAvitoAutomationContent,
  useAvitoAutomationCreateWatcher,
  useAvitoAutomationEvaluateWatchers,
  useAvitoAutomationExecutive,
  useAvitoAutomationGeneratePrice,
  useAvitoAutomationGenerateReport,
  useAvitoAutomationLatestReport,
  useAvitoAutomationNotificationPolicies,
  useAvitoAutomationObservatory,
  useAvitoAutomationOpportunities,
  useAvitoAutomationPrice,
  useAvitoAutomationReports,
  useAvitoAutomationRules,
  useAvitoAutomationRunAll,
  useAvitoAutomationScanOpportunities,
  useAvitoAutomationUpsertNotificationPolicy,
  useAvitoAutomationUpsertRule,
  useAvitoAutomationWatchers,
} from '@/entities/avito-automation/api';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { formatPercent } from '@/shared/lib/format';

const SECTIONS = [
  'AI Observatory',
  'Watchers',
  'Automation Rules',
  'Opportunities',
  'Price Intelligence',
  'Content Intelligence',
  'Notification Policies',
  'AI Reports',
  'Executive AI',
] as const;

type Section = (typeof SECTIONS)[number];

export function AvitoAutomationPage() {
  const [section, setSection] = useState<Section>('AI Observatory');
  const [newWatcherName, setNewWatcherName] = useState('CTR Monitor');

  const { data: observatory, isLoading: obsLoading } = useAvitoAutomationObservatory();
  const { data: watchers, isLoading: watchLoading } = useAvitoAutomationWatchers();
  const { data: rules } = useAvitoAutomationRules();
  const { data: opportunities } = useAvitoAutomationOpportunities();
  const { data: priceRecs } = useAvitoAutomationPrice();
  const { data: contentRecs } = useAvitoAutomationContent();
  const { data: policies } = useAvitoAutomationNotificationPolicies();
  const { data: reports } = useAvitoAutomationReports();
  const { data: latestReport } = useAvitoAutomationLatestReport();
  const { data: executive } = useAvitoAutomationExecutive();

  const createWatcher = useAvitoAutomationCreateWatcher();
  const evaluateWatchers = useAvitoAutomationEvaluateWatchers();
  const upsertRule = useAvitoAutomationUpsertRule();
  const upsertPolicy = useAvitoAutomationUpsertNotificationPolicy();
  const runAll = useAvitoAutomationRunAll();
  const generateReport = useAvitoAutomationGenerateReport();
  const generatePrice = useAvitoAutomationGeneratePrice();
  const scanOpps = useAvitoAutomationScanOpportunities();

  return (
    <div className="space-y-4 pb-8">
      <PageHeader
        title="AI Automation Platform"
        description="Business Intelligence Center — Watchers, Rules, Observatory, Executive AI. Recommendations only."
        actions={
          <Button size="sm" onClick={() => runAll.mutate()} disabled={runAll.isPending}>
            Run All Engines
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1 border-b pb-2 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSection(s)}
            className={`px-3 py-1.5 text-sm whitespace-nowrap rounded-t ${section === s ? 'bg-[var(--color-bg-muted)] font-medium' : 'text-[var(--color-fg-subtle)]'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {section === 'AI Observatory' && (
        obsLoading ? <Skeleton className="h-64" /> : (
          <div className="grid gap-4 md:grid-cols-5 mb-4">
            {observatory?.counts && Object.entries(observatory.counts).map(([k, v]) => (
              <Card key={k} className="p-3 text-center">
                <p className="text-xs text-[var(--color-fg-subtle)]">{k}</p>
                <p className="text-xl font-semibold">{v}</p>
              </Card>
            ))}
          </div>
        )
      )}
      {section === 'AI Observatory' && !obsLoading && (
        <Card className="p-4 space-y-2">
          {observatory?.items.map((item) => (
            <div key={item.id} className="border-b pb-2 text-sm">
              <div className="flex gap-2 items-center mb-1">
                <Badge tone={item.severity === 'critical' ? 'danger' : item.severity === 'warning' ? 'warning' : 'neutral'}>{item.kind}</Badge>
                <span className="font-medium">{item.title}</span>
                <span className="text-xs text-[var(--color-fg-subtle)] ml-auto">{item.source}</span>
              </div>
              <p className="text-[var(--color-fg-subtle)]">{item.body}</p>
            </div>
          ))}
          {!observatory?.items.length ? <p className="text-sm text-[var(--color-fg-subtle)]">Нет сигналов — запустите Run All Engines</p> : null}
        </Card>
      )}

      {section === 'Watchers' && (
        watchLoading ? <Skeleton className="h-64" /> : (
          <Card className="p-4">
            <div className="flex gap-2 mb-4">
              <Input value={newWatcherName} onChange={(e) => setNewWatcherName(e.target.value)} placeholder="Watcher name" className="max-w-xs" />
              <Button size="sm" onClick={() => createWatcher.mutate({ name: newWatcherName, metric: 'ctr' })}>+ Watcher</Button>
              <Button size="sm" variant="secondary" onClick={() => evaluateWatchers.mutate()}>Evaluate</Button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-[var(--color-fg-subtle)]"><th className="p-2">Name</th><th className="p-2">Metric</th><th className="p-2">Status</th><th className="p-2">Value</th><th className="p-2">Forecast</th></tr></thead>
              <tbody>
                {watchers?.map((w) => (
                  <tr key={w.id} className="border-b">
                    <td className="p-2">{w.name}</td>
                    <td className="p-2"><Badge tone="neutral">{w.metric}</Badge></td>
                    <td className="p-2">{w.lastStatus ?? '—'}</td>
                    <td className="p-2">{w.lastValue?.toFixed(2) ?? '—'}</td>
                    <td className="p-2">{w.lastForecast ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      )}

      {section === 'Automation Rules' && (
        <Card className="p-4 space-y-3">
          <Button size="sm" onClick={() => {
            const body: AvitoAutomationRuleUpsertDto = {
              name: 'CTR drop alert',
              metric: 'ctr',
              operator: 'drop_pct',
              threshold: 30,
              actionType: 'recommendation',
              requiresConfirmation: true,
            };
            upsertRule.mutate(body);
          }}>+ Default CTR Rule</Button>
          <ul className="space-y-2 text-sm">
            {rules?.map((r) => (
              <li key={r.id} className="border-b pb-2">
                <strong>{r.name}</strong> — {r.metric} {r.operator} {r.threshold} → {r.actionType}
                {r.requiresConfirmation ? <Badge tone="info" className="ml-2">confirm</Badge> : null}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {section === 'Opportunities' && (
        <Card className="p-4">
          <Button size="sm" className="mb-3" onClick={() => scanOpps.mutate()}>Scan Daily</Button>
          <ul className="space-y-2 text-sm">
            {opportunities?.map((o) => (
              <li key={o.id} className="border-b pb-2">
                <Badge tone="success">{o.score.toFixed(0)}</Badge> {o.kind}: {o.reason}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {section === 'Price Intelligence' && (
        <Card className="p-4">
          <Button size="sm" className="mb-3" onClick={() => generatePrice.mutate()}>Generate Recommendations</Button>
          <p className="text-xs text-[var(--color-fg-subtle)] mb-3">Только рекомендации — без автоматического изменения цен.</p>
          <ul className="space-y-2 text-sm">
            {priceRecs?.map((p) => (
              <li key={p.id} className="border-b pb-2">
                <strong>{p.adTitle}</strong> — {p.direction} {p.currentPrice} → {p.suggestedPrice}
                <Badge tone="neutral" className="ml-2">{formatPercent(p.confidence)}</Badge>
                <p className="text-[var(--color-fg-subtle)]">{p.reason}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {section === 'Content Intelligence' && (
        <Card className="p-4">
          <ul className="space-y-2 text-sm">
            {contentRecs?.map((c) => (
              <li key={c.id} className="border-b pb-2">
                <Badge tone="neutral">{c.field}</Badge> {c.adTitle}: {c.suggestion.slice(0, 120)}…
                <span className="ml-2 text-xs">score {c.score.toFixed(0)}</span>
              </li>
            ))}
            {!contentRecs?.length ? <p className="text-[var(--color-fg-subtle)]">Запустите Run All для анализа топ объявлений</p> : null}
          </ul>
        </Card>
      )}

      {section === 'Notification Policies' && (
        <Card className="p-4 space-y-3">
          <Button size="sm" onClick={() => {
            const body: AvitoNotificationPolicyUpsertDto = {
              name: 'AI only',
              channels: ['in_app', 'telegram'],
              filters: ['ai'],
            };
            upsertPolicy.mutate(body);
          }}>+ AI Policy</Button>
          <ul className="text-sm space-y-2">
            {policies?.map((p) => (
              <li key={p.id}>{p.name} — {p.channels.join(', ')} · {p.filters.join(', ')}</li>
            ))}
          </ul>
        </Card>
      )}

      {section === 'AI Reports' && (
        <Card className="p-4 space-y-3">
          <Button size="sm" onClick={() => generateReport.mutate()}>Generate Morning Report</Button>
          {(latestReport ?? reports?.[0]) && (
            <div className="text-sm space-y-2">
              <p className="font-medium">{(latestReport ?? reports?.[0])?.summary}</p>
              <ul>{(latestReport ?? reports?.[0])?.todayActions.map((a) => <li key={a}>{a}</li>)}</ul>
            </div>
          )}
        </Card>
      )}

      {section === 'Executive AI' && executive && (
        <Card className="p-4 space-y-4">
          <p className="text-lg font-medium">{executive.summary}</p>
          <p className="text-sm">{executive.plainLanguage}</p>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div><h3 className="font-medium mb-2">Highlights</h3><ul>{executive.highlights.map((h) => <li key={h}>{h}</li>)}</ul></div>
            <div><h3 className="font-medium mb-2">Risks</h3><ul>{executive.risks.map((r) => <li key={r}>{r}</li>)}</ul></div>
            <div><h3 className="font-medium mb-2">Opportunities</h3><ul>{executive.opportunities.map((o) => <li key={o}>{o}</li>)}</ul></div>
          </div>
        </Card>
      )}
    </div>
  );
}
