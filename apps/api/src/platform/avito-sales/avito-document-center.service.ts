import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import type { AvitoDocumentCreateDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../avito/storage/object-storage.service';

@Injectable()
export class AvitoDocumentCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}

  async create(tenantId: string, dto: AvitoDocumentCreateDto) {
    const body = this.renderDocument(dto);
    const ext = dto.kind === 'presentation' ? 'pdf' : 'pdf';
    const stored = await this.storage.putObject(tenantId, 'documents', `${uuid()}.${ext}`, body, 'application/pdf');

    const row = await this.prisma.avitoSalesDocumentReadModel.create({
      data: {
        tenantId,
        kind: dto.kind,
        title: dto.title,
        dealId: dto.dealId ?? null,
        customerId: dto.customerId ?? null,
        storageKey: stored.key,
        publicUrl: stored.publicUrl,
        createdAt: new Date(),
      },
    });

    return { id: row.id, url: stored.publicUrl, kind: dto.kind, title: dto.title };
  }

  list(tenantId: string) {
    return this.prisma.avitoSalesDocumentReadModel.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  private renderDocument(dto: AvitoDocumentCreateDto): string {
    const label =
      dto.kind === 'proposal'
        ? 'Коммерческое предложение'
        : dto.kind === 'contract'
          ? 'Договор'
          : dto.kind === 'invoice'
            ? 'Счёт'
            : 'Презентация';
    return `%PDF-1.4\n% ${label}: ${dto.title}\n${dto.content.slice(0, 5000)}`;
  }
}
