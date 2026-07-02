import { useState } from 'react';
import { Loader2, Upload, Wand2 } from 'lucide-react';
import { useMediaAssets } from '@/entities/avito/api';
import { useCopilotPage } from '@/widgets/copilot/copilot-context';
import { PageHeader } from '@/widgets/page-header/page-header';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { api } from '@/shared/api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const JOB_KINDS = [
  { id: 'generate_image', label: 'Image Generation' },
  { id: 'remove_background', label: 'Background Removal' },
  { id: 'enhance', label: 'Upscale / Enhance' },
  { id: 'banner', label: 'Banner Builder' },
  { id: 'infographic', label: 'Infographic' },
  { id: 'presentation', label: 'Presentation' },
  { id: 'pdf', label: 'PDF Builder' },
  { id: 'watermark', label: 'Watermark' },
];

export function MediaStudioPage() {
  const { data: assets } = useMediaAssets();
  const [prompt, setPrompt] = useState('');
  const qc = useQueryClient();

  useCopilotPage('media-studio', {
    title: 'Media Studio',
    summary: `${assets?.length ?? 0} assets in Selectel storage`,
  });

  const createJob = useMutation({
    mutationFn: (kind: string) =>
      api.post('/commerce/media/jobs', { kind, input: { prompt, description: prompt } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['avito', 'media'] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media Studio"
        description="Генерация, улучшение и хранение медиа в Selectel S3 — через существующий Job Engine."
      />

      <Tabs defaultValue="create">
        <TabsList>
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card className="space-y-4 p-6">
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Опишите изображение, баннер или презентацию…"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm"
            />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {JOB_KINDS.map((k) => (
                <Button
                  key={k.id}
                  variant="secondary"
                  size="sm"
                  disabled={!prompt.trim() || createJob.isPending}
                  onClick={() => createJob.mutate(k.id)}
                >
                  {createJob.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Wand2 className="mr-1 h-3 w-3" />}
                  {k.label}
                </Button>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="p-6">
            <ul className="space-y-2 font-mono text-xs">
              {assets?.map((a: { id: string; kind: string; publicUrl: string }) => (
                <li key={a.id} className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] py-2">
                  <span>{a.kind}</span>
                  <a href={a.publicUrl} target="_blank" rel="noreferrer" className="truncate text-[var(--color-primary)]">
                    {a.publicUrl}
                  </a>
                </li>
              ))}
              {!assets?.length && <li className="text-[var(--color-fg-subtle)]">Нет медиа — создайте job</li>}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card className="p-6 text-sm text-[var(--color-fg-muted)]">
            <Upload className="mb-2 h-5 w-5" />
            Шаблоны баннеров и инфографики — подключите через Knowledge Base и повторное использование assets.
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
