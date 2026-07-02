import { Search, LogOut, Sun, Moon } from 'lucide-react';
import { useCurrentUser, logout } from '@/features/auth/session';
import { useTheme } from '@/shared/lib/theme';
import { Button } from '@/shared/ui/button';
import { CopilotExpandButton } from '@/widgets/copilot/ai-copilot-panel';
interface TopbarProps {
  onOpenSearch?: () => void;
}

export function Topbar({ onOpenSearch }: TopbarProps) {
  const { data: user } = useCurrentUser();
  const { theme, toggle } = useTheme();

  return (
    <header className="glass sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-[var(--color-border)] px-5">
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-9 max-w-md flex-1 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-bg-elevated)] px-3 hairline text-[var(--color-fg-subtle)] transition hover:bg-[var(--color-surface-hover)]"
      >
        <Search className="h-4 w-4" />
        <span className="text-sm">Search everywhere…</span>
        <kbd className="ml-auto rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] text-[var(--color-fg-muted)]">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <CopilotExpandButton />
        <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        {user && (
          <div className="text-right leading-tight">
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-[11px] capitalize text-[var(--color-fg-subtle)]">{user.role}</div>
          </div>
        )}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-[var(--color-primary-fg)]">
          {user?.name?.[0] ?? 'N'}
        </div>
        <Button variant="ghost" size="icon" onClick={logout} title="Выйти">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
