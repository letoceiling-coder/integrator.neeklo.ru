import { useMemo, useState } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import {
  useConnectAvitoOAuth,
  useOAuthAvitoAccounts,
  useOAuthChecklist,
  useOAuthConfig,
  useOAuthConsole,
  useOAuthDebug,
  useOAuthHealth,
  useOAuthTest,
  useRunOAuthValidation,
} from '@/entities/oauth/api';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import type { OAuthCheckStatus, OAuthTestAction } from '@neeklo/contracts';
import { OAUTH_CALLBACK_URI_PRODUCTION } from '@neeklo/contracts';

const WIZARD_STEPS = [
  'Client ID / Secret',
  'OAuth',
  'Получение токена',
  'Профиль',
  'Проверка API',
  'Завершено',
] as const;

function statusIcon(s: OAuthCheckStatus) {
  if (s === 'pass') return '✓';
  if (s === 'warn') return '⚠';
  return '✕';
}

function statusTone(s: OAuthCheckStatus): 'success' | 'warning' | 'danger' {
  if (s === 'pass') return 'success';
  if (s === 'warn') return 'warning';
  return 'danger';
}

export function OAuthSettingsPage() {
  const params = useSearch({ strict: false }) as {
    connected?: string;
    error?: string;
    accountId?: string;
  };

  const { data: accounts, isLoading } = useOAuthAvitoAccounts();
  const { data: config } = useOAuthConfig();
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(params.accountId);
  const activeAccountId = selectedAccountId ?? accounts?.[0]?.accountId;

  const { data: debug } = useOAuthDebug(activeAccountId);
  const { data: health } = useOAuthHealth(activeAccountId);
  const { data: checklist } = useOAuthChecklist(activeAccountId);
  const { data: consoleLogs } = useOAuthConsole();
  const test = useOAuthTest();
  const validate = useRunOAuthValidation();
  const connect = useConnectAvitoOAuth();

  const [wizardStep, setWizardStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const banner = params.connected
    ? 'OAuth успешно завершён. Запущены provisioning и Sync Wizard.'
    : params.error
      ? `OAuth ошибка: ${params.error}`
      : null;

  const testActions: { action: OAuthTestAction; label: string }[] = [
    { action: 'redirect', label: 'Проверить Redirect' },
    { action: 'token', label: 'Получить Token' },
    { action: 'refresh', label: 'Refresh' },
    { action: 'profile', label: 'Получить профиль' },
    { action: 'account', label: 'Получить аккаунт' },
    { action: 'api', label: 'Проверить API' },
  ];

  const checklistItems = useMemo(() => {
    if (!checklist) return [];
    return [
      { key: 'oauth', label: 'OAuth' },
      { key: 'profile', label: 'Profile' },
      { key: 'ads', label: 'Ads' },
      { key: 'messenger', label: 'Messenger' },
      { key: 'stats', label: 'Stats' },
      { key: 'webhook', label: 'Webhook' },
      { key: 'autoload', label: 'Autoload' },
      { key: 'health', label: 'Health' },
    ] as const;
  }, [checklist]);

  const runWizardConnect = () => {
    setWizardStep(1);
    connect.mutate(
      {
        displayName: displayName.trim() || undefined,
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        grantType: 'authorization_code',
      },
      {
        onSuccess: (data) => {
          if (!data.authorizationUrl) {
            setWizardStep(5);
          } else {
            setWizardStep(2);
          }
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="OAuth Debug Center"
        description="Production validation, health, API console и Connection Wizard для Avito."
      />

      {banner ? (
        <Card className={`p-4 text-sm space-y-2 ${params.error ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
          <p>{banner}</p>
          {params.connected && activeAccountId ? (
            <Link
              to="/settings/connection-report"
              search={{ accountId: activeAccountId }}
              className="inline-block text-[var(--color-primary)] underline"
            >
              Открыть Connection Report →
            </Link>
          ) : null}
        </Card>
      ) : null}

      {/* Redirect URI */}
      <Card className="p-5 space-y-3">
        <h3 className="font-medium">Redirect URI</h3>
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-[var(--color-fg-subtle)]">Configured</dt>
            <dd className="font-mono text-xs break-all">{config?.redirectUri ?? '…'}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-fg-subtle)]">Production (Avito Portal)</dt>
            <dd className="font-mono text-xs break-all">{OAUTH_CALLBACK_URI_PRODUCTION}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-fg-subtle)]">Match</dt>
            <dd>
              <Badge tone={config?.redirectMatch ? 'success' : 'danger'}>
                {config?.redirectMatch ? '✓ OK' : '✕ Mismatch'}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      {/* Connection Wizard */}
      <Card className="p-5 space-y-4">
        <h3 className="font-medium">Connection Wizard</h3>
        <div className="flex flex-wrap gap-2">
          {WIZARD_STEPS.map((label, i) => (
            <Badge key={label} tone={wizardStep >= i ? 'info' : 'neutral'}>
              {i + 1}. {label}
            </Badge>
          ))}
        </div>
        {wizardStep === 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-[var(--color-fg-subtle)]">Название</span>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Магазин №1" />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-[var(--color-fg-subtle)]">Client ID</span>
              <Input value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-[var(--color-fg-subtle)]">Client Secret</span>
              <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
            </label>
            <Button
              disabled={!clientId.trim() || !clientSecret.trim() || connect.isPending}
              onClick={runWizardConnect}
            >
              Далее → OAuth
            </Button>
          </div>
        ) : wizardStep >= 2 && wizardStep < 5 ? (
          <p className="text-sm text-[var(--color-fg-subtle)]">
            Завершите авторизацию в Avito. После callback автоматически: токен → профиль → API → Sync Wizard → READY.
          </p>
        ) : wizardStep === 5 ? (
          <p className="text-sm text-[var(--color-success)]">Подключение завершено.</p>
        ) : null}
      </Card>

      {/* Account selector */}
      <Card className="p-5 space-y-3">
        <h3 className="font-medium">Аккаунт</h3>
        {isLoading ? (
          <Skeleton className="h-10" />
        ) : (
          <select
            className="w-full max-w-md h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
            value={activeAccountId ?? ''}
            onChange={(e) => setSelectedAccountId(e.target.value || undefined)}
          >
            {!accounts?.length ? <option value="">Нет подключённых аккаунтов</option> : null}
            {accounts?.map((a) => (
              <option key={a.accountId} value={a.accountId}>
                {a.displayName} — {a.connected ? 'Connected' : a.status}
              </option>
            ))}
          </select>
        )}
      </Card>

      {activeAccountId && debug ? (
        <Card className="p-5 space-y-3">
          <h3 className="font-medium">OAuth Debug</h3>
          <dl className="grid gap-2 text-xs md:grid-cols-3">
            <div><dt className="text-[var(--color-fg-subtle)]">Provider</dt><dd>{debug.provider}</dd></div>
            <div><dt className="text-[var(--color-fg-subtle)]">Grant Type</dt><dd>{debug.grantType}</dd></div>
            <div><dt className="text-[var(--color-fg-subtle)]">Client ID</dt><dd>{debug.clientIdMasked}</dd></div>
            <div><dt className="text-[var(--color-fg-subtle)]">Health</dt><dd>{debug.health}</dd></div>
            <div><dt className="text-[var(--color-fg-subtle)]">Token Expiration</dt><dd>{debug.tokenExpiresAt ? new Date(debug.tokenExpiresAt).toLocaleString() : '—'}</dd></div>
            <div><dt className="text-[var(--color-fg-subtle)]">Last Refresh</dt><dd>{debug.lastRefreshAt ? new Date(debug.lastRefreshAt).toLocaleString() : '—'}</dd></div>
            <div><dt className="text-[var(--color-fg-subtle)]">Last Error</dt><dd className="text-[var(--color-danger)]">{debug.lastError ?? '—'}</dd></div>
            <div><dt className="text-[var(--color-fg-subtle)]">State</dt><dd className="truncate">{debug.pendingState ?? '—'}</dd></div>
            <div><dt className="text-[var(--color-fg-subtle)]">Latency</dt><dd>{debug.latencyMs != null ? `${debug.latencyMs}ms` : '—'}</dd></div>
            <div className="md:col-span-3"><dt className="text-[var(--color-fg-subtle)]">Scopes</dt><dd>{debug.scopes.join(', ') || '—'}</dd></div>
          </dl>
        </Card>
      ) : null}

      {/* OAuth Test */}
      {activeAccountId ? (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium">OAuth Test</h3>
            <Button size="sm" variant="secondary" onClick={() => validate.mutate(activeAccountId)} disabled={validate.isPending}>
              Run Validation Suite
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {testActions.map(({ action, label }) => (
              <Button
                key={action}
                size="sm"
                variant="secondary"
                disabled={test.isPending}
                onClick={() => test.mutate({ accountId: activeAccountId, action })}
              >
                {label}
              </Button>
            ))}
          </div>
          {test.data ? (
            <pre className="text-xs overflow-auto rounded bg-[var(--color-surface)] p-3 max-h-40">
              {JSON.stringify(test.data, null, 2)}
            </pre>
          ) : null}
          {validate.data ? (
            <div className="space-y-1">
              <p className="text-xs text-[var(--color-fg-subtle)]">
                Validation: {validate.data.passed} pass / {validate.data.warned} warn / {validate.data.failed} fail
              </p>
              {validate.data.checks.map((c) => (
                <div key={c.id} className="text-xs flex gap-2">
                  <span>{c.status === 'pass' ? '✓' : c.status === 'warn' ? '⚠' : '✕'}</span>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-[var(--color-fg-subtle)]">{c.message}</span>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* Health Dashboard */}
      {health ? (
        <Card className="p-5 space-y-3">
          <h3 className="font-medium">Health Dashboard</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {(
              [
                ['OAuth', health.oauth],
                ['Vault', health.vault],
                ['Provider', health.provider],
                ['Avito API', health.avitoApi],
                ['Refresh', health.refresh],
              ] as const
            ).map(([label, block]) => (
              <div key={label} className="rounded border border-[var(--color-border)] p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{label}</span>
                  <Badge tone={statusTone(block.status)}>{statusIcon(block.status)}</Badge>
                </div>
                <p className="text-xs text-[var(--color-fg-subtle)] mt-1">{block.message}</p>
                {'latencyMs' in block && block.latencyMs != null ? (
                  <p className="text-xs mt-1">{block.latencyMs}ms</p>
                ) : null}
              </div>
            ))}
          </div>
          {health.errors.lastError ? (
            <p className="text-xs text-[var(--color-danger)]">Last error: {health.errors.lastError}</p>
          ) : null}
        </Card>
      ) : null}

      {/* Production Checklist */}
      {checklist ? (
        <Card className="p-5 space-y-3">
          <h3 className="font-medium">Production Checklist</h3>
          <p className="text-xs text-[var(--color-fg-subtle)]">Account status: {checklist.accountStatus}</p>
          <div className="grid gap-2 md:grid-cols-4">
            {checklistItems.map(({ key, label }) => {
              const s = checklist[key];
              return (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <Badge tone={statusTone(s)}>{statusIcon(s)}</Badge>
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {/* API Console */}
      <Card className="p-5 space-y-3">
        <h3 className="font-medium">API Console</h3>
        {!consoleLogs?.length ? (
          <p className="text-sm text-[var(--color-fg-subtle)]">Нет запросов. Запустите OAuth Test.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--color-fg-subtle)] text-left">
                  <th className="py-1 pr-2">Time</th>
                  <th className="py-1 pr-2">Method</th>
                  <th className="py-1 pr-2">Status</th>
                  <th className="py-1 pr-2">Latency</th>
                  <th className="py-1 pr-2">Rate Limit</th>
                  <th className="py-1">URL</th>
                </tr>
              </thead>
              <tbody>
                {consoleLogs.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--color-border)]">
                    <td className="py-1.5 pr-2 whitespace-nowrap">{new Date(row.at).toLocaleTimeString()}</td>
                    <td className="py-1.5 pr-2">{row.method}</td>
                    <td className="py-1.5 pr-2">{row.status}</td>
                    <td className="py-1.5 pr-2">{row.latencyMs}ms</td>
                    <td className="py-1.5 pr-2">{row.rateLimitRemaining ?? '—'}</td>
                    <td className="py-1.5 font-mono truncate max-w-[280px]" title={row.url}>{row.url}</td>
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
