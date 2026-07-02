import { useState } from 'react';
import { useKnowledgeDocs, useKnowledgeUpload } from '@/entities/avito/api';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

const CATEGORIES = ['price_list', 'contract', 'faq', 'policy', 'catalog', 'examples'] as const;

export function AvitoKnowledgePage() {
  const { data: docs } = useKnowledgeDocs();
  const upload = useKnowledgeUpload();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('faq');
  const [content, setContent] = useState('');

  return (
    <div className="space-y-6">
      <PageHeader title="Knowledge Base" description="RAG для AI Sales Agent — прайсы, FAQ, регламенты." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <Input placeholder="Название документа" value={name} onChange={(e) => setName(e.target.value)} />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <textarea
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Текст документа…"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm"
          />
          <Button
            onClick={() => upload.mutate({ name, category, content }, { onSuccess: () => setContent('') })}
            disabled={!name.trim() || !content.trim() || upload.isPending}
          >
            Загрузить и проиндексировать
          </Button>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 text-sm font-medium">Документы</h3>
          <ul className="space-y-2 text-sm">
            {docs?.map((d) => (
              <li key={d.id} className="rounded border border-[var(--color-border)] p-3">
                <div className="font-medium">{d.name}</div>
                <div className="text-xs text-[var(--color-fg-subtle)]">
                  {d.category} · {d.chunkCount} chunks · {d.indexed ? 'indexed' : 'pending'}
                </div>
              </li>
            ))}
            {!docs?.length ? <p className="text-[var(--color-fg-subtle)]">Нет документов</p> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
