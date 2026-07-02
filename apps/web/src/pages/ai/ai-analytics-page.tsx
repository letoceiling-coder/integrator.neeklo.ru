import { PageHeader } from '@/widgets/page-header/page-header';
import { AiTaskPanel } from './ai-task-panel';

export function AiAnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="AI Аналитика" description="Reasoning Engine + Forecast + Metrics через Orchestrator." />
      <AiTaskPanel
        taskType="analytics"
        title="Аналитический запрос"
        placeholder="Например: какие объявления теряют CTR в Москве за последнюю неделю?"
        skillIds={['analytics']}
      />
    </div>
  );
}
