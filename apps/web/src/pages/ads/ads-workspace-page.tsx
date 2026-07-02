import { useEffect, useMemo, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { Search, Star } from 'lucide-react';
import type { AdReadModel } from '@neeklo/contracts';
import { useAds } from '@/entities/ad/api';
import { useListingStudio } from '@/entities/commerce/api';
import { useTimeline } from '@/entities/commerce/api';
import { useCopilotPage } from '@/widgets/copilot/copilot-context';
import { VirtualList } from '@/shared/ui/virtual-list';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Card } from '@/shared/ui/card';
import { AD_STATUS_LABEL, statusTone } from '@/entities/ad/status';
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format';

export function AdsWorkspacePage() {
  const search = useSearch({ strict: false }) as { id?: string };
  const [selectedId, setSelectedId] = useState<string | null>(search.id ?? null);

  useEffect(() => {
    if (search.id) setSelectedId(search.id);
  }, [search.id]);
  const [filter, setFilter] = useState('');
  const { data, isLoading } = useAds({ limit: 500 });

  const ads = useMemo(() => {
    const items = data?.items ?? [];
    if (!filter) return items;
    const q = filter.toLowerCase();
    return items.filter((a) => a.title.toLowerCase().includes(q) || a.externalId?.includes(q));
  }, [data, filter]);

  const selected = ads.find((a) => a.id === selectedId) ?? null;

  useCopilotPage('ads', {
    title: selected?.title ?? 'Ads Workspace',
    entityType: 'ad',
    entityId: selectedId ?? undefined,
    summary: selected
      ? `${selected.title} · ${selected.status} · CTR ${formatPercent(selected.metrics.ctr)} · ROI ${formatPercent(selected.metrics.roi)}`
      : `${ads.length} listings`,
  });

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        <div className="border-b border-[var(--color-border)] p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
            <Input
              className="pl-9"
              placeholder="Поиск объявлений…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <p className="mt-2 text-[10px] text-[var(--color-fg-subtle)]">{ads.length} объявлений</p>
        </div>
        {isLoading ? (
          <Skeleton className="m-3 h-20" />
        ) : (
          <VirtualList
            items={ads}
            estimateSize={72}
            className="flex-1"
            getKey={(a) => a.id}
            renderItem={(ad) => (
              <button
                type="button"
                onClick={() => setSelectedId(ad.id)}
                className={`w-full border-b border-[var(--color-border)] px-4 py-3 text-left transition hover:bg-[var(--color-surface-hover)] ${
                  selectedId === ad.id ? 'bg-[var(--color-surface)]' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 text-sm font-medium">{ad.title}</span>
                  {ad.aiScore != null && ad.aiScore > 70 && <Star className="h-3 w-3 shrink-0 text-[var(--color-warning)]" />}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--color-fg-subtle)]">
                  <Badge tone={statusTone(ad.status)}>{AD_STATUS_LABEL[ad.status] ?? ad.status}</Badge>
                  <span>{formatMoney(ad.price.amount)}</span>
                </div>
              </button>
            )}
          />
        )}
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto bg-[var(--color-bg)] p-6">
        {selected ? <AdWorkspaceDetail ad={selected} /> : <EmptyWorkspace />}
      </section>
    </div>
  );
}

function EmptyWorkspace() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-[var(--color-fg-subtle)]">
      <p className="text-sm">Выберите объявление слева — откроется рабочая область</p>
    </div>
  );
}

function AdWorkspaceDetail({ ad }: { ad: AdReadModel }) {
  const { data: studio, isLoading: studioLoading } = useListingStudio(ad.id);
  const { data: timeline } = useTimeline();

  const adTimeline = useMemo(
    () =>
      (timeline as { aggregateId?: string; type?: string; occurredAt?: string }[] | undefined)?.filter(
        (e) => e.aggregateId === ad.id,
      ) ?? [],
    [timeline, ad.id],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{ad.title}</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-subtle)]">
          {ad.regionId} · {formatMoney(ad.price.amount)} · AI Score {ad.aiScore ?? '—'}
        </p>
      </header>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="stats">Статистика</TabsTrigger>
          <TabsTrigger value="history">История</TabsTrigger>
          <TabsTrigger value="studio">Studio</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Просмотры" value={formatNumber(ad.metrics.views)} />
            <MetricCard label="Контакты" value={formatNumber(ad.metrics.contacts)} />
            <MetricCard label="CTR" value={formatPercent(ad.metrics.ctr)} />
            <MetricCard label="ROI" value={formatPercent(ad.metrics.roi)} />
          </div>
          <Card className="mt-4 p-4 text-sm text-[var(--color-fg-muted)]">
            Редактор описания и фото — через Listing Studio и Media Studio. Публикация на Avito требует Autoload (deferred).
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Избранное" value={formatNumber(ad.metrics.favorites)} />
            <MetricCard label="Сообщения" value={formatNumber(ad.metrics.messages)} />
            <MetricCard label="CPA" value={formatMoney(ad.metrics.costPerContact)} />
            <MetricCard label="Расход" value={formatMoney(ad.metrics.spend.amount)} />
          </div>
        </TabsContent>

        <TabsContent value="history">
          {studioLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <ul className="space-y-2 text-sm">
              {(studio as { history?: { changeType: string; recordedAt: string }[] })?.history?.map((h, i) => (
                <li key={i} className="rounded border border-[var(--color-border)] p-3">
                  {h.changeType} · {new Date(h.recordedAt).toLocaleString()}
                </li>
              )) ?? <li className="text-[var(--color-fg-subtle)]">Нет истории изменений</li>}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="studio">
          {studioLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="space-y-3 text-sm">
              <p>Conversations: {(studio as { conversations?: unknown[] })?.conversations?.length ?? 0}</p>
              <p>Experiments: {(studio as { experiments?: unknown[] })?.experiments?.length ?? 0}</p>
              <p className="text-[var(--color-fg-subtle)]">Forecast, Decision, Knowledge — через AI Copilot →</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="timeline">
          <ul className="space-y-2 font-mono text-xs">
            {adTimeline.slice(0, 20).map((e, i) => (
              <li key={i} className="text-[var(--color-fg-muted)]">
                {e.occurredAt} · {e.type}
              </li>
            ))}
            {!adTimeline.length && <li className="text-[var(--color-fg-subtle)]">Нет событий</li>}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-[10px] uppercase text-[var(--color-fg-subtle)]">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </Card>
  );
}
