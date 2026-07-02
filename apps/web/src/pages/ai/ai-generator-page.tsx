import { PageHeader } from '@/widgets/page-header/page-header';
import { AiTaskPanel } from './ai-task-panel';

export function AiGeneratorPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Генератор"
        description="Pipeline генерации объявления через AI Platform: анализ → SEO → оптимизация."
      />
      <AiTaskPanel
        taskType="listing"
        title="Описание товара или черновик"
        placeholder="Введите название товара, характеристики, целевой регион…"
        skillIds={['listing', 'marketing']}
        defaultInput="Сгенерируй оптимизированное объявление для маркетплейса."
      />
    </div>
  );
}
