import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { DealStage, type ChangeDealStageDto, type CreateDealDto } from '@neeklo/contracts';
import { NotFoundError, type AppendContext } from '@neeklo/kernel';
import { RequestContextService } from '../../../platform/context/request-context';
import { DealAggregate } from '../domain/deal.aggregate';
import { DealRepository } from '../domain/deal.repository';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import { DecisionEngine } from '../../../platform/intelligence/decision/decision.engine';

@Injectable()
export class DealService {
  constructor(
    private readonly repo: DealRepository,
    private readonly ctx: RequestContextService,
    private readonly decision: DecisionEngine,
  ) {}

  private appendContext(): AppendContext {
    const rc = this.ctx.require();
    return { tenantId: rc.tenantId, actor: rc.actor, correlationId: rc.correlationId };
  }

  async create(dto: CreateDealDto): Promise<{ id: string }> {
    const id = uuid();
    const deal = DealAggregate.create(id, dto);
    await this.repo.save(deal, this.appendContext());
    return { id };
  }

  async changeStage(dealId: string, dto: ChangeDealStageDto): Promise<void> {
    const deal = await this.loadOrThrow(dealId);
    deal.changeStage(dto.stage, dto.reason);
    await this.repo.save(deal, this.appendContext());
  }

  async applyAiSuggestion(dealId: string): Promise<void> {
    const deal = await this.loadOrThrow(dealId);
    const snap = deal.snapshot;
    if (!snap.aiSuggestedStage) return;
    deal.changeStage(snap.aiSuggestedStage, 'ai_suggestion', true);
    await this.repo.save(deal, this.appendContext());
  }

  async suggestStageFromIntelligence(dealId: string, tenantId: string, adId: string | null): Promise<void> {
    if (!adId) return;
    const decisions = await this.decision.decide(tenantId, 'ad', adId);
    const deal = await this.loadOrThrow(dealId);
    const top = decisions[0];
    if (!top) return;

    const stageMap: Record<string, DealStage> = {
      boost: DealStage.INTERESTED,
      change_price: DealStage.NEGOTIATION,
      increase_budget: DealStage.OFFER,
    };
    const suggested = stageMap[top.action] ?? DealStage.INTERESTED;
    deal.suggestStage(suggested, top.confidence, top.reason);
    await this.repo.save(deal, this.appendContext());
  }

  private async loadOrThrow(id: string): Promise<DealAggregate> {
    const d = await this.repo.load(id);
    if (!d) throw new NotFoundError('Deal', id);
    return d;
  }
}

@Injectable()
export class DealQueryService {
  constructor(private readonly prisma: PrismaService) {}

  pipeline(tenantId: string) {
    return this.prisma.dealReadModel.findMany({
      where: {
        tenantId,
        stage: { notIn: [DealStage.COMPLETED, DealStage.CANCELLED] },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  byStage(tenantId: string) {
    return this.pipeline(tenantId).then((deals) => {
      const stages = Object.values(DealStage);
      return stages.map((stage) => ({
        stage,
        deals: deals.filter((d) => d.stage === stage),
        count: deals.filter((d) => d.stage === stage).length,
      }));
    });
  }

  get(dealId: string, tenantId: string) {
    return this.prisma.dealReadModel.findFirst({ where: { id: dealId, tenantId } });
  }
}
