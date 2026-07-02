import { useState } from 'react';
import { useRegionalPublish } from '@/entities/avito/api';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

const PRESET_REGIONS = [
  { regionId: 'moscow', cityId: 'moscow' },
  { regionId: 'spb', cityId: 'spb' },
  { regionId: 'kazan', cityId: 'kazan' },
  { regionId: 'ekb', cityId: 'ekb' },
];

export function AvitoRegionalPage() {
  const publish = useRegionalPublish();
  const [product, setProduct] = useState('');
  const [basePrice, setBasePrice] = useState(10000);
  const [selected, setSelected] = useState<string[]>(['moscow', 'spb']);

  const toggle = (cityId: string) => {
    setSelected((s) => (s.includes(cityId) ? s.filter((x) => x !== cityId) : [...s, cityId]));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regional Publishing"
        description="AI адаптирует заголовок, описание и цену. Публикация — локальные черновики (Autoload API недоступен)."
      />

      <Card className="space-y-4 p-6">
        <Input placeholder="Товар / описание" value={product} onChange={(e) => setProduct(e.target.value)} />
        <Input
          type="number"
          placeholder="Базовая цена"
          value={basePrice}
          onChange={(e) => setBasePrice(Number(e.target.value))}
        />
        <div className="flex flex-wrap gap-2">
          {PRESET_REGIONS.map((r) => (
            <button
              key={r.cityId}
              type="button"
              onClick={() => toggle(r.cityId)}
              className={`rounded-full px-3 py-1 text-xs border ${
                selected.includes(r.cityId) ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'border-[var(--color-border)]'
              }`}
            >
              {r.cityId}
            </button>
          ))}
        </div>
        <Button
          onClick={() =>
            publish.mutate({
              product,
              basePrice,
              regions: PRESET_REGIONS.filter((r) => selected.includes(r.cityId)),
            })
          }
          disabled={!product.trim() || publish.isPending}
        >
          Создать региональные черновики
        </Button>
        {publish.data ? (
          <p className="text-xs text-[var(--color-fg-subtle)]">
            {(publish.data as { note?: string }).note} · batch {(publish.data as { batchId?: string }).batchId}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
