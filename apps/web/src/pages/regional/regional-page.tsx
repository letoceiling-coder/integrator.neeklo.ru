import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { useRegions } from '@/entities/commerce/api';
import { useCopilotPage } from '@/widgets/copilot/copilot-context';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { formatPercent } from '@/shared/lib/format';

interface RegionRow {
  regionId: string;
  opportunityIndex?: number;
  roi?: number;
  ctr?: number;
  demand?: number;
  competition?: number;
  avgViews?: number;
  marketHealth?: string;
}

export function RegionalPage() {
  const { data: regions, isLoading } = useRegions();
  const [selected, setSelected] = useState<RegionRow | null>(null);

  useCopilotPage('regional', {
    title: selected?.regionId ?? 'Regional Center',
    entityType: 'region',
    entityId: selected?.regionId,
    summary: selected
      ? `OI ${selected.opportunityIndex?.toFixed(1)} ROI ${formatPercent(selected.roi ?? 0)}`
      : `${regions?.length ?? 0} regions`,
  });

  const list = (regions ?? []) as RegionRow[];

  return (
    <div className="space-y-6">
      <PageHeader title="Regional Center" description="Интерактивная карта регионов — клик для drill-down." />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-6">
          {isLoading ? (
            <Skeleton className="h-80" />
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {list.map((r) => {
                const intensity = Math.min(1, (r.opportunityIndex ?? 0) / 100);
                const active = selected?.regionId === r.regionId;
                return (
                  <motion.button
                    key={r.regionId}
                    type="button"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelected(r)}
                    className={`relative aspect-square rounded-[var(--radius-md)] border p-2 text-left transition ${
                      active ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30' : 'border-[var(--color-border)]'
                    }`}
                    style={{
                      background: `color-mix(in oklch, var(--color-primary) ${Math.round(intensity * 40)}%, var(--color-surface))`,
                    }}
                  >
                    <MapPin className="mb-1 h-3 w-3 text-[var(--color-fg-subtle)]" />
                    <div className="text-[10px] font-medium capitalize leading-tight">{r.regionId}</div>
                    <div className="mt-1 text-[9px] text-[var(--color-fg-subtle)]">OI {(r.opportunityIndex ?? 0).toFixed(0)}</div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          {selected ? (
            <div className="space-y-4 text-sm">
              <h3 className="text-lg font-semibold capitalize">{selected.regionId}</h3>
              <dl className="grid grid-cols-2 gap-3">
                <Metric label="CTR" value={formatPercent(selected.ctr ?? 0)} />
                <Metric label="ROI" value={formatPercent(selected.roi ?? 0)} />
                <Metric label="Demand" value={(selected.demand ?? 0).toFixed(2)} />
                <Metric label="Competition" value={(selected.competition ?? 0).toFixed(2)} />
                <Metric label="Avg views" value={String(Math.round(selected.avgViews ?? 0))} />
                <Metric label="Health" value={selected.marketHealth ?? '—'} />
              </dl>
              <p className="text-xs leading-relaxed text-[var(--color-fg-subtle)]">
                Forecast, конкуренты и AI Summary — спросите AI Copilot с контекстом региона.
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-fg-subtle)]">Выберите регион на карте</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase text-[var(--color-fg-subtle)]">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
