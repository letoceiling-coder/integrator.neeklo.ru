import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  MapPin,
  MessageSquare,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { AdReadModel } from '@neeklo/contracts';
import { useAds } from '@/entities/ad/api';
import { useInbox, useTasks, useBudget } from '@/entities/commerce/api';
import { useAvitoAnalytics } from '@/entities/avito/api';
import { useRegions } from '@/entities/commerce/api';
import { useAiRun } from '@/entities/ai/api';
import { useCopilotPage } from '@/widgets/copilot/copilot-context';
import { Card } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { formatCompact, formatMoney, formatNumber, formatPercent } from '@/shared/lib/format';

function aggregate(ads: AdReadModel[]) {
  return ads.reduce(
    (acc, ad) => {
      acc.views += ad.metrics.views;
      acc.contacts += ad.metrics.contacts;
      acc.spend += ad.metrics.spend.amount;
      acc.revenue += ad.metrics.revenue.amount;
      if (ad.status === 'active') acc.active += 1;
      return acc;
    },
    { views: 0, contacts: 0, spend: 0, revenue: 0, active: 0 },
  );
}

export function DashboardPage() {
  const { data: adsData, isLoading: adsLoading } = useAds({ limit: 500 });
  const { data: inbox } = useInbox();
  const { data: tasks } = useTasks();
  const { data: budget } = useBudget();
  const { data: analytics } = useAvitoAnalytics();
  const { data: regions } = useRegions();
  const briefing = useAiRun();
  const [briefingText, setBriefingText] = useState<string | null>(null);

  const ads = adsData?.items ?? [];
  const totals = useMemo(() => aggregate(ads), [ads]);
  const roi = totals.spend > 0 ? (totals.revenue - totals.spend) / totals.spend : analytics?.roi ?? 0;

  const sorted = useMemo(
    () => [...ads].sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0)),
    [ads],
  );
  const best = sorted.slice(0, 3);
  const worst = [...ads].sort((a, b) => a.metrics.ctr - b.metrics.ctr).slice(0, 3);

  const unread = inbox?.filter((c) => c.unreadCount > 0).length ?? 0;
  const openTasks = tasks?.length ?? 0;

  const summaryForCopilot = `Active ads: ${totals.active}, unread chats: ${unread}, ROI: ${(roi * 100).toFixed(1)}%, recommendations: ${analytics?.recommendationCount ?? 0}`;
  useCopilotPage('dashboard', { title: 'Dashboard', summary: summaryForCopilot });

  useEffect(() => {
    if (briefingText || briefing.isPending || adsLoading) return;
    const payload = [
      'Write a concise daily briefing for Avito seller (Russian, 6-8 bullet points).',
      `Active listings: ${totals.active}`,
      `Unread messages: ${unread}`,
      `Views: ${totals.views}, contacts: ${totals.contacts}`,
      `Spend: ${totals.spend}, revenue: ${totals.revenue}, ROI: ${(roi * 100).toFixed(1)}%`,
      `AI recommendations pending: ${analytics?.recommendationCount ?? 0}`,
      `Top regions: ${regions?.slice(0, 3).map((r: { regionId: string }) => r.regionId).join(', ') || 'n/a'}`,
      worst.length ? `Low CTR ads: ${worst.map((a) => a.title.slice(0, 30)).join('; ')}` : '',
    ].join('\n');

    briefing.mutate(
      { taskType: 'analytics', input: payload, skillIds: ['analytics', 'sales'] },
      { onSuccess: (r) => setBriefingText(r.output) },
    );
  }, [adsLoading, briefingText, briefing, totals, unread, roi, analytics, regions, worst]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Good morning</h1>
          <p className="mt-1 text-sm text-[var(--color-fg-subtle)]">Avito Professional Workspace — сводка дня</p>
        </div>
        <Link to="/executive">
          <Button variant="secondary" size="sm">
            Executive Mode
          </Button>
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-primary)]/5 px-5 py-3">
          <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
          <span className="text-sm font-medium">AI Briefing</span>
          {briefing.isPending && <span className="text-xs text-[var(--color-fg-subtle)]">генерация…</span>}
        </div>
        <div className="p-5 text-sm leading-relaxed whitespace-pre-wrap text-[var(--color-fg-muted)]">
          {briefingText ?? (briefing.isPending ? <Skeleton className="h-24" /> : 'Загрузка сводки…')}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <Kpi icon={TrendingUp} label="Активные" value={formatNumber(totals.active)} loading={adsLoading} />
        <Kpi icon={MessageSquare} label="Непрочитанные" value={formatNumber(unread)} tone="warning" />
        <Kpi icon={Target} label="Контакты" value={formatCompact(totals.contacts)} loading={adsLoading} />
        <Kpi icon={Wallet} label="ROI" value={formatPercent(roi)} tone={roi >= 0 ? 'success' : 'danger'} />
        <Kpi icon={Bot} label="AI Recs" value={String(analytics?.recommendationCount ?? 0)} />
        <Kpi icon={MapPin} label="Регионы" value={String(regions?.length ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium">Продажи и бюджет</h3>
            <Badge tone="neutral">{analytics?.dataSource ?? 'projection'}</Badge>
          </div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Расход" value={formatMoney(budget?.totalSpend ?? totals.spend)} />
            <Stat label="Доход" value={formatMoney(budget?.totalRevenue ?? totals.revenue)} />
            <Stat label="ROAS" value={(budget?.roas ?? analytics?.roas ?? 0).toFixed(2)} />
            <Stat label="Forecast" value={analytics?.forecastTrend ?? '—'} />
          </dl>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-medium">Последние задачи</h3>
          <ul className="space-y-2 text-sm">
            {tasks?.slice(0, 5).map((t) => (
              <li key={t.id} className="truncate text-[var(--color-fg-muted)]">
                {t.title}
              </li>
            ))}
            {!openTasks && <li className="text-[var(--color-fg-subtle)]">Нет открытых задач</li>}
          </ul>
          <Link to="/tasks" className="mt-3 inline-block text-xs text-[var(--color-primary)] hover:underline">
            Все задачи →
          </Link>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdList title="Лучшие объявления" ads={best} icon={ArrowUpRight} tone="success" />
        <AdList title="Требуют внимания" ads={worst} icon={ArrowDownRight} tone="danger" />
      </div>

      {regions && regions.length > 0 ? (
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-medium">Карта регионов (топ Opportunity)</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {regions.slice(0, 12).map((r: { regionId: string; opportunityIndex?: number; roi?: number }) => (
              <Link
                key={r.regionId}
                to="/analytics/regional"
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]"
              >
                <div className="text-xs font-medium capitalize">{r.regionId}</div>
                <div className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">
                  OI {(r.opportunityIndex ?? 0).toFixed(1)} · ROI {formatPercent(r.roi ?? 0)}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
  loading,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  tone?: 'success' | 'danger' | 'warning';
  loading?: boolean;
}) {
  const colors = {
    success: 'text-[var(--color-success)]',
    danger: 'text-[var(--color-danger)]',
    warning: 'text-[var(--color-warning)]',
  };
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-4">
        <Icon className={`mb-2 h-4 w-4 ${tone ? colors[tone] : 'text-[var(--color-primary)]'}`} />
        <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-subtle)]">{label}</div>
        <div className="mt-1 text-lg font-semibold tabular-nums">{loading ? '…' : value}</div>
      </Card>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase text-[var(--color-fg-subtle)]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function AdList({
  title,
  ads,
  icon: Icon,
  tone,
}: {
  title: string;
  ads: AdReadModel[];
  icon: typeof ArrowUpRight;
  tone: 'success' | 'danger';
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${tone === 'success' ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`} />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <ul className="space-y-2">
        {ads.map((ad) => (
          <li key={ad.id}>
            <Link to="/ads" search={{ id: ad.id }} className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] px-2 py-1.5 hover:bg-[var(--color-surface-hover)]">
              <span className="truncate text-sm">{ad.title}</span>
              <span className="shrink-0 text-xs tabular-nums text-[var(--color-fg-subtle)]">
                CTR {formatPercent(ad.metrics.ctr)}
              </span>
            </Link>
          </li>
        ))}
        {!ads.length && <li className="text-sm text-[var(--color-fg-subtle)]">Нет данных</li>}
      </ul>
    </Card>
  );
}
