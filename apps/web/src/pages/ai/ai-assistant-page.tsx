import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { useAiRun } from '@/entities/ai/api';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';

export function AiAssistantPage() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const run = useAiRun();

  const send = () => {
    if (!input.trim()) return;
    const userText = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: userText }]);
    run.mutate(
      {
        taskType: 'chat',
        input: userText,
        skillIds: ['sales', 'support'],
        context: { channel: 'assistant' },
      },
      {
        onSuccess: (res) => setMessages((m) => [...m, { role: 'assistant', text: res.output }]),
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="AI Ассистент" description="Единый чат через AI Gateway с Memory v2 и Reasoning." />

      <Card className="flex h-[calc(100vh-14rem)] flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <p className="text-sm text-[var(--color-fg-subtle)]">Спросите о клиентах, объявлениях, сделках или стратегии.</p>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-[var(--radius-md)] px-4 py-3 text-sm ${
                  m.role === 'user'
                    ? 'ml-auto bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface)] border border-[var(--color-border)]'
                }`}
              >
                {m.text}
              </div>
            ))
          )}
          {run.isPending ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-fg-subtle)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Orchestrator…
            </div>
          ) : null}
        </div>
        <div className="flex gap-2 border-t border-[var(--color-border)] p-4">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Сообщение…"
          />
          <Button onClick={send} disabled={run.isPending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
