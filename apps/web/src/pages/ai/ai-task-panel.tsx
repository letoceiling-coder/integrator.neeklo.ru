import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useAiRun, type AiTaskType } from '@/entities/ai/api';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';

interface AiTaskPanelProps {
  taskType: AiTaskType;
  title: string;
  placeholder: string;
  skillIds?: string[];
  defaultInput?: string;
}

export function AiTaskPanel({ taskType, title, placeholder, skillIds, defaultInput = '' }: AiTaskPanelProps) {
  const [input, setInput] = useState(defaultInput);
  const [output, setOutput] = useState<string | null>(null);
  const run = useAiRun();

  const handleRun = () => {
    if (!input.trim()) return;
    run.mutate(
      { taskType, input, skillIds, maxSteps: 5 },
      {
        onSuccess: (res) => setOutput(res.output),
      },
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-4 p-6">
        <h3 className="text-sm font-medium">{title}</h3>
        <textarea
          rows={12}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 font-mono text-sm outline-none focus:border-[var(--color-primary)]"
        />
        <Button onClick={handleRun} disabled={run.isPending || !input.trim()}>
          {run.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Запустить AI
        </Button>
        {run.data ? (
          <div className="text-xs text-[var(--color-fg-subtle)]">
            {run.data.model} · {run.data.latencyMs}ms · ${run.data.costUsd.toFixed(4)}
          </div>
        ) : null}
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-medium text-[var(--color-fg-muted)]">Результат</h3>
        {run.isPending ? (
          <div className="text-sm text-[var(--color-fg-subtle)]">Orchestrator выполняет план…</div>
        ) : output ? (
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">{output}</pre>
        ) : (
          <div className="text-sm text-[var(--color-fg-subtle)]">Результат появится здесь после запуска.</div>
        )}
      </Card>
    </div>
  );
}
