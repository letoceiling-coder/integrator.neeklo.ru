import { Outlet, useRouterState } from '@tanstack/react-router';
import { Sidebar } from '@/widgets/sidebar/sidebar';
import { Topbar } from '@/widgets/topbar/topbar';
import { AiCopilotPanel } from '@/widgets/copilot/ai-copilot-panel';
import { cn } from '@/shared/lib/cn';

interface AppShellProps {
  onOpenSearch?: () => void;
}

const FULL_BLEED = new Set(['/chats', '/ads', '/executive']);

export function AppShell({ onOpenSearch }: AppShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fullBleed = FULL_BLEED.has(pathname) || pathname.startsWith('/ads/');

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenSearch={onOpenSearch} />
        <div className="flex min-h-0 flex-1">
          <main className={cn('min-w-0 flex-1 overflow-y-auto', fullBleed ? 'overflow-hidden' : '')}>
            <div
              className={cn(
                'mx-auto h-full w-full',
                fullBleed ? 'max-w-none px-0 py-0' : 'max-w-[1600px] px-6 py-6',
              )}
            >
              <Outlet />
            </div>
          </main>
          <AiCopilotPanel />
        </div>
      </div>
    </div>
  );
}
