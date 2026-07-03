import { useMemo, useState } from 'react';
import { DndContext, closestCenter, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AvitoLeadDto, AvitoPipelineStage, AvitoSmartReplyDto } from '@neeklo/contracts';
import { useAvitoAccounts } from '@/entities/avito/api';
import {
  useAvitoSalesAgentConfig,
  useAvitoSalesCalendar,
  useAvitoSalesCreateDocument,
  useAvitoSalesCreateTask,
  useAvitoSalesDashboard,
  useAvitoSalesDealAnalysis,
  useAvitoSalesDocuments,
  useAvitoSalesInbox,
  useAvitoSalesLeads,
  useAvitoSalesMovePipeline,
  useAvitoSalesNotifications,
  useAvitoSalesPipeline,
  useAvitoSalesSmartReplies,
  useAvitoSalesSyncMessenger,
  useAvitoSalesTasks,
  useAvitoSalesUpdateAgentConfig,
} from '@/entities/avito-sales/api';
import { useSendMessage } from '@/entities/commerce/api';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format';

const SECTIONS = [
  'Lead Center',
  'Pipeline',
  'Smart Inbox',
  'Customer 360',
  'AI Agent',
  'Smart Replies',
  'Tasks',
  'Calendar',
  'Documents',
  'Deal Analyzer',
  'Notifications',
  'Executive Dashboard',
] as const;

type Section = (typeof SECTIONS)[number];

export function AvitoSalesPage() {
  const { data: accounts } = useAvitoAccounts();
  const [accountId, setAccountId] = useState<string | undefined>();
  const activeAccountId = accountId ?? accounts?.[0]?.id;
  const [section, setSection] = useState<Section>('Lead Center');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [replyText, setReplyText] = useState('');
  const [smartReplies, setSmartReplies] = useState<AvitoSmartReplyDto[]>([]);

  const { data: leads, isLoading: leadsLoading } = useAvitoSalesLeads();
  const { data: pipeline, isLoading: pipeLoading } = useAvitoSalesPipeline();
  const { data: inbox } = useAvitoSalesInbox(conversationId);
  const { data: dashboard } = useAvitoSalesDashboard();
  const { data: tasks } = useAvitoSalesTasks();
  const { data: documents } = useAvitoSalesDocuments();
  const { data: notifications } = useAvitoSalesNotifications(true);
  const { data: agentConfig } = useAvitoSalesAgentConfig(activeAccountId);
  const movePipeline = useAvitoSalesMovePipeline();
  const smartReply = useAvitoSalesSmartReplies();
  const syncMessenger = useAvitoSalesSyncMessenger();
  const updateAgentConfig = useAvitoSalesUpdateAgentConfig();
  const createTask = useAvitoSalesCreateTask();
  const createDocument = useAvitoSalesCreateDocument();

  const selectedConv = inbox?.selectedConversation as { id: string; customerId: string; adId?: string | null; customerName?: string } | null;
  const send = useSendMessage(selectedConv?.id ?? '');
  const dealId = inbox?.lead?.dealId ?? undefined;
  const { data: dealAnalysis } = useAvitoSalesDealAnalysis(dealId);

  const calFrom = useMemo(() => new Date().toISOString(), []);
  const calTo = useMemo(() => new Date(Date.now() + 30 * 86400_000).toISOString(), []);
  const { data: calendar } = useAvitoSalesCalendar(calFrom, calTo);

  function onDragEnd(event: DragEndEvent) {
    const leadId = event.active.id as string;
    const overId = event.over?.id as string | undefined;
    if (!overId || !leadId) return;
    const stage =
      pipeline?.some((c) => c.stage === overId)
        ? (overId as AvitoPipelineStage)
        : pipeline?.find((c) => c.leads.some((l) => l.id === overId))?.stage;
    if (stage) movePipeline.mutate({ leadId, stage });
  }

  async function loadSmartReplies() {
    if (!selectedConv) return;
    const msgs = inbox?.messages as { text: string }[] | undefined;
    const lastInbound = msgs?.filter((m) => (m as { direction?: string }).direction === 'inbound').pop();
    const res = await smartReply.mutateAsync({
      conversationId: selectedConv.id,
      customerId: selectedConv.customerId,
      adId: selectedConv.adId ?? null,
      message: lastInbound?.text ?? 'Здравствуйте',
      accountId: activeAccountId,
    });
    setSmartReplies(res);
  }

  return (
    <div className="space-y-4 pb-8">
      <PageHeader
        title="Avito Sales Center"
        description="Enterprise CRM — лиды, pipeline, Smart Inbox, AI Agent. Read models only."
        actions={
          activeAccountId ? (
            <Button size="sm" onClick={() => syncMessenger.mutate(activeAccountId)} disabled={syncMessenger.isPending}>
              Sync Messenger → CRM
            </Button>
          ) : null
        }
      />

      <select className="border rounded px-2 py-1 text-sm" value={activeAccountId ?? ''} onChange={(e) => setAccountId(e.target.value)}>
        {accounts?.map((a) => (
          <option key={a.id} value={a.id}>{a.displayName}</option>
        ))}
      </select>

      <div className="flex flex-wrap gap-1 border-b pb-2 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button key={s} type="button" onClick={() => setSection(s)} className={`px-3 py-1.5 text-sm whitespace-nowrap rounded-t ${section === s ? 'bg-[var(--color-bg-muted)] font-medium' : 'text-[var(--color-fg-subtle)]'}`}>
            {s}
          </button>
        ))}
      </div>

      {section === 'Lead Center' && (
        leadsLoading ? <Skeleton className="h-64" /> : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-[var(--color-fg-subtle)]"><th className="p-2">Клиент</th><th className="p-2">Объявление</th><th className="p-2">Статус</th><th className="p-2">AI</th><th className="p-2">Forecast</th><th className="p-2">Активность</th></tr></thead>
              <tbody>
                {leads?.map((l) => (
                  <tr key={l.id} className="border-b hover:bg-[var(--color-surface-hover)] cursor-pointer" onClick={() => { setConversationId(l.conversationId ?? undefined); setSection('Smart Inbox'); }}>
                    <td className="p-2"><div className="font-medium">{l.customerName}</div><div className="text-xs">{l.phone ?? '—'}</div></td>
                    <td className="p-2 text-xs">{l.adTitle ?? '—'}</td>
                    <td className="p-2"><Badge tone="neutral">{l.pipelineStage}</Badge></td>
                    <td className="p-2">{l.aiScore.toFixed(0)} / {formatPercent(l.purchaseProbability)}</td>
                    <td className="p-2">{l.forecast ?? '—'}</td>
                    <td className="p-2 text-xs">{l.lastActivityAt ? new Date(l.lastActivityAt).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      )}

      {section === 'Pipeline' && (
        pipeLoading ? <Skeleton className="h-64" /> : (
          <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-4">
              {pipeline?.map((col) => (
                <PipelineColumn key={col.stage} col={col} />
              ))}
            </div>
          </DndContext>
        )
      )}

      {section === 'Smart Inbox' && (
        <div className="grid gap-4 lg:grid-cols-12 h-[600px]">
          <Card className="lg:col-span-3 overflow-y-auto p-2 space-y-1">
            {(inbox?.conversations as { id: string; customerName: string; lastMessagePreview: string; unreadCount: number }[] | undefined)?.map((c) => (
              <button key={c.id} type="button" onClick={() => setConversationId(c.id)} className={`w-full text-left p-2 rounded text-sm ${conversationId === c.id ? 'bg-[var(--color-bg-muted)]' : 'hover:bg-[var(--color-surface-hover)]'}`}>
                <div className="font-medium">{c.customerName}</div>
                <div className="text-xs line-clamp-1 text-[var(--color-fg-subtle)]">{c.lastMessagePreview}</div>
                {c.unreadCount > 0 ? <Badge tone="warning">{c.unreadCount}</Badge> : null}
              </button>
            ))}
          </Card>
          <Card className="lg:col-span-5 flex flex-col p-3">
            <div className="flex-1 overflow-y-auto space-y-2 mb-3">
              {(inbox?.messages as { id: string; direction: string; text: string; sentAt: string }[] | undefined)?.map((m) => (
                <div key={m.id} className={`max-w-[85%] rounded p-2 text-sm ${m.direction === 'outbound' ? 'ml-auto bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-muted)]'}`}>{m.text}</div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Ответ…" />
              <Button size="sm" onClick={() => selectedConv && replyText && send.mutate(replyText)}>Send</Button>
              <Button size="sm" variant="secondary" onClick={() => void loadSmartReplies()}>AI 5×</Button>
            </div>
          </Card>
          <Card className="lg:col-span-4 overflow-y-auto p-3 text-sm space-y-3">
            <h3 className="font-medium">Customer 360</h3>
            {inbox?.customer360 ? (
              <>
                <p>Deals: {inbox.customer360.deals.length} · Conversations: {inbox.customer360.conversations.length}</p>
                <p>Forecast: {inbox.customer360.forecast ?? '—'}</p>
                {inbox.lead ? <Badge tone="info">Lead: {inbox.lead.pipelineStage}</Badge> : null}
              </>
            ) : <p className="text-[var(--color-fg-subtle)]">Выберите диалог</p>}
          </Card>
        </div>
      )}

      {section === 'Customer 360' && inbox?.customer360 && (
        <Card className="p-4 space-y-4">
          <pre className="text-xs overflow-auto max-h-96">{JSON.stringify(inbox.customer360, null, 2)}</pre>
        </Card>
      )}

      {section === 'AI Agent' && agentConfig && activeAccountId && (
        <Card className="p-4 space-y-3 max-w-lg">
          <label className="flex items-center gap-2"><input type="checkbox" checked={agentConfig.enabled} onChange={(e) => updateAgentConfig.mutate({ ...agentConfig, enabled: e.target.checked })} /> Enabled</label>
          <label className="block text-sm">Tone<select className="ml-2 border rounded px-2" value={agentConfig.tone} onChange={(e) => updateAgentConfig.mutate({ ...agentConfig, tone: e.target.value as typeof agentConfig.tone })}><option value="formal">formal</option><option value="friendly">friendly</option><option value="professional">professional</option></select></label>
          <label className="block text-sm">Max discount %<Input type="number" className="mt-1 w-24" value={agentConfig.maxDiscountPct} onChange={(e) => updateAgentConfig.mutate({ ...agentConfig, maxDiscountPct: Number(e.target.value) })} /></label>
          {(['useKnowledgeBase', 'useHistory', 'useCrm', 'useForecast', 'useDecisionEngine', 'useMemory', 'handoffToManager'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={agentConfig[k]} onChange={(e) => updateAgentConfig.mutate({ ...agentConfig, [k]: e.target.checked })} /> {k}</label>
          ))}
        </Card>
      )}

      {section === 'Smart Replies' && (
        <Card className="p-4 space-y-2">
          {smartReplies.length ? smartReplies.map((r) => (
            <div key={r.id} className="border rounded p-3 text-sm"><Badge tone="neutral">{r.tone}</Badge> {r.text.slice(0, 200)}<Button size="sm" className="ml-2" onClick={() => setReplyText(r.text)}>Use</Button></div>
          )) : <p className="text-sm text-[var(--color-fg-subtle)]">Откройте Smart Inbox и нажмите AI 5×</p>}
        </Card>
      )}

      {section === 'Tasks' && (
        <Card className="p-4">
          <Button size="sm" className="mb-3" onClick={() => createTask.mutate({ title: 'Follow-up клиент', priority: 'normal' })}>+ Task</Button>
          <ul className="space-y-2 text-sm">{(tasks as { id: string; title: string; priority: string }[] | undefined)?.map((t) => <li key={t.id} className="border-b pb-2">{t.title} <Badge tone="neutral">{t.priority}</Badge></li>)}</ul>
        </Card>
      )}

      {section === 'Calendar' && (
        <Card className="p-4 text-sm">
          <ul>{(calendar as { id: string; title: string; startsAt: string }[] | undefined)?.map((e) => <li key={e.id}>{new Date(e.startsAt).toLocaleString()} — {e.title}</li>)}</ul>
        </Card>
      )}

      {section === 'Documents' && (
        <Card className="p-4">
          <Button size="sm" className="mb-3" onClick={() => createDocument.mutate({ kind: 'proposal', title: 'КП', content: 'Commercial proposal body' })}>+ КП</Button>
          <ul className="text-sm space-y-1">{(documents as { id: string; title: string; kind: string; publicUrl?: string }[] | undefined)?.map((d) => <li key={d.id}><a href={d.publicUrl} className="text-[var(--color-primary)]">{d.kind}: {d.title}</a></li>)}</ul>
        </Card>
      )}

      {section === 'Deal Analyzer' && dealAnalysis && (
        <Card className="p-4 space-y-2 text-sm">
          <Badge tone={dealAnalysis.outcome === 'won' ? 'success' : dealAnalysis.outcome === 'lost' ? 'danger' : 'neutral'}>{dealAnalysis.outcome}</Badge>
          <p>{dealAnalysis.aiSummary}</p>
          <ul>{dealAnalysis.improvements.map((i) => <li key={i}>{i}</li>)}</ul>
        </Card>
      )}

      {section === 'Notifications' && (
        <Card className="p-4 text-sm space-y-2">
          {(notifications as { id: string; title: string; body: string }[] | undefined)?.map((n) => <div key={n.id} className="border-b pb-2"><strong>{n.title}</strong> — {n.body}</div>)}
        </Card>
      )}

      {section === 'Executive Dashboard' && dashboard && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4"><p className="text-xs text-[var(--color-fg-subtle)]">Конверсия</p><p className="text-2xl font-semibold">{formatPercent(dashboard.conversionRate)}</p></Card>
          <Card className="p-4"><p className="text-xs text-[var(--color-fg-subtle)]">Продажи</p><p className="text-2xl font-semibold">{formatMoney(dashboard.totalSales)}</p></Card>
          <Card className="p-4"><p className="text-xs text-[var(--color-fg-subtle)]">Средний чек</p><p className="text-2xl font-semibold">{formatMoney(dashboard.avgCheck)}</p></Card>
          <Card className="p-4"><p className="text-xs text-[var(--color-fg-subtle)]">Лиды</p><p className="text-2xl font-semibold">{formatNumber(dashboard.leadsCount)}</p></Card>
          <Card className="p-4 md:col-span-2"><h3 className="font-medium mb-2">Воронка</h3>{dashboard.funnel.map((f) => <div key={f.stage} className="flex justify-between text-sm"><span>{f.stage}</span><span>{f.count}</span></div>)}</Card>
          <Card className="p-4 md:col-span-2"><h3 className="font-medium mb-2">AI</h3>{dashboard.aiRecommendations.map((r) => <p key={r} className="text-sm">{r}</p>)}</Card>
        </div>
      )}
    </div>
  );
}

function PipelineColumn({ col }: { col: { stage: AvitoPipelineStage; label: string; count: number; leads: AvitoLeadDto[] } }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.stage });
  return (
    <div className="min-w-[220px] shrink-0">
      <div className="flex justify-between mb-2 px-1"><span className="text-sm font-medium">{col.label}</span><Badge tone="neutral">{col.count}</Badge></div>
      <SortableContext id={col.stage} items={col.leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={`min-h-[200px] rounded border border-dashed p-2 space-y-2 ${isOver ? 'bg-[var(--color-bg-muted)]' : ''}`}>
          {col.leads.map((l) => <PipelineCard key={l.id} lead={l} />)}
        </div>
      </SortableContext>
    </div>
  );
}

function PipelineCard({ lead }: { lead: AvitoLeadDto }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="p-2 text-xs cursor-grab">
        <p className="font-medium">{lead.customerName}</p>
        <p className="text-[var(--color-fg-subtle)] line-clamp-1">{lead.adTitle ?? '—'}</p>
      </Card>
    </div>
  );
}
