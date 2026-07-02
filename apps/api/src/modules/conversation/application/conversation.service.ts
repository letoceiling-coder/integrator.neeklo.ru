import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import type { InboxChannel, SendMessageDto } from '@neeklo/contracts';
import { NotFoundError, type AppendContext } from '@neeklo/kernel';
import { RequestContextService } from '../../../platform/context/request-context';
import { ConversationAggregate } from '../domain/conversation.aggregate';
import { ConversationRepository } from '../domain/conversation.repository';
import { PrismaService } from '../../../platform/prisma/prisma.service';

@Injectable()
export class ConversationService {
  constructor(
    private readonly repo: ConversationRepository,
    private readonly ctx: RequestContextService,
    private readonly prisma: PrismaService,
  ) {}

  private appendContext(): AppendContext {
    const rc = this.ctx.require();
    return { tenantId: rc.tenantId, actor: rc.actor, correlationId: rc.correlationId };
  }

  async start(input: {
    channel: InboxChannel;
    customerId: string;
    adId: string | null;
    subject?: string;
    externalThreadId?: string | null;
  }): Promise<{ id: string }> {
    const id = uuid();
    const conv = ConversationAggregate.start(id, {
      channel: input.channel,
      customerId: input.customerId,
      adId: input.adId,
      subject: input.subject ?? '',
      externalThreadId: input.externalThreadId ?? null,
    });
    await this.repo.save(conv, this.appendContext());
    return { id };
  }

  async sendMessage(conversationId: string, dto: SendMessageDto): Promise<void> {
    const conv = await this.loadOrThrow(conversationId);
    conv.sendMessage(dto.text);
    await this.repo.save(conv, this.appendContext());
  }

  async receiveInbound(
    conversationId: string,
    input: { marketplace: string; adId: string | null; customerId: string; text: string; attachments?: string[] },
  ): Promise<void> {
    const conv = await this.loadOrThrow(conversationId);
    conv.receiveMessage(input.marketplace, input.adId, input.customerId, input.text, input.attachments ?? []);
    await this.repo.save(conv, this.appendContext());
  }

  async pin(conversationId: string): Promise<void> {
    const conv = await this.loadOrThrow(conversationId);
    conv.pin();
    await this.repo.save(conv, this.appendContext());
  }

  async assign(conversationId: string, assigneeId: string, assigneeName: string | null): Promise<void> {
    const conv = await this.loadOrThrow(conversationId);
    conv.assign(assigneeId, assigneeName);
    await this.repo.save(conv, this.appendContext());
  }

  async markRead(conversationId: string, tenantId: string): Promise<void> {
    await this.prisma.conversationReadModel.updateMany({
      where: { id: conversationId, tenantId },
      data: { unreadCount: 0 },
    });
  }

  private async loadOrThrow(id: string): Promise<ConversationAggregate> {
    const conv = await this.repo.load(id);
    if (!conv) throw new NotFoundError('Conversation', id);
    return conv;
  }
}

@Injectable()
export class ConversationQueryService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, filters?: { status?: string; pinned?: boolean; q?: string }) {
    return this.prisma.conversationReadModel.findMany({
      where: {
        tenantId,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.pinned !== undefined ? { pinned: filters.pinned } : {}),
        ...(filters?.q
          ? {
              OR: [
                { customerName: { contains: filters.q, mode: 'insensitive' } },
                { lastMessagePreview: { contains: filters.q, mode: 'insensitive' } },
                { subject: { contains: filters.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ pinned: 'desc' }, { lastMessageAt: 'desc' }],
      take: 100,
    });
  }

  getMessages(conversationId: string, tenantId: string, limit = 100) {
    return this.prisma.messageReadModel.findMany({
      where: { conversationId, tenantId },
      orderBy: { sentAt: 'asc' },
      take: limit,
    });
  }

  get(conversationId: string, tenantId: string) {
    return this.prisma.conversationReadModel.findFirst({
      where: { id: conversationId, tenantId },
    });
  }
}
