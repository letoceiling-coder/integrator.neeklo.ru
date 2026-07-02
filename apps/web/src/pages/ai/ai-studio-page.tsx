import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Save } from 'lucide-react';
import { useAiAgents, useAiSkills, useCreateAgent } from '@/entities/ai/api';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';

const NODE_TYPES = ['planner', 'reasoning', 'tool', 'agent', 'reviewer'] as const;

const initialNodes: Node[] = [
  { id: '1', position: { x: 80, y: 80 }, data: { label: 'Planner' }, type: 'input' },
  { id: '2', position: { x: 280, y: 80 }, data: { label: 'Reasoning' } },
  { id: '3', position: { x: 480, y: 80 }, data: { label: 'Sales Agent' } },
  { id: '4', position: { x: 680, y: 80 }, data: { label: 'Reviewer' }, type: 'output' },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
  { id: 'e3-4', source: '3', target: '4' },
];

export function AiStudioPage() {
  const { data: agents, isLoading: agentsLoading } = useAiAgents();
  const { data: skills } = useAiSkills();
  const createAgent = useCreateAgent();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [name, setName] = useState('Custom Agent');
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['sales']);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  const nodeCount = useMemo(() => nodes.length, [nodes]);

  const addNode = (kind: (typeof NODE_TYPES)[number]) => {
    const id = String(Date.now());
    setNodes((nds) => [
      ...nds,
      {
        id,
        position: { x: 120 + nds.length * 40, y: 200 + nds.length * 20 },
        data: { label: kind.charAt(0).toUpperCase() + kind.slice(1) },
      },
    ]);
  };

  const saveAgent = () => {
    createAgent.mutate({
      name,
      description: `AI Studio graph — ${nodeCount} nodes, ${edges.length} edges`,
      role: 'worker',
      skillIds: selectedSkills,
      toolNames: ['decision.list', 'forecast.get', 'memory.recall'],
    });
  };

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((s) => (s.includes(skillId) ? s.filter((x) => x !== skillId) : [...s, skillId]));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Studio"
        description="Визуальный конструктор агента — Planner → Reasoning → Agent → Reviewer."
      />

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <Card className="space-y-4 p-4">
          <div>
            <label className="text-xs text-[var(--color-fg-subtle)]">Имя агента</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-[var(--color-fg-muted)]">Skills</div>
            <div className="flex flex-wrap gap-2">
              {skills?.map((s) => (
                <button
                  key={s.skillId}
                  type="button"
                  onClick={() => toggleSkill(s.skillId)}
                  className={`rounded-full px-3 py-1 text-xs border ${
                    selectedSkills.includes(s.skillId)
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-[var(--color-border)]'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-[var(--color-fg-muted)]">Добавить узел</div>
            <div className="grid grid-cols-2 gap-2">
              {NODE_TYPES.map((t) => (
                <Button key={t} variant="secondary" size="sm" onClick={() => addNode(t)}>
                  <Plus className="mr-1 h-3 w-3" />
                  {t}
                </Button>
              ))}
            </div>
          </div>

          <Button onClick={saveAgent} disabled={createAgent.isPending} className="w-full">
            <Save className="mr-2 h-4 w-4" />
            Сохранить агента
          </Button>

          <div>
            <div className="mb-2 text-xs font-medium text-[var(--color-fg-muted)]">Каталог</div>
            {agentsLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <ul className="space-y-2 text-xs">
                {agents?.slice(0, 5).map((a) => (
                  <li key={a.id} className="rounded border border-[var(--color-border)] p-2">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-[var(--color-fg-subtle)]">{a.role} · v{a.version}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="h-[calc(100vh-14rem)] overflow-hidden p-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </Card>
      </div>
    </div>
  );
}
