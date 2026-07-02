import { useTasks } from '@/entities/commerce/api';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';

export function TasksPage() {
  const { data: tasks, isLoading } = useTasks();

  return (
    <div className="space-y-6">
      <PageHeader title="Task Center" description="Задачи, создаваемые AI и автоматизациями." />
      <Card className="divide-y divide-[var(--color-border)]">
        {isLoading && [...Array(5)].map((_, i) => <Skeleton key={i} className="m-4 h-14" />)}
        {tasks?.map((t) => (
          <div key={t.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="font-medium">{t.title}</div>
              <div className="text-xs text-[var(--color-fg-subtle)]">{t.description || '—'}</div>
            </div>
            <div className="flex items-center gap-2">
              {t.createdByAi && <Badge tone="info">AI</Badge>}
              <Badge tone={t.priority === 'urgent' ? 'danger' : 'neutral'}>{t.priority}</Badge>
            </div>
          </div>
        ))}
        {!isLoading && tasks?.length === 0 && (
          <p className="py-12 text-center text-sm text-[var(--color-fg-subtle)]">Нет открытых задач</p>
        )}
      </Card>
    </div>
  );
}
