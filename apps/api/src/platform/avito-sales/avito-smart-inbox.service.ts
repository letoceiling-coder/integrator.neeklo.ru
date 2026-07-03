import { Injectable } from '@nestjs/common';
import type { AvitoSmartInboxDto } from '@neeklo/contracts';
import { ConversationQueryService } from '../../modules/conversation/application/conversation.service';
import { AvitoCustomer360Service } from './avito-customer360.service';
import { AvitoLeadCenterService } from './avito-lead-center.service';

@Injectable()
export class AvitoSmartInboxService {
  constructor(
    private readonly conversations: ConversationQueryService,
    private readonly customer360: AvitoCustomer360Service,
    private readonly leads: AvitoLeadCenterService,
  ) {}

  async getInbox(tenantId: string, conversationId?: string): Promise<AvitoSmartInboxDto> {
    const conversations = await this.conversations.list(tenantId);
    const selected = conversationId
      ? conversations.find((c) => c.id === conversationId) ?? null
      : conversations[0] ?? null;

    const messages = selected ? await this.conversations.getMessages(selected.id, tenantId) : [];
    const customer360 = selected
      ? await this.customer360.get360(tenantId, selected.customerId)
      : null;

    const allLeads = await this.leads.list(tenantId);
    const lead = selected
      ? allLeads.find((l) => l.conversationId === selected.id || l.customerId === selected.customerId) ?? null
      : null;

    return {
      conversations,
      selectedConversation: selected,
      messages,
      customer360,
      lead,
    };
  }
}
