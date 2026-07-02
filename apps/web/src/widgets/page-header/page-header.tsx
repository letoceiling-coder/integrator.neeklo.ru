import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  description,
  actions,
}: {
  title: string;
  subtitle?: string;
  description?: string;
  actions?: ReactNode;
}) {
  const sub = subtitle ?? description;
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-[var(--color-fg-subtle)]">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
