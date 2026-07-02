import { NAVIGATION } from '@/shared/config/navigation';
import { cn } from '@/shared/lib/cn';
import { AppLink } from '@/shared/ui/app-link';

export function Sidebar() {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-primary)] text-[var(--color-primary-fg)] text-sm font-semibold">
          N
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">NEEKLO</div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">Marketplace OS</div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {NAVIGATION.map((group) => (
          <div key={group.label}>
            <div className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-widest text-[var(--color-fg-subtle)]">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <AppLink
                    key={item.path}
                    to={item.path}
                    activeOptions={{ exact: item.path === '/' }}
                    className={cn(
                      'group flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm text-[var(--color-fg-muted)] transition-colors',
                      'hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]',
                    )}
                    activeProps={{
                      className:
                        'bg-[var(--color-surface)] text-[var(--color-fg)] shadow-[inset_0_0_0_1px_var(--color-border)]',
                    }}
                  >
                    <Icon className="h-[15px] w-[15px] opacity-80" />
                    <span className="truncate">{item.label}</span>
                  </AppLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
