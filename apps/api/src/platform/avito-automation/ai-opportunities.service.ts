import { Injectable } from '@nestjs/common';
import type { AvitoOpportunityItemDto } from '@neeklo/contracts';
import { OpportunityEngine } from '../intelligence/opportunity/opportunity.engine';

@Injectable()
export class AiOpportunitiesService {
  constructor(private readonly opportunity: OpportunityEngine) {}

  async scanDaily(tenantId: string) {
    return this.opportunity.scan(tenantId);
  }

  async list(tenantId: string): Promise<AvitoOpportunityItemDto[]> {
    const rows = await this.opportunity.listOpen(tenantId);
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      entityType: r.entityType,
      entityId: r.entityId,
      score: r.score,
      reason: r.reason,
      detectedAt: r.detectedAt.toISOString(),
    }));
  }
}
