import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-[var(--radius-md)] bg-[var(--color-bg-elevated)] px-3 text-sm text-[var(--color-fg)] hairline placeholder:text-[var(--color-fg-subtle)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
