import { useState } from 'react';
import type { AvitoRuntimeMode } from '@neeklo/contracts';
import { useAvitoAccounts } from '@/entities/avito/api';
import {
  useAvitoProductionBackupExport,
  useAvitoProductionFeedValidate,
  useAvitoProductionLiveTest,
  useAvitoProductionMode,
  useAvitoProductionMonitor,
  useAvitoProductionPermissions,
  useAvitoProductionReadiness,
  useAvitoProductionSetMode,
  useAvitoProductionWizard,
  useAvitoProductionWizardStep,
} from '@/entities/avito-production/api';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';

const SECTIONS = ['Production Readiness', 'Monitor', 'Sandbox / Production', 'Permissions', 'Installation Wizard', 'Feed', 'Live Test', 'Backup'] as const;
type Section = (typeof SECTIONS)[number];

export function AvitoProductionPage() {
  const { data: accounts } = useAvitoAccounts();
  const [accountId, setAccountId] = useState<string | undefined>();
  const activeAccountId = accountId ?? accounts?.[0]?.id;
  const [section, setSection] = useState<Section>('Production Readiness');

  const { data: readiness, isLoading } = useAvitoProductionReadiness(activeAccountId);
  const { data: monitor } = useAvitoProductionMonitor(activeAccountId);
  const { data: mode } = useAvitoProductionMode();
  const { data: permissions } = useAvitoProductionPermissions(activeAccountId);
  const { data: wizard } = useAvitoProductionWizard();
  const { data: feedValidate } = useAvitoProductionFeedValidate(activeAccountId);
  const setMode = useAvitoProductionSetMode();
  const wizardStep = useAvitoProductionWizardStep();
  const backupExport = useAvitoProductionBackupExport();
  const liveTest = useAvitoProductionLiveTest();

  return (
    <div className="space-y-4 pb-8">
      <PageHeader
        title="Production Readiness"
        description="Enterprise Release Candidate — health, monitor, sandbox mode, installation wizard."
      />

      <select className="border rounded px-2 py-1 text-sm" value={activeAccountId ?? ''} onChange={(e) => setAccountId(e.target.value)}>
        {accounts?.map((a) => (
          <option key={a.id} value={a.id}>{a.displayName}</option>
        ))}
      </select>

      <div className="flex flex-wrap gap-1 border-b pb-2 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button key={s} type="button" onClick={() => setSection(s)} className={`px-3 py-1.5 text-sm whitespace-nowrap rounded-t ${section === s ? 'bg-[var(--color-bg-muted)] font-medium' : 'text-[var(--color-fg-subtle)]'}`}>
            {s}
          </button>
        ))}
      </div>

      {section === 'Production Readiness' && (
        isLoading ? <Skeleton className="h-64" /> : (
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <Badge tone={readiness?.ready ? 'success' : 'warning'}>{readiness?.ready ? 'READY' : 'NOT READY'}</Badge>
              <span className="text-2xl font-semibold">{readiness?.score ?? 0}%</span>
              <span className="text-sm text-[var(--color-fg-subtle)]">Mode: {readiness?.mode}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {readiness?.items.map((item) => (
                <div key={item.id} className="flex gap-2 text-sm border-b pb-2">
                  <Badge tone={item.status === 'pass' ? 'success' : item.status === 'fail' ? 'danger' : 'warning'}>{item.status}</Badge>
                  <div><strong>{item.label}</strong><p className="text-[var(--color-fg-subtle)]">{item.message}</p></div>
                </div>
              ))}
            </div>
          </Card>
        )
      )}

      {section === 'Monitor' && monitor && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4"><p className="text-xs text-[var(--color-fg-subtle)]">Errors 24h</p><p className="text-xl font-semibold">{monitor.errors24h}</p></Card>
          <Card className="p-4"><p className="text-xs text-[var(--color-fg-subtle)]">Latency avg</p><p className="text-xl font-semibold">{monitor.avgLatencyMs}ms</p></Card>
          <Card className="p-4"><p className="text-xs text-[var(--color-fg-subtle)]">429</p><p className="text-xl font-semibold">{monitor.rateLimit429}</p></Card>
          <Card className="p-4"><p className="text-xs text-[var(--color-fg-subtle)]">Sync lag</p><p className="text-xl font-semibold">{monitor.syncLagSec ?? '—'}s</p></Card>
          <Card className="p-4 md:col-span-2"><h3 className="font-medium mb-2">Workers</h3>{monitor.workers.map((w) => <div key={w.name} className="text-sm flex justify-between"><span>{w.name}</span><Badge tone="neutral">{w.status}</Badge></div>)}</Card>
        </div>
      )}

      {section === 'Sandbox / Production' && (
        <Card className="p-4 space-y-3">
          <p className="text-sm">Current: <Badge tone="info">{mode ?? 'sandbox'}</Badge></p>
          <div className="flex gap-2">
            <Button size="sm" variant={mode === 'sandbox' ? 'primary' : 'secondary'} onClick={() => setMode.mutate({ mode: 'sandbox' as AvitoRuntimeMode })}>Sandbox</Button>
            <Button size="sm" variant={mode === 'production' ? 'primary' : 'secondary'} onClick={() => setMode.mutate({ mode: 'production' as AvitoRuntimeMode })}>Production</Button>
          </div>
          <p className="text-xs text-[var(--color-fg-subtle)]">Sandbox: OAuth/webhook/feed тесты без отправки в Avito. Production: реальный Messenger API.</p>
        </Card>
      )}

      {section === 'Permissions' && permissions && (
        <Card className="p-4">
          <p className="text-sm mb-2">Tariff: {permissions.tariff}</p>
          <ul className="space-y-1 text-sm">{permissions.permissions.map((p) => (
            <li key={p.scope}><Badge tone={p.available ? 'success' : 'danger'}>{p.granted ? 'granted' : 'missing'}</Badge> {p.scope} — {p.message}</li>
          ))}</ul>
        </Card>
      )}

      {section === 'Installation Wizard' && wizard && (
        <Card className="p-4 space-y-2">
          {wizard.steps.map((s) => (
            <div key={s.id} className="flex gap-2 text-sm items-center">
              <Badge tone={s.status === 'done' ? 'success' : s.status === 'active' ? 'info' : 'neutral'}>{s.id}</Badge>
              {s.label}
            </div>
          ))}
          <Button size="sm" className="mt-3" onClick={() => wizardStep.mutate(Math.min(wizard.currentStep + 1, wizard.totalSteps))}>Next Step</Button>
          {wizard.ready ? <Badge tone="success">READY</Badge> : null}
        </Card>
      )}

      {section === 'Feed' && feedValidate && (
        <Card className="p-4 text-sm">
          <Badge tone={feedValidate.valid ? 'success' : 'danger'}>{feedValidate.valid ? 'Valid' : 'Invalid'}</Badge>
          <p>{feedValidate.adCount} ads</p>
          <ul>{feedValidate.errors.map((e) => <li key={e} className="text-red-600">{e}</li>)}</ul>
        </Card>
      )}

      {section === 'Live Test' && activeAccountId && (
        <Card className="p-4 flex flex-wrap gap-2">
          {(['oauth', 'webhook', 'feed', 'messenger', 'ai'] as const).map((c) => (
            <Button key={c} size="sm" variant="secondary" onClick={() => liveTest.mutate({ accountId: activeAccountId, component: c })}>{c}</Button>
          ))}
          {liveTest.data ? <p className="w-full text-sm mt-2">{liveTest.data.component}: {liveTest.data.message}</p> : null}
        </Card>
      )}

      {section === 'Backup' && (
        <Card className="p-4">
          <Button size="sm" onClick={() => backupExport.mutate()} disabled={backupExport.isPending}>Export Config</Button>
          {backupExport.data ? <p className="text-sm mt-2">Sections: {backupExport.data.sections.join(', ')}</p> : null}
        </Card>
      )}
    </div>
  );
}
