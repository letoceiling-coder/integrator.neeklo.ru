import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export function ScrollArea({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-auto', className)}>{children}</div>;
}
