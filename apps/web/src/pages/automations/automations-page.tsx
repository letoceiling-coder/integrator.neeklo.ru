import { useCallback } from 'react';
import { ReactFlow, Background, Controls, addEdge, useNodesState, useEdgesState, type Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { useAutomations } from '@/entities/commerce/api';

const initialNodes = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: 'Event: message_received' }, type: 'input' },
  { id: '2', position: { x: 0, y: 100 }, data: { label: 'Condition: unread > 0' } },
  { id: '3', position: { x: 0, y: 200 }, data: { label: 'AI: draft reply' } },
  { id: '4', position: { x: 0, y: 300 }, data: { label: 'Action: notify manager' }, type: 'output' },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
  { id: 'e3-4', source: '3', target: '4' },
];

export function AutomationsPage() {
  const { data: automations } = useAutomations();
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automation Studio"
        description="Визуальный редактор сценариев на базе Workflow Engine."
        action={<Button size="sm">Сохранить</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <Card className="p-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">Блоки</h3>
          <ul className="space-y-2 text-sm text-[var(--color-fg-muted)]">
            {['Event', 'Condition', 'Decision', 'Delay', 'AI', 'Action', 'Marketplace', 'Notification'].map((b) => (
              <li key={b} className="cursor-grab rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-[var(--color-surface-hover)]">{b}</li>
            ))}
          </ul>
          {automations && automations.length > 0 && (
            <div className="mt-6 border-t border-[var(--color-border)] pt-4">
              <h3 className="mb-2 text-xs font-medium text-[var(--color-fg-subtle)]">Сохранённые</h3>
              {automations.map((a: { id: string; name: string }) => (
                <div key={a.id} className="truncate text-sm">{a.name}</div>
              ))}
            </div>
          )}
        </Card>

        <Card className="h-[560px] overflow-hidden">
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView>
            <Background color="var(--color-border)" gap={16} />
            <Controls />
          </ReactFlow>
        </Card>
      </div>
    </div>
  );
}
