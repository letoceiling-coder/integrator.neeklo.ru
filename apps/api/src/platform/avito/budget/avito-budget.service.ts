import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AvitoEventType } from '@neeklo/contracts';
import type { BudgetImportDto } from '@neeklo/contracts';
import type { AppendContext } from '@neeklo/kernel';
import { PrismaService } from '../../prisma/prisma.service';
import { BudgetCenterService } from '../../commerce/commerce-services';
import { AvitoEventPublisher } from '../events/avito-event.publisher';

/** Budget extensions — manual/CSV import when Avito billing API unavailable. */
@Injectable()
export class AvitoBudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budget: BudgetCenterService,
    private readonly publisher: AvitoEventPublisher,
  ) {}

  getSummary(tenantId: string) {
    return this.budget.getSummary(tenantId);
  }

  async importSpend(tenantId: string, dto: BudgetImportDto, ctx: AppendContext) {
    const id = uuid();
    await this.prisma.budgetImportReadModel.create({
      data: {
        id,
        tenantId,
        source: dto.source,
        amount: dto.amount,
        category: dto.category,
        adId: dto.adId ?? null,
        regionId: dto.regionId ?? null,
        note: dto.note ?? null,
        importedAt: new Date(),
      },
    });

    if (dto.adId) {
      await this.prisma.adReadModel.updateMany({
        where: { id: dto.adId, tenantId },
        data: { spendAmount: { increment: Math.round(dto.amount) } },
      });
    }

    await this.publisher.publish(tenantId, `budget:${id}`, AvitoEventType.BudgetImported, {
      source: dto.source,
      amount: dto.amount,
      category: dto.category,
      note: dto.note ?? null,
      importedAt: new Date().toISOString(),
    }, ctx);

    return { id, marked: 'manual_import' };
  }

  listImports(tenantId: string) {
    return this.prisma.budgetImportReadModel.findMany({
      where: { tenantId },
      orderBy: { importedAt: 'desc' },
      take: 50,
    });
  }
}
