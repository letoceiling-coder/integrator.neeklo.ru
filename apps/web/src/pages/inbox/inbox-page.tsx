import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Send, Sparkles, User, Zap } from 'lucide-react';
import { useInbox, useMessages, useSendMessage, useAgentReply, useCustomer360, useDealsPipeline } from '@/entities/commerce/api';
import { useKnowledgeDocs } from '@/entities/avito/api';
import { useCopilotPage } from '@/widgets/copilot/copilot-context';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { Separator } from '@/shared/ui/separator';
import { Card } from '@/shared/ui/card';
import { formatRelativeTime } from '@/shared/lib/format';

export function InboxPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('');
  const { data: conversations, isLoading } = useInbox({ q: filter || undefined });
  const selected = conversations?.find((c) => c.id === selectedId);
  const { data: messages, isLoading: messagesLoading } = useMessages(selectedId);
  const send = useSendMessage(selectedId ?? '');
  const agent = useAgentReply();
  const { data: customer360 } = useCustomer360(selected?.customerId ?? null);
  const { data: deals } = useDealsPipeline();
  const { data: knowledge } = useKnowledgeDocs();

  useCopilotPage('inbox', {
    title: selected?.customerName ?? 'Unified Inbox',
    entityType: 'conversation',
    entityId: selectedId ?? undefined,
    summary: selected?.lastMessagePreview,
  });

  const handleSend = () => {
    if (!selectedId || !draft.trim()) return;
    send.mutate(draft, { onSuccess: () => setDraft('') });
  };

  const handleAiDraft = () => {
    if (!selected) return;
    const lastInbound = [...(messages ?? [])].reverse().find((m) => m.direction === 'inbound');
    if (!lastInbound) return;
    agent.mutate(
      {
        conversationId: selected.id,
        customerId: selected.customerId,
        adId: selected.adId,
        message: lastInbound.text,
      },
      { onSuccess: (res) => setDraft(res.draft) },
    );
  };

  const customerDeals = deals?.flatMap((s) => s.deals.filter((d) => d.customerId === selected?.customerId)) ?? [];

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Threads */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        <div className="border-b border-[var(--color-border)] p-3">
          <Input placeholder="Фильтр…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <ScrollArea className="flex-1">
          {isLoading && [...Array(5)].map((_, i) => <Skeleton key={i} className="m-3 h-14" />)}
          {conversations?.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className={`w-full border-b border-[var(--color-border)] px-3 py-3 text-left transition hover:bg-[var(--color-surface-hover)] ${
                selectedId === c.id ? 'bg-[var(--color-surface)]' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{c.customerName}</span>
                {c.unreadCount > 0 && <Badge tone="info">{c.unreadCount}</Badge>}
              </div>
              <p className="mt-0.5 truncate text-xs text-[var(--color-fg-subtle)]">{c.lastMessagePreview}</p>
            </button>
          ))}
        </ScrollArea>
      </aside>

      {/* Chat */}
      <section className="flex min-w-0 flex-1 flex-col border-r border-[var(--color-border)]">
        {selected ? (
          <>
            <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <div>
                <h2 className="font-semibold">{selected.customerName}</h2>
                <p className="text-xs text-[var(--color-fg-subtle)]">{selected.adTitle ?? selected.subject}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={handleAiDraft} disabled={agent.isPending}>
                  {agent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  AI Draft
                </Button>
                <Button variant="ghost" size="sm" onClick={() => agent.mutate({ conversationId: selected.id, customerId: selected.customerId, adId: selected.adId, message: draft || 'ok', autoSend: true })}>
                  <Zap className="h-4 w-4" /> Auto
                </Button>
              </div>
            </header>

            <ScrollArea className="flex-1 p-4">
              <AnimatePresence initial={false}>
                {messages?.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mb-3 flex ${m.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-[var(--radius-md)] px-3 py-2 text-sm ${
                        m.direction === 'inbound'
                          ? 'bg-[var(--color-surface)] hairline'
                          : 'bg-[var(--color-primary)] text-[var(--color-primary-fg)]'
                      }`}
                    >
                      {m.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </ScrollArea>

            <footer className="border-t border-[var(--color-border)] p-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Сообщение…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                />
                <Button onClick={handleSend} disabled={send.isPending}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-[var(--color-fg-subtle)]">
            <User className="mr-2 h-5 w-5" /> Выберите диалог
          </div>
        )}
      </section>

      {/* Customer 360 */}
      <aside className="hidden w-80 shrink-0 flex-col bg-[var(--color-bg-elevated)] xl:flex">
        <div className="border-b border-[var(--color-border)] px-4 py-3 text-sm font-medium">Customer 360</div>
        <ScrollArea className="flex-1 p-4">
          {!selected ? (
            <p className="text-xs text-[var(--color-fg-subtle)]">Контекст клиента появится здесь</p>
          ) : (
            <div className="space-y-4 text-sm">
              <Card className="p-3">
                <div className="font-medium">{selected.customerName}</div>
                <div className="mt-1 text-xs text-[var(--color-fg-subtle)]">
                  {(customer360 as { channel?: string })?.channel ?? 'Avito'}
                </div>
              </Card>

              <div>
                <h4 className="mb-2 text-xs font-medium uppercase text-[var(--color-fg-subtle)]">Сделки</h4>
                {customerDeals.slice(0, 3).map((d) => (
                  <div key={d.id} className="mb-1 text-xs text-[var(--color-fg-muted)]">
                    {d.stage} · {d.expectedAmount?.amount ?? 0} ₽
                  </div>
                ))}
                {!customerDeals.length && <p className="text-xs text-[var(--color-fg-subtle)]">Нет активных сделок</p>}
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 text-xs font-medium uppercase text-[var(--color-fg-subtle)]">Knowledge</h4>
                <ul className="space-y-1 text-xs">
                  {knowledge?.slice(0, 3).map((k) => (
                    <li key={k.id} className="truncate text-[var(--color-fg-muted)]">
                      {k.name}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-medium uppercase text-[var(--color-fg-subtle)]">AI Summary</h4>
                <p className="text-xs leading-relaxed text-[var(--color-fg-muted)]">
                  Используйте AI Copilot справа для резюме переписки и рекомендаций.
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </aside>
    </div>
  );
}
