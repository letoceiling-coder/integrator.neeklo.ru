import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import type { AvitoAdViewMode, AvitoEnrichedAdDto, AvitoBulkOperationDto } from '@neeklo/contracts';
import { useAvitoAccounts } from '@/entities/avito/api';
import {
  useAvitoOpsAds,
  useAvitoOpsBulk,
  useAvitoOpsFeed,
  useAvitoOpsFeedExport,
  useAvitoOpsHealth,
  useAvitoOpsMediaAssets,
  useAvitoOpsMediaJob,
  useAvitoOpsPromotion,
  useAvitoOpsQuality,
  useAvitoOpsRegionalDrafts,
  useAvitoOpsStudio,
  useAvitoOpsTimeline,
  useAvitoOpsUpdateStudio,
  useAvitoOpsAiRewrite,
} from '@/entities/avito-operations/api';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format';

const SECTIONS = [
  'Ads Manager',
  'Advertisement Studio',
  'Media Studio Pro',
  'Bulk Operations',
  'Regional Studio',
  'Feed Studio',
  'Promotion Center',
  'Timeline',
  'Quality Center',
] as const;

type Section = (typeof SECTIONS)[number];
const VIEW_MODES: AvitoAdViewMode[] = ['table', 'cards', 'gallery', 'compact', 'kanban', 'timeline'];

const columnHelper = createColumnHelper<AvitoEnrichedAdDto>();

export function AvitoOperationsPage() {
  const { data: accounts } = useAvitoAccounts();
  const [accountId, setAccountId] = useState<string | undefined>();
  const activeAccountId = accountId ?? accounts?.[0]?.id;
  const [section, setSection] = useState<Section>('Ads Manager');
  const [viewMode, setViewMode] = useState<AvitoAdViewMode>('table');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const filters = useMemo(
    () => ({
      accountId: activeAccountId,
      q: q || undefined,
      status: statusFilter || undefined,
      limit: 200,
    }),
    [activeAccountId, q, statusFilter],
  );

  const { data: adsPage, isLoading } = useAvitoOpsAds(filters);
  const ads = adsPage?.items ?? [];
  const bulk = useAvitoOpsBulk();
  const { data: studio } = useAvitoOpsStudio(selectedAdId ?? undefined);
  const { data: quality } = useAvitoOpsQuality(selectedAdId ?? undefined);
  const { data: feed } = useAvitoOpsFeed(activeAccountId);
  const { data: promotion } = useAvitoOpsPromotion(activeAccountId);
  const { data: timeline } = useAvitoOpsTimeline({ accountId: activeAccountId, adId: selectedAdId ?? undefined });
  const { data: health } = useAvitoOpsHealth(activeAccountId);
  const { data: regionalDrafts } = useAvitoOpsRegionalDrafts();
  const { data: mediaAssets } = useAvitoOpsMediaAssets();
  const feedExport = useAvitoOpsFeedExport();
  const updateStudio = useAvitoOpsUpdateStudio();
  const aiRewrite = useAvitoOpsAiRewrite();
  const mediaJob = useAvitoOpsMediaJob();

  const [studioDesc, setStudioDesc] = useState('');
  const [studioTitle, setStudioTitle] = useState('');

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: () => '☐',
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selected.has(row.original.id)}
            onChange={() => toggleSelect(row.original.id)}
            aria-label={`Select ${row.original.title}`}
          />
        ),
      }),
      columnHelper.accessor('title', { header: 'Название', cell: (c) => c.getValue() }),
      columnHelper.accessor('price', { header: 'Цена', cell: (c) => formatMoney(c.getValue()) }),
      columnHelper.accessor('status', { header: 'Статус', cell: (c) => <Badge tone="neutral">{c.getValue()}</Badge> }),
      columnHelper.accessor('metrics.views', { header: 'Просмотры', cell: (c) => formatNumber(c.getValue()) }),
      columnHelper.accessor('metrics.contacts', { header: 'Контакты', cell: (c) => formatNumber(c.getValue()) }),
      columnHelper.accessor('metrics.ctr', { header: 'CTR', cell: (c) => formatPercent(c.getValue()) }),
      columnHelper.accessor('aiScore', { header: 'AI', cell: (c) => c.getValue() ?? '—' }),
      columnHelper.accessor('syncStatus', { header: 'Sync', cell: (c) => c.getValue() }),
      columnHelper.accessor('feedStatus', { header: 'Feed', cell: (c) => c.getValue() }),
      columnHelper.accessor('health', { header: 'Health', cell: (c) => <Badge tone={c.getValue() === 'healthy' ? 'success' : c.getValue() === 'error' ? 'danger' : 'warning'}>{c.getValue()}</Badge> }),
    ],
    [selected],
  );

  const table = useReactTable({ data: ads, columns, getCoreRowModel: getCoreRowModel() });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runBulk(action: AvitoBulkOperationDto['action']) {
    if (!selected.size) return;
    bulk.mutate({ adIds: [...selected], action, accountId: activeAccountId });
  }

  const kanbanColumns = useMemo(() => {
    const byStatus = new Map<string, AvitoEnrichedAdDto[]>();
    for (const ad of ads) {
      const list = byStatus.get(ad.status) ?? [];
      list.push(ad);
      byStatus.set(ad.status, list);
    }
    return [...byStatus.entries()];
  }, [ads]);

  return (
    <div className="space-y-4 pb-8">
      <PageHeader
        title="Avito Operations Center"
        description="Enterprise CRM для Avito — объявления, feed, promotion, media. Только официальные API."
      />

      <div className="flex flex-wrap gap-2 items-center">
        <select className="border rounded px-2 py-1 text-sm" value={activeAccountId ?? ''} onChange={(e) => setAccountId(e.target.value)}>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>{a.displayName}</option>
          ))}
        </select>
        {health ? (
          <Badge tone={health.directPublishAvailable ? 'success' : 'warning'}>
            {health.adsCount} ads · Feed ready: {health.feedReadyCount}
          </Badge>
        ) : null}
      </div>

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

      {adsPage?.limitations.length ? (
        <Card className="p-3 text-xs text-[var(--color-fg-subtle)]">
          {adsPage.limitations.map((l) => (
            <p key={l}>⚠ {l}</p>
          ))}
        </Card>
      ) : null}

      {section === 'Ads Manager' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Input placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Все статусы</option>
              <option value="active">active</option>
              <option value="draft">draft</option>
              <option value="archived">archived</option>
            </select>
            <div className="flex gap-1 ml-auto">
              {VIEW_MODES.map((m) => (
                <Button key={m} size="sm" variant={viewMode === m ? 'primary' : 'secondary'} onClick={() => setViewMode(m)}>
                  {m}
                </Button>
              ))}
            </div>
          </div>

          {isLoading ? <Skeleton className="h-64" /> : null}

          {!isLoading && viewMode === 'table' ? (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="border-b text-left">
                      {hg.headers.map((h) => (
                        <th key={h.id} className="p-2">{flexRender(h.column.columnDef.header, h.getContext())}</th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b hover:bg-[var(--color-surface-hover)] cursor-context-menu"
                      onContextMenu={(e) => { e.preventDefault(); setSelectedAdId(row.original.id); setSection('Advertisement Studio'); }}
                      onClick={() => setSelectedAdId(row.original.id)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="p-2">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : null}

          {!isLoading && viewMode === 'cards' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {ads.map((ad) => (
                  <motion.div key={ad.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <AdCard ad={ad} onOpen={() => { setSelectedAdId(ad.id); setSection('Advertisement Studio'); }} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : null}

          {!isLoading && viewMode === 'gallery' ? (
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              {ads.map((ad) => (
                <button key={ad.id} type="button" className="aspect-square rounded-lg border overflow-hidden text-left" onClick={() => setSelectedAdId(ad.id)}>
                  <div className="h-2/3 bg-[var(--color-bg-muted)] flex items-center justify-center text-xs text-[var(--color-fg-subtle)]">
                    {ad.imageUrl ? <img src={ad.imageUrl} alt="" className="object-cover w-full h-full" /> : 'No photo'}
                  </div>
                  <div className="p-2 text-xs line-clamp-2">{ad.title}</div>
                </button>
              ))}
            </div>
          ) : null}

          {!isLoading && viewMode === 'compact' ? <CompactList ads={ads} onSelect={setSelectedAdId} /> : null}

          {!isLoading && viewMode === 'kanban' ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {kanbanColumns.map(([status, items]) => (
                <div key={status} className="min-w-[240px] shrink-0">
                  <h3 className="font-medium mb-2 capitalize">{status} ({items.length})</h3>
                  <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                    {items.map((ad) => (
                      <KanbanCard key={ad.id} ad={ad} onOpen={() => setSelectedAdId(ad.id)} />
                    ))}
                  </SortableContext>
                </div>
              ))}
            </div>
          ) : null}

          {!isLoading && viewMode === 'timeline' ? (
            <div className="space-y-2">
              {ads.map((ad) => (
                <div key={ad.id} className="flex gap-4 items-center border-b pb-2 text-sm">
                  <span className="text-xs text-[var(--color-fg-subtle)] w-32">{new Date(ad.updatedAt).toLocaleDateString()}</span>
                  <span className="flex-1">{ad.title}</span>
                  <Badge tone="neutral">{ad.status}</Badge>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {section === 'Advertisement Studio' && selectedAdId && studio ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-3 p-4 space-y-3">
            <h3 className="font-medium">Media</h3>
            {studio.mediaAssets.map((a) => (
              <a key={a.id} href={a.publicUrl} target="_blank" rel="noreferrer" className="block text-xs truncate text-[var(--color-primary)]">{a.kind}</a>
            ))}
            {studio.limitations.map((l) => <p key={l} className="text-xs text-[var(--color-fg-subtle)]">{l}</p>)}
          </Card>
          <Card className="lg:col-span-6 p-4 space-y-3">
            <Input value={studioTitle || studio.ad.title} onChange={(e) => setStudioTitle(e.target.value)} placeholder="Название" />
            <textarea
              className="w-full min-h-[200px] border rounded p-2 text-sm"
              value={studioDesc || studio.validation.warnings.join('\n')}
              onChange={(e) => setStudioDesc(e.target.value)}
              placeholder="Описание"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => updateStudio.mutate({ adId: selectedAdId, body: { title: studioTitle, description: studioDesc } })}>Сохранить</Button>
              <Button size="sm" variant="secondary" onClick={() => aiRewrite.mutate(selectedAdId)} disabled={aiRewrite.isPending}>AI Rewrite</Button>
            </div>
          </Card>
          <Card className="lg:col-span-3 p-4 space-y-3 text-sm">
            <h3 className="font-medium">Preview & Validation</h3>
            <Badge tone={studio.validation.ok ? 'success' : 'danger'}>{studio.validation.ok ? 'OK' : 'Errors'}</Badge>
            <p>SEO: {studio.seo.score}/100</p>
            <p>Views: {studio.analytics.views} · CTR {formatPercent(studio.analytics.ctr)}</p>
            <ul className="text-xs space-y-1">{studio.aiSuggestions.map((s) => <li key={s}>{s}</li>)}</ul>
          </Card>
        </div>
      ) : section === 'Advertisement Studio' ? (
        <Card className="p-6 text-sm">Выберите объявление в Ads Manager (ПКМ → Открыть)</Card>
      ) : null}

      {section === 'Media Studio Pro' ? (
        <Card className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['watermark', 'resize', 'banner', 'infographic', 'remove_background', 'enhance', 'generate_image'] as const).map((kind) => (
              <Button key={kind} size="sm" variant="secondary" onClick={() => mediaJob.mutate({ kind, input: { prompt: 'Product photo', width: 800, height: 600 }, entityId: selectedAdId ?? undefined })}>
                {kind}
              </Button>
            ))}
          </div>
          <p className="text-xs text-[var(--color-fg-subtle)]">Файлы сохраняются в Selectel S3. remove_background/enhance требуют AI_IMAGE_PROVIDER ≠ stub.</p>
          <div className="grid gap-2 md:grid-cols-4">
            {(mediaAssets as { id: string; kind: string; publicUrl: string }[] | undefined)?.map((a) => (
              <a key={a.id} href={a.publicUrl} target="_blank" rel="noreferrer" className="border rounded p-2 text-xs">{a.kind}</a>
            ))}
          </div>
        </Card>
      ) : null}

      {section === 'Bulk Operations' ? (
        <Card className="p-4 space-y-3">
          <p className="text-sm">Выбрано: {selected.size}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => bulk.mutate({ adIds: [...selected], action: 'price_change', priceDelta: 100, accountId: activeAccountId })}>Изменить цену (+100)</Button>
            <Button size="sm" onClick={() => runBulk('prepare_feed')}>Подготовить к Feed</Button>
            <Button size="sm" onClick={() => runBulk('validate')}>Проверить ошибки</Button>
            <Button size="sm" onClick={() => runBulk('ai_rewrite')}>AI Rewrite</Button>
            <Button size="sm" onClick={() => runBulk('sync_price_avito')}>Sync цена → Avito API</Button>
            <Button size="sm" variant="secondary" onClick={() => runBulk('export')}>Экспорт JSON</Button>
            <Button size="sm" variant="ghost" onClick={() => runBulk('archive')}>Архив</Button>
          </div>
        </Card>
      ) : null}

      {section === 'Regional Studio' ? (
        <Card className="p-4">
          <p className="text-sm mb-3">Региональные черновики — экспорт через Feed Manager (без прямой публикации на Avito).</p>
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="p-2 text-left">Город</th><th className="p-2">Заголовок</th><th className="p-2">Режим</th></tr></thead>
            <tbody>
              {(regionalDrafts as { id: string; cityId: string; localizedTitle: string; publishMode: string }[] | undefined)?.map((d) => (
                <tr key={d.id} className="border-b"><td className="p-2">{d.cityId}</td><td className="p-2">{d.localizedTitle}</td><td className="p-2"><Badge tone="neutral">{d.publishMode}</Badge></td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {section === 'Feed Studio' && feed ? (
        <Card className="p-4 space-y-4">
          <div className="flex gap-2">
            {(['xml', 'csv', 'json'] as const).map((format) => (
              <Button key={format} size="sm" onClick={() => activeAccountId && feedExport.mutate({ accountId: activeAccountId, format })} disabled={!activeAccountId}>
                Export {format.toUpperCase()}
              </Button>
            ))}
          </div>
          <p className="text-xs">Queue: pending {feed.queue.pending} · failed {feed.queue.failed}</p>
          <ul className="text-xs space-y-1">{feed.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="p-2 text-left">Version</th><th className="p-2">Format</th><th className="p-2">Ads</th><th className="p-2">Status</th></tr></thead>
            <tbody>
              {feed.history.map((h) => (
                <tr key={h.id} className="border-b"><td className="p-2">v{h.version}</td><td className="p-2">{h.format}</td><td className="p-2">{h.adCount}</td><td className="p-2">{h.status}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {section === 'Promotion Center' && promotion ? (
        <Card className="p-4 space-y-3">
          <p className="text-sm">Услуг в dict: {promotion.services.length}</p>
          <ul className="text-xs space-y-1">{promotion.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
          <h3 className="font-medium text-sm">AI Recommendations</h3>
          {promotion.recommendations.map((r) => (
            <div key={r.adId} className="text-sm border-b pb-2"><strong>{r.title}</strong> — {r.suggestion}</div>
          ))}
        </Card>
      ) : null}

      {section === 'Timeline' && timeline ? (
        <Card className="p-4">
          <ul className="space-y-2 text-sm">
            {timeline.map((e) => (
              <li key={e.id} className="flex gap-3 border-b pb-2">
                <span className="text-xs text-[var(--color-fg-subtle)] w-36">{new Date(e.at).toLocaleString()}</span>
                <Badge tone="neutral">{e.kind}</Badge>
                <span>{e.title}</span>
                <span className="text-[var(--color-fg-subtle)]">{e.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {section === 'Quality Center' && quality ? (
        <Card className="p-4 space-y-3">
          <div className="text-2xl font-semibold">{quality.qualityScore}/100</div>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div><h4 className="font-medium">Errors</h4><ul>{quality.errors.map((e) => <li key={e}>{e}</li>)}</ul></div>
            <div><h4 className="font-medium">Missing</h4><ul>{quality.missingFields.map((e) => <li key={e}>{e}</li>)}</ul></div>
            <div><h4 className="font-medium">Recommendations</h4><ul>{quality.recommendations.map((e) => <li key={e}>{e}</li>)}</ul></div>
          </div>
        </Card>
      ) : section === 'Quality Center' ? (
        <Card className="p-6 text-sm">Выберите объявление для отчёта качества</Card>
      ) : null}
    </div>
  );
}

function AdCard({ ad, onOpen }: { ad: AvitoEnrichedAdDto; onOpen: () => void }) {
  return (
    <Card className="p-4 space-y-2 cursor-pointer hover:shadow-md transition" onClick={onOpen}>
      <div className="flex justify-between gap-2">
        <h3 className="font-medium line-clamp-2">{ad.title}</h3>
        <Badge tone={ad.health === 'healthy' ? 'success' : 'warning'}>{ad.health}</Badge>
      </div>
      <p className="text-lg">{formatMoney(ad.price)}</p>
      <div className="grid grid-cols-3 gap-2 text-xs text-[var(--color-fg-subtle)]">
        <span>{formatNumber(ad.metrics.views)} views</span>
        <span>{formatNumber(ad.metrics.contacts)} contacts</span>
        <span>CTR {formatPercent(ad.metrics.ctr)}</span>
      </div>
      <div className="flex gap-1 flex-wrap">
        <Badge tone="neutral">{ad.syncStatus}</Badge>
        <Badge tone="neutral">{ad.feedStatus}</Badge>
        {ad.aiScore != null ? <Badge tone="warning">AI {ad.aiScore}</Badge> : null}
      </div>
    </Card>
  );
}

function CompactList({ ads, onSelect }: { ads: AvitoEnrichedAdDto[]; onSelect: (id: string) => void }) {
  const parentRef = { current: null as HTMLDivElement | null };
  const virtualizer = useVirtualizer({ count: ads.length, getScrollElement: () => parentRef.current, estimateSize: () => 40 });
  return (
    <div ref={(el) => { parentRef.current = el; }} className="h-[500px] overflow-auto border rounded">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((v) => {
          const ad = ads[v.index]!;
          return (
            <button
              key={ad.id}
              type="button"
              style={{ position: 'absolute', top: v.start, height: v.size, width: '100%' }}
              className="flex items-center gap-3 px-3 border-b text-sm text-left hover:bg-[var(--color-surface-hover)]"
              onClick={() => onSelect(ad.id)}
            >
              <span className="flex-1 truncate">{ad.title}</span>
              <span className="text-[var(--color-fg-subtle)]">{formatMoney(ad.price)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ ad, onOpen }: { ad: AvitoEnrichedAdDto; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: ad.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-2">
      <Card className="p-3 text-sm cursor-grab" onClick={onOpen}>
        <p className="line-clamp-2 font-medium">{ad.title}</p>
        <p className="text-xs text-[var(--color-fg-subtle)]">{formatMoney(ad.price)}</p>
      </Card>
    </div>
  );
}
