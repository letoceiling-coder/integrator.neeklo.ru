import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-hover)]', className)}
      {...props}
    />
  );
}
