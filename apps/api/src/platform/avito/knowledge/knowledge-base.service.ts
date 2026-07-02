import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AvitoEventType } from '@neeklo/contracts';
import type { KnowledgeUploadDto } from '@neeklo/contracts';
import type { AppendContext } from '@neeklo/kernel';
import { PrismaService } from '../../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { AvitoEventPublisher } from '../events/avito-event.publisher';
import { AiMemoryEngine } from '../../intelligence/memory/ai-memory.engine';

const CHUNK_SIZE = 800;

/** Knowledge Base — document upload, chunking, RAG retrieval for AI agent. */
@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly publisher: AvitoEventPublisher,
    private readonly memory: AiMemoryEngine,
  ) {}

  async upload(tenantId: string, dto: KnowledgeUploadDto, ctx: AppendContext) {
    const documentId = uuid();
    const stored = await this.storage.putObject(tenantId, 'knowledge', `${documentId}.txt`, dto.content, dto.mimeType);

    await this.prisma.knowledgeDocumentReadModel.create({
      data: {
        id: documentId,
        tenantId,
        name: dto.name,
        category: dto.category,
        mimeType: dto.mimeType,
        sizeBytes: stored.sizeBytes,
        storageKey: stored.key,
        createdAt: new Date(),
      },
    });

    await this.publisher.publish(tenantId, `kb:${documentId}`, AvitoEventType.KnowledgeDocumentUploaded, {
      documentId,
      name: dto.name,
      category: dto.category,
      mimeType: dto.mimeType,
      sizeBytes: stored.sizeBytes,
      storageKey: stored.key,
    }, ctx);

    const chunks = this.chunkText(dto.content);
    for (let i = 0; i < chunks.length; i++) {
      await this.prisma.knowledgeChunkReadModel.create({
        data: {
          tenantId,
          documentId,
          chunkIndex: i,
          content: chunks[i]!,
          embedding: [],
        },
      });
    }

    await this.prisma.knowledgeDocumentReadModel.update({
      where: { id: documentId },
      data: { chunkCount: chunks.length, indexed: true },
    });

    await this.memory.remember(tenantId, 'tenant', tenantId, 'knowledge', `${dto.name}: ${chunks[0]?.slice(0, 200)}`, {
      documentId,
      category: dto.category,
    });

    await this.publisher.publish(tenantId, `kb:${documentId}`, AvitoEventType.KnowledgeChunkIndexed, {
      documentId,
      chunkCount: chunks.length,
      indexedAt: new Date().toISOString(),
    }, ctx);

    return { documentId, chunkCount: chunks.length };
  }

  list(tenantId: string) {
    return this.prisma.knowledgeDocumentReadModel.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async retrieve(tenantId: string, query: string, limit = 5) {
    const chunks = await this.prisma.knowledgeChunkReadModel.findMany({
      where: {
        tenantId,
        content: { contains: query.split(' ')[0] ?? query, mode: 'insensitive' },
      },
      take: limit,
      orderBy: { chunkIndex: 'asc' },
    });

    if (chunks.length === 0) {
      return this.prisma.knowledgeChunkReadModel.findMany({
        where: { tenantId },
        take: limit,
        orderBy: { chunkIndex: 'asc' },
      });
    }

    return chunks;
  }

  async buildRagContext(tenantId: string, query: string): Promise<string> {
    const chunks = await this.retrieve(tenantId, query, 5);
    if (!chunks.length) return '';
    return chunks.map((c, i) => `[KB ${i + 1}] ${c.content}`).join('\n\n');
  }

  private chunkText(text: string): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      chunks.push(text.slice(i, i + CHUNK_SIZE));
    }
    return chunks.length ? chunks : [text];
  }
}
