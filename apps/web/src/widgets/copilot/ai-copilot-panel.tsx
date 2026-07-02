import { useState } from 'react';
import { Loader2, PanelRightClose, PanelRightOpen, Send, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAiRun } from '@/entities/ai/api';
import { useCopilot } from './copilot-context';
import { Button } from '@/shared/ui/button';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { cn } from '@/shared/lib/cn';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export function AiCopilotPanel() {
  const { context, collapsed, setCollapsed } = useCopilot();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const run = useAiRun();

  const send = () => {
    if (!input.trim()) return;
    const userText = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: userText }]);

    const prompt = [
      `Page: ${context.page}`,
      context.title ? `Title: ${context.title}` : '',
      context.entityType ? `Entity: ${context.entityType} ${context.entityId ?? ''}` : '',
      context.summary ? `Context:\n${context.summary}` : '',
      context.hints?.length ? `Hints: ${context.hints.join('; ')}` : '',
      `User: ${userText}`,
    ]
      .filter(Boolean)
      .join('\n');

    run.mutate(
      { taskType: 'analytics', input: prompt, skillIds: ['sales', 'analytics', 'support'], maxSteps: 5 },
      { onSuccess: (res) => setMessages((m) => [...m, { role: 'assistant', text: res.output }]) },
    );
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-primary-fg)] shadow-[var(--shadow-soft)] transition hover:scale-105"
        title="Open AI Copilot"
      >
        <Sparkles className="h-5 w-5" />
      </button>
    );
  }

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
          <div>
            <div className="text-sm font-medium">AI Copilot</div>
            <div className="text-[10px] capitalize text-[var(--color-fg-subtle)]">{context.page}</div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(true)} title="Collapse">
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </header>

      <ScrollArea className="flex-1 p-4">
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <p className="text-xs leading-relaxed text-[var(--color-fg-subtle)]">
              Я знаю контекст текущей страницы. Спросите об аналитике, объявлениях, клиентах или попросите действие.
            </p>
          ) : (
            messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('mb-3 text-sm', m.role === 'user' ? 'text-[var(--color-fg-muted)]' : 'text-[var(--color-fg)]')}
              >
                <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
                  {m.role === 'user' ? 'You' : 'Copilot'}
                </div>
                <div className="whitespace-pre-wrap rounded-[var(--radius-md)] bg-[var(--color-surface)] p-3 hairline">{m.text}</div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
        {run.isPending ? (
          <div className="flex items-center gap-2 text-xs text-[var(--color-fg-subtle)]">
            <Loader2 className="h-3 w-3 animate-spin" /> Думаю…
          </div>
        ) : null}
      </ScrollArea>

      <footer className="border-t border-[var(--color-border)] p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Спросить Copilot…"
            className="h-9 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm outline-none focus:border-[var(--color-primary)]"
          />
          <Button size="icon" onClick={send} disabled={run.isPending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </footer>
    </aside>
  );
}

export function CopilotExpandButton() {
  const { collapsed, setCollapsed } = useCopilot();
  if (!collapsed) return null;
  return (
    <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} title="Open Copilot">
      <PanelRightOpen className="h-4 w-4" />
    </Button>
  );
}
