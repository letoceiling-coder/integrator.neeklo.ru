import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { MODULE_META } from '@/shared/config/navigation';
import { Card } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { PageHeader } from '@/widgets/page-header/page-header';

interface ModulePageProps {
  title: string;
  path: string;
  capabilities: string[];
}

/**
 * Every module route renders a finished-looking scaffold: purpose, planned capabilities and a
 * calm empty state — never a blank screen. Feature slices replace this as they land.
 */
export function ModulePage({ title, path, capabilities }: ModulePageProps) {
  const meta = MODULE_META[path];
  const Icon = meta?.icon ?? Sparkles;

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={meta?.hint} actions={<Badge tone="info">В разработке</Badge>} />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-[color-mix(in_oklch,var(--color-primary)_16%,transparent)] text-[var(--color-primary)]">
            <Icon className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="max-w-md text-sm text-[var(--color-fg-subtle)]">{meta?.hint}</p>
        </Card>
      </motion.div>

      <div>
        <div className="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--color-fg-subtle)]">
          Возможности модуля
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
            >
              <Card className="flex items-start gap-3 p-4">
                <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                <span className="text-sm text-[var(--color-fg-muted)]">{cap}</span>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
