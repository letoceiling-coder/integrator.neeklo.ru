import { Link, useSearch } from '@tanstack/react-router';
import {
  useOAuthAvitoAccounts,
  useOAuthConnectionReport,
  useRunOAuthValidation,
} from '@/entities/oauth/api';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import type { OAuthCheckStatus, OAuthConnectionSectionDto } from '@neeklo/contracts';

function statusTone(s: OAuthCheckStatus): 'success' | 'warning' | 'danger' {
  if (s === 'pass') return 'success';
  if (s === 'warn') return 'warning';
  return 'danger';
}

function SectionCard({ title, section }: { title: string; section: OAuthConnectionSectionDto }) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-medium">{title}</h4>
        <Badge tone={statusTone(section.status)}>{section.status}</Badge>
      </div>
      <p className="text-sm text-[var(--color-fg-muted)]">{section.message}</p>
      {section.latencyMs != null ? (
        <p className="text-xs text-[var(--color-fg-subtle)]">{section.latencyMs} ms</p>
      ) : null}
      {section.recommendation ? (
        <p className="text-xs text-[var(--color-warning)]">{section.recommendation}</p>
      ) : null}
    </Card>
  );
}

function AuditRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span>{label}</span>
      <Badge tone={ok ? 'success' : 'danger'}>{ok ? '✓' : '✕'}</Badge>
    </div>
  );
}

export function ConnectionReportPage() {
  const params = useSearch({ strict: false }) as { accountId?: string };
  const { data: accounts, isLoading: accountsLoading } = useOAuthAvitoAccounts();
  const accountId = params.accountId ?? accounts?.[0]?.accountId;
  const { data: report, isLoading, refetch, isFetching } = useOAuthConnectionReport(accountId);
  const validate = useRunOAuthValidation();

  if (accountsLoading || isLoading) {
    return <Skeleton className="m-6 h-96 rounded-[var(--radius-lg)]" />;
  }

  if (!accountId) {
    return (
      <div className="space-y-4">
        <PageHeader title="Connection Report" description="Подключите Avito через OAuth Settings." />
        <Card className="p-6">
          <Link to="/settings/oauth" className="text-[var(--color-accent)] underline">
            Перейти в OAuth Settings
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connection Report"
        description="Полный аудит реального подключения Avito — OAuth, API, Sync, Messenger, Feed, Webhook."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? 'Обновление…' : 'Обновить'}
            </Button>
            <Button
              onClick={() => validate.mutate(accountId)}
              disabled={validate.isPending}
            >
              OAuth Validate
            </Button>
          </div>
        }
      />

      {report ? (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={statusTone(report.overallStatus)} className="text-base px-3 py-1">
                Overall: {report.overallStatus}
              </Badge>
              <span className="text-sm text-[var(--color-fg-muted)]">
                {report.account.displayName} · {report.account.externalAccountId ?? '—'}
              </span>
              <span className="text-xs text-[var(--color-fg-subtle)]">
                {new Date(report.generatedAt).toLocaleString('ru-RU')}
              </span>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5 space-y-2">
              <h3 className="font-medium">Final Audit</h3>
              <AuditRow label="OAuth работает" ok={report.audit.oauth} />
              <AuditRow label="Токены обновляются" ok={report.audit.tokenRefresh} />
              <AuditRow label="Профиль получен" ok={report.audit.profile} />
              <AuditRow label="Аккаунт получен" ok={report.audit.account} />
              <AuditRow label="Объявления синхронизированы" ok={report.audit.adsSynced} />
              <AuditRow label="Статистика доступна" ok={report.audit.statsAvailable} />
              <AuditRow label="Messenger проверен" ok={report.audit.messengerChecked} />
              <AuditRow label="Feed готов" ok={report.audit.feedReady} />
              <AuditRow label="Webhook готов" ok={report.audit.webhookReady} />
              <AuditRow label="Production Health" ok={report.audit.productionHealth} />
            </Card>

            <Card className="p-5 space-y-3">
              <h3 className="font-medium">Account & Scopes</h3>
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-[var(--color-fg-subtle)]">Company</dt>
                  <dd>{report.account.companyName ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-fg-subtle)]">Type</dt>
                  <dd>{report.account.accountType ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-fg-subtle)]">Scopes</dt>
                  <dd className="font-mono text-xs break-all">{report.scopes.join(', ') || '—'}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-fg-subtle)]">Latency / Rate limits</dt>
                  <dd>
                    profile {report.latency.profileMs ?? '—'} ms · avg {report.latency.avgProbeMs ?? '—'} ms ·{' '}
                    {report.rateLimits.requestsLastHour} req/h · remaining {report.rateLimits.remaining ?? '—'}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <SectionCard title="OAuth" section={report.oauth} />
            <SectionCard title="Profile" section={report.profile} />
            <SectionCard title="Tariff" section={report.tariff} />
            <SectionCard title="Messenger" section={report.messenger} />
            <SectionCard title="Feed" section={report.feed} />
            <SectionCard title="Webhook" section={report.webhook} />
            <SectionCard title="Core API" section={report.apis.core} />
            <SectionCard title="Statistics API" section={report.apis.statistics} />
            <SectionCard title="Autoload API" section={report.apis.autoload} />
            <SectionCard title="Promotion API" section={report.apis.promotion} />
          </div>

          <Card className="p-5 space-y-3">
            <h3 className="font-medium">Sync Progress</h3>
            <p className="text-sm text-[var(--color-fg-muted)]">
              {report.sync.adsCount} объявлений · {report.sync.messagesCount} сообщений · last sync{' '}
              {report.sync.lastSyncAt ? new Date(report.sync.lastSyncAt).toLocaleString('ru-RU') : '—'}
            </p>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
              {report.sync.steps.map((step) => (
                <div key={step.name} className="rounded border border-[var(--color-border)] p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{step.name}</span>
                    <Badge tone={step.status === 'completed' ? 'success' : step.status === 'unavailable' ? 'warning' : step.status === 'failed' ? 'danger' : 'neutral'}>
                      {step.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--color-fg-muted)] mt-1 line-clamp-3">{step.message}</p>
                </div>
              ))}
            </div>
            {report.sync.liveWorkers.length ? (
              <div className="pt-2">
                <h4 className="text-sm font-medium mb-2">Live Workers</h4>
                <div className="flex flex-wrap gap-2">
                  {report.sync.liveWorkers.map((w) => (
                    <Badge key={w.worker} tone={w.status === 'completed' ? 'success' : w.status === 'failed' ? 'danger' : 'warning'}>
                      {w.worker}: {w.status}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  );
}
