import { PageHeader } from '@/widgets/page-header/page-header';
import { AiTaskPanel } from './ai-task-panel';

export function AiMediaPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="AI Медиа" description="Vision и OCR через Tool Runtime и model router." />
      <AiTaskPanel
        taskType="vision"
        title="Описание медиа-задачи"
        placeholder="Опишите фото, баннер или инфографику для генерации/анализа…"
        skillIds={['listing']}
      />
    </div>
  );
}
