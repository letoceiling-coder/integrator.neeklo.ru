import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from '@tanstack/react-router';
import {
  Search,
  MessageSquare,
  Users,
  Target,
  Store,
  Wallet,
  Map,
  Sparkles,
  BookOpen,
  BarChart3,
  Crown,
} from 'lucide-react';
import { useGlobalSearch } from '@/entities/commerce/api';
import { useKnowledgeDocs } from '@/entities/avito/api';
import { ALL_NAV_ITEMS } from '@/shared/config/navigation';
import { useAiRun } from '@/entities/ai/api';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUICK = [
  { label: 'Executive Mode', path: '/executive', icon: Crown },
  { label: 'AI Copilot: daily briefing', action: 'ai-briefing', icon: Sparkles },
  { label: 'Listing Studio', path: '/avito/listing', icon: Store },
  { label: 'Media Studio', path: '/media/studio', icon: BarChart3 },
  { label: 'Knowledge Base', path: '/avito/knowledge', icon: BookOpen },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { data: results } = useGlobalSearch(query);
  const { data: knowledge } = useKnowledgeDocs();
  const ai = useAiRun();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  const go = (path: string) => {
    onOpenChange(false);
    setQuery('');
    void navigate({ to: path });
  };

  const icons: Record<string, typeof Search> = {
    '/chats': MessageSquare,
    '/customers': Users,
    '/deals': Target,
    '/ads': Store,
    '/budget': Wallet,
    '/analytics/regional': Map,
  };

  const kbMatches =
    query.length >= 2
      ? knowledge?.filter((k) => k.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
      : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[12vh] backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
      role="presentation"
    >
      <div
        className="glass hairline w-full max-w-2xl overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command Center"
      >
        <Command label="Command Center" shouldFilter={false}>
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4">
            <Search className="h-4 w-4 text-[var(--color-fg-subtle)]" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Command Center — объявления, клиенты, регионы, KB, AI… ⌘K"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-fg-subtle)]"
            />
          </div>
          <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-[var(--color-fg-subtle)]">Ничего не найдено</Command.Empty>

            {query.length < 2 && (
              <>
                <Command.Group heading="Quick actions" className="cmdk-group">
                  {QUICK.map((q) => {
                    const Icon = q.icon;
                    return (
                      <Command.Item
                        key={q.label}
                        onSelect={() => {
                          if (q.path) go(q.path);
                          else if (q.action === 'ai-briefing') {
                            ai.mutate({ taskType: 'analytics', input: 'Daily briefing for Avito seller', skillIds: ['analytics'] });
                            go('/');
                          }
                        }}
                        className="cmdk-item"
                      >
                        <Icon className="h-4 w-4" /> {q.label}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
                <Command.Group heading="Navigation" className="cmdk-group">
                  {ALL_NAV_ITEMS.slice(0, 16).map((item) => {
                    const Icon = icons[item.path] ?? Search;
                    return (
                      <Command.Item key={item.path} onSelect={() => go(item.path)} className="cmdk-item">
                        <Icon className="h-4 w-4" /> {item.label}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              </>
            )}

            {Array.isArray(results) && results.length > 0 && (
              <Command.Group heading="Search" className="cmdk-group">
                {results.map((r: { entityType: string; entityId: string; title: string; body?: string }) => (
                  <Command.Item
                    key={`${r.entityType}-${r.entityId}`}
                    onSelect={() => {
                      const paths: Record<string, string> = {
                        ad: '/ads',
                        customer: '/customers',
                        conversation: '/chats',
                      };
                      go(paths[r.entityType] ?? '/');
                    }}
                    className="cmdk-item flex-col items-start"
                  >
                    <span className="font-medium">{r.title}</span>
                    <span className="text-xs text-[var(--color-fg-subtle)]">{r.entityType}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {kbMatches && kbMatches.length > 0 && (
              <Command.Group heading="Knowledge Base" className="cmdk-group">
                {kbMatches.map((k) => (
                  <Command.Item key={k.id} onSelect={() => go('/avito/knowledge')} className="cmdk-item">
                    <BookOpen className="h-4 w-4" /> {k.name}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
      <style>{`
        .cmdk-group [cmdk-group-heading] { padding: 0.5rem 0.75rem; font-size: 0.65rem; text-transform: uppercase; color: var(--color-fg-subtle); }
        .cmdk-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.625rem 0.75rem; border-radius: var(--radius-md); cursor: pointer; font-size: 0.875rem; }
        .cmdk-item[aria-selected='true'] { background: var(--color-surface-hover); }
      `}</style>
    </div>
  );
}
