import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import type { AdReadModel } from '@neeklo/contracts';
import { useAds } from '@/entities/ad/api';
import { AD_STATUS_LABEL, statusTone } from '@/entities/ad/status';
import { MARKETPLACES } from '@neeklo/contracts';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format';
import { PageHeader } from '@/widgets/page-header/page-header';

const col = createColumnHelper<AdReadModel>();

export function AdsPage() {
  const { data, isLoading } = useAds({ limit: 100 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updatedAt', desc: true }]);

  const columns = useMemo(
    () => [
      col.accessor('title', {
        header: 'Объявление',
        cell: (c) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-[var(--color-fg)]">{c.getValue()}</div>
            <div className="text-xs text-[var(--color-fg-subtle)]">
              {MARKETPLACES[c.row.original.marketplace]?.label ?? c.row.original.marketplace}
              {c.row.original.externalId ? ` · ${c.row.original.externalId}` : ''}
            </div>
          </div>
        ),
      }),
      col.accessor('status', {
        header: 'Статус',
        cell: (c) => <Badge tone={statusTone(c.getValue())}>{AD_STATUS_LABEL[c.getValue()] ?? c.getValue()}</Badge>,
      }),
      col.accessor((r) => r.price.amount, {
        id: 'price',
        header: 'Цена',
        cell: (c) => <span className="tabular-nums">{formatMoney(c.getValue())}</span>,
      }),
      col.accessor((r) => r.metrics.views, {
        id: 'views',
        header: 'Просмотры',
        cell: (c) => <span className="tabular-nums text-[var(--color-fg-muted)]">{formatNumber(c.getValue())}</span>,
      }),
      col.accessor((r) => r.metrics.contacts, {
        id: 'contacts',
        header: 'Контакты',
        cell: (c) => <span className="tabular-nums text-[var(--color-fg-muted)]">{formatNumber(c.getValue())}</span>,
      }),
      col.accessor((r) => r.metrics.ctr, {
        id: 'ctr',
        header: 'CTR',
        cell: (c) => <span className="tabular-nums text-[var(--color-fg-muted)]">{formatPercent(c.getValue())}</span>,
      }),
      col.accessor((r) => r.metrics.roi, {
        id: 'roi',
        header: 'ROI',
        cell: (c) => {
          const v = c.getValue();
          return <span className={v >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>{formatPercent(v)}</span>;
        },
      }),
      col.accessor((r) => r.aiScore ?? 0, {
        id: 'aiScore',
        header: 'AI Score',
        cell: (c) => {
          const v = Math.round(c.getValue());
          return (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
                <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${v}%` }} />
              </div>
              <span className="text-xs tabular-nums text-[var(--color-fg-muted)]">{v}</span>
            </div>
          );
        },
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Объявления"
        subtitle="Все объявления со всех площадок. Метрики рассчитаны из потока событий в реальном времени."
        actions={
          <Input
            placeholder="Поиск…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-64"
          />
        }
      />

      <div className="overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface)] hairline">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-[var(--color-border)] text-left">
                {hg.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 font-medium text-[var(--color-fg-subtle)]">
                    <button
                      className="inline-flex items-center gap-1 hover:text-[var(--color-fg)]"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-[var(--color-border)]">
                  {columns.map((_c, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading &&
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--color-border)] last:border-0 transition hover:bg-[var(--color-surface-hover)]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading && table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center text-[var(--color-fg-subtle)]">
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
