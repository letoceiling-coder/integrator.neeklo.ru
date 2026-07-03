import { Injectable } from '@nestjs/common';
import {
  AVITO_PIPELINE_TO_DEAL,
  AvitoPipelineStage,
  type AvitoPipelineColumnDto,
  type AvitoPipelineMoveDto,
} from '@neeklo/contracts';
import type { AppendContext } from '@neeklo/kernel';
import { DealService } from '../../modules/deal/application/deal.service';
import { AvitoLeadCenterService } from './avito-lead-center.service';

const STAGE_LABELS: Record<string, string> = {
  new: 'Новый',
  in_progress: 'В работе',
  waiting: 'Ожидает',
  negotiation: 'Переговоры',
  offer: 'Коммерческое предложение',
  reserved: 'Бронь',
  sale: 'Продажа',
  repeat: 'Повторная продажа',
  closed: 'Закрыт',
};

@Injectable()
export class AvitoPipelineService {
  constructor(
    private readonly leads: AvitoLeadCenterService,
    private readonly deals: DealService,
  ) {}

  async getKanban(tenantId: string): Promise<AvitoPipelineColumnDto[]> {
    const all = await this.leads.list(tenantId);
    const stages = Object.values(AvitoPipelineStage);
    return stages.map((stage) => {
      const items = all.filter((l) => l.pipelineStage === stage);
      return {
        stage,
        label: STAGE_LABELS[stage] ?? stage,
        leads: items,
        count: items.length,
      };
    });
  }

  async moveLead(tenantId: string, dto: AvitoPipelineMoveDto, ctx: AppendContext) {
    const lead = await this.leads.moveStage(tenantId, dto.leadId, dto.stage);
    if (lead.dealId) {
      const dealStage = AVITO_PIPELINE_TO_DEAL[dto.stage] ?? 'lead';
      await this.deals.changeStage(lead.dealId, { stage: dealStage as never, reason: 'pipeline_move' });
    }
    return lead;
  }
}
