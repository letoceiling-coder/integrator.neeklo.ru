import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { InboxChannel, MarketplaceCode } from '@neeklo/contracts';
import type { AppendContext } from '@neeklo/kernel';
import { PrismaService } from '../prisma/prisma.service';
import { RequestContextService } from '../context/request-context';
import { ConversationService } from '../../modules/conversation/application/conversation.service';
import { CustomerService } from '../../modules/customer/application/customer.service';
import { DealService } from '../../modules/deal/application/deal.service';
import { AvitoLeadCenterService } from './avito-lead-center.service';

/** Bridges Avito messenger webhooks/sync → Commerce CRM (leads, conversations). */
@Injectable()
export class AvitoCrmBridgeService {
  private readonly logger = new Logger(AvitoCrmBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContextService,
    private readonly conversations: ConversationService,
    private readonly customers: CustomerService,
    private readonly deals: DealService,
    private readonly leads: AvitoLeadCenterService,
  ) {}

  async ingestWebhookMessage(
    tenantId: string,
    accountId: string,
    body: unknown,
  ): Promise<{ leadId?: string; conversationId?: string }> {
    const payload = body as {
      payload?: {
        type?: string;
        value?: {
          chat_id?: string;
          author_id?: number;
          content?: { text?: string };
          item_id?: number;
          user_id?: number;
        };
      };
    };

    if (payload?.payload?.type !== 'message' || !payload.payload.value) {
      return {};
    }

    const v = payload.payload.value;
    const text = v.content?.text ?? '';
    const chatId = v.chat_id ?? uuid();
    const authorId = v.author_id != null ? String(v.author_id) : `avito-${chatId}`;
    const itemId = v.item_id != null ? String(v.item_id) : null;

    const appendCtx: AppendContext = {
      tenantId,
      actor: { type: 'system', id: 'avito-crm-bridge' },
      correlationId: uuid(),
    };

    return this.ctx.run({ ...appendCtx, tenantId, actor: appendCtx.actor, correlationId: appendCtx.correlationId }, () =>
      this.processInbound(tenantId, accountId, {
        externalThreadId: chatId,
        authorId,
        authorName: `Avito #${authorId}`,
        text,
        itemExternalId: itemId,
      }),
    );
  }

  async syncFromMessengerSnapshot(tenantId: string, accountId: string): Promise<number> {
    const snap = await this.prisma.avitoLiveSnapshotReadModel.findUnique({
      where: { tenantId_accountId_domain: { tenantId, accountId, domain: 'messenger' } },
    });
    const chats = (snap?.payload as { chats?: Record<string, unknown>[] })?.chats ?? [];
    let processed = 0;

    const appendCtx: AppendContext = {
      tenantId,
      actor: { type: 'system', id: 'avito-crm-sync' },
      correlationId: uuid(),
    };

    await this.ctx.run({ ...appendCtx, tenantId, actor: appendCtx.actor, correlationId: appendCtx.correlationId }, async () => {
      for (const chat of chats.slice(0, 50)) {
        const chatId = String(chat.id ?? chat.chat_id ?? '');
        const last = chat.last_message as { content?: { text?: string }; author_id?: number } | undefined;
        if (!chatId || !last?.content?.text) continue;
        await this.processInbound(tenantId, accountId, {
          externalThreadId: chatId,
          authorId: String(last.author_id ?? chatId),
          authorName: String(chat.title ?? `Chat ${chatId}`),
          text: last.content.text,
          itemExternalId: chat.item_id != null ? String(chat.item_id) : null,
        });
        processed++;
      }
    });

    return processed;
  }

  private async processInbound(
    tenantId: string,
    accountId: string,
    input: {
      externalThreadId: string;
      authorId: string;
      authorName: string;
      text: string;
      itemExternalId: string | null;
    },
  ) {
    let customer = await this.prisma.customerReadModel.findFirst({
      where: { tenantId, externalId: input.authorId },
    });

    if (!customer) {
      const { id } = await this.customers.create({
        displayName: input.authorName,
        channel: InboxChannel.AVITO,
        externalId: input.authorId,
      });
      customer = await this.prisma.customerReadModel.findFirst({ where: { id, tenantId } });
    }
    if (!customer) return {};

    let adId: string | null = null;
    let adTitle: string | null = null;
    if (input.itemExternalId) {
      const ad = await this.prisma.adReadModel.findFirst({
        where: { tenantId, marketplace: MarketplaceCode.AVITO, externalId: input.itemExternalId },
      });
      adId = ad?.id ?? null;
      adTitle = ad?.title ?? null;
    }

    let conversation = await this.prisma.conversationReadModel.findFirst({
      where: { tenantId, externalThreadId: input.externalThreadId },
    });

    if (!conversation) {
      const { id } = await this.conversations.start({
        channel: InboxChannel.AVITO,
        customerId: customer.id,
        adId,
        subject: adTitle ?? 'Avito chat',
        externalThreadId: input.externalThreadId,
      });
      conversation = await this.prisma.conversationReadModel.findFirst({ where: { id, tenantId } });
    }

    if (conversation) {
      await this.conversations.receiveInbound(conversation.id, {
        marketplace: MarketplaceCode.AVITO,
        adId,
        customerId: customer.id,
        text: input.text,
      });
    }

    const lead = await this.leads.ensureFromMessage(tenantId, {
      accountId,
      customerId: customer.id,
      customerName: customer.displayName,
      phone: customer.phone,
      adId,
      adTitle,
      conversationId: conversation?.id ?? null,
      source: 'avito_messenger',
      cityId: adId ? (await this.prisma.adReadModel.findUnique({ where: { id: adId } }))?.cityId ?? null : null,
      regionId: adId ? (await this.prisma.adReadModel.findUnique({ where: { id: adId } }))?.regionId ?? null : null,
    });

    if (!lead.dealId && adId) {
      const { id: dealId } = await this.deals.create({
        customerId: customer.id,
        adId,
        expectedAmount: { amount: 0, currency: 'RUB' },
      });
      await this.prisma.avitoLeadReadModel.update({
        where: { id: lead.id },
        data: { dealId },
      });
    }

    return { leadId: lead.id, conversationId: conversation?.id };
  }
}
