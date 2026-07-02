import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

const badge = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-[var(--color-surface-hover)] text-[var(--color-fg-muted)]',
        success: 'bg-[color-mix(in_oklch,var(--color-success)_18%,transparent)] text-[var(--color-success)]',
        warning: 'bg-[color-mix(in_oklch,var(--color-warning)_18%,transparent)] text-[var(--color-warning)]',
        danger: 'bg-[color-mix(in_oklch,var(--color-danger)_18%,transparent)] text-[var(--color-danger)]',
        info: 'bg-[color-mix(in_oklch,var(--color-primary)_18%,transparent)] text-[var(--color-primary)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badge> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
