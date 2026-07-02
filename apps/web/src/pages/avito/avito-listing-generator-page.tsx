import { useState } from 'react';
import { Check, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useListingGenerate, useListingPipelines } from '@/entities/avito/api';
import { useCopilotPage } from '@/widgets/copilot/copilot-context';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/cn';

const STEPS = [
  'Исходные данные',
  'AI анализ',
  'Конкуренты',
  'Регион',
  'Генерация',
  'Preview',
  'Quality Check',
  'AI Critic',
  'Сохранение',
];

export function AvitoListingGeneratorPage() {
  const [product, setProduct] = useState('');
  const [regionId, setRegionId] = useState('moscow');
  const [step, setStep] = useState(0);
  const generate = useListingGenerate();
  const { data: pipelines } = useListingPipelines();

  useCopilotPage('listing-studio', { title: 'Listing Studio', summary: product.slice(0, 200) });

  const run = () => {
    generate.mutate(
      { product, regionId, createDraft: true },
      {
        onSuccess: () => {
          setStep(STEPS.length - 1);
        },
      },
    );
    setStep(4);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Listing Studio" description="Пошаговый pipeline генерации объявления с quality check и AI critic." />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <Card className="p-4">
          <nav className="space-y-1">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={cn(
                  'flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-xs',
                  i === step ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'text-[var(--color-fg-subtle)]',
                  i < step ? 'text-[var(--color-success)]' : '',
                )}
              >
                {i < step ? <Check className="h-3 w-3" /> : <span className="w-3 text-center">{i + 1}</span>}
                {s}
              </div>
            ))}
          </nav>
        </Card>

        <Card className="p-6">
          <AnimatePresence mode="wait">
            {step < 4 ? (
              <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <textarea
                  rows={8}
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="Товар, характеристики, аудитория, конкуренты…"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm"
                />
                <input
                  value={regionId}
                  onChange={(e) => setRegionId(e.target.value)}
                  placeholder="regionId"
                  className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
                />
                <Button onClick={() => (step < 3 ? setStep(step + 1) : run())} disabled={!product.trim()}>
                  {step < 3 ? (
                    <>
                      Далее <ChevronRight className="ml-1 h-4 w-4" />
                    </>
                  ) : generate.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Pipeline…
                    </>
                  ) : (
                    'Запустить генерацию'
                  )}
                </Button>
              </motion.div>
            ) : (
              <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {generate.data ? (
                  <>
                    <div className="text-sm">
                      Quality: <strong>{generate.data.qualityScore ?? '—'}%</strong>
                      {generate.data.adId ? ` · Draft ${generate.data.adId}` : ''}
                    </div>
                    <pre className="whitespace-pre-wrap rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-sm">
                      {generate.data.finalDescription ?? generate.data.finalTitle}
                    </pre>
                  </>
                ) : (
                  <p className="text-sm text-[var(--color-fg-subtle)]">Pipeline выполняется на backend (8 AI steps)…</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-medium">История pipeline</h3>
        <ul className="space-y-1 text-xs">
          {pipelines?.slice(0, 8).map((p) => (
            <li key={p.id} className="flex justify-between text-[var(--color-fg-muted)]">
              <span className="truncate">{p.productInput.slice(0, 50)}</span>
              <span>{p.status}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
