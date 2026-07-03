import { Injectable, Logger } from '@nestjs/common';
import type { AvitoMessengerSendResultDto, AvitoRuntimeMode } from '@neeklo/contracts';
import { DomainError } from '@neeklo/kernel';
import { PrismaService } from '../prisma/prisma.service';
import { AvitoClient } from '../adapters/avito/avito.client';
import { ProductionSandboxService } from './production-sandbox.service';
import { ProductionPermissionsService } from './production-permissions.service';

/** Official Avito Messenger outbound — no local simulation. */
@Injectable()
export class AvitoMessengerOutboundService {
  private readonly logger = new Logger(AvitoMessengerOutboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly avito: AvitoClient,
    private readonly sandbox: ProductionSandboxService,
    private readonly permissions: ProductionPermissionsService,
  ) {}

  async sendOutbound(
    tenantId: string,
    conversationId: string,
    text: string,
  ): Promise<AvitoMessengerSendResultDto> {
    const mode = await this.sandbox.getMode(tenantId);
    const conv = await this.prisma.conversationReadModel.findFirst({
      where: { id: conversationId, tenantId },
    });
    if (!conv) {
      return { sent: false, mode, message: 'Conversation not found' };
    }

    const chatId = conv.externalThreadId;
    if (!chatId) {
      return {
        sent: false,
        mode,
        message: 'Нет externalThreadId — синхронизируйте Messenger или дождитесь webhook',
      };
    }

    const accountId = await this.resolveAccountId(tenantId, conv.customerId, conv.adId);
    if (!accountId) {
      return { sent: false, mode, message: 'Avito аккаунт не найден — подключите OAuth' };
    }

    const perms = await this.permissions.get(tenantId, accountId);
    const writeScope = perms.permissions.find((p) => p.scope === 'messenger:write');
    if (!writeScope?.granted) {
      return {
        sent: false,
        mode,
        message: 'Scope messenger:write не выдан — переподключите OAuth с нужными правами',
      };
    }

    if (mode === 'sandbox') {
      this.logger.log(`[sandbox] skip send chat=${chatId} text=${text.slice(0, 40)}`);
      return {
        sent: false,
        mode,
        message: 'Sandbox mode: сообщение сохранено локально, отправка в Avito отключена. Переключите на Production.',
      };
    }

    try {
      const self = await this.avito.request<{ id: number }>(
        tenantId,
        accountId,
        'GET',
        '/core/v1/accounts/self',
      );
      await this.avito.request(
        tenantId,
        accountId,
        'POST',
        `/messenger/v1/accounts/${self.id}/chats/${chatId}/messages`,
        { body: { message: { text }, type: 'text' } },
      );
      return { sent: true, mode, message: 'Сообщение отправлено через Avito Messenger API' };
    } catch (e) {
      const msg = e instanceof DomainError ? e.message : e instanceof Error ? e.message : String(e);
      const status = e instanceof DomainError ? (e.details as { status?: number })?.status : undefined;
      if (status === 403) {
        return { sent: false, mode, message: 'Avito API 403 — проверьте тариф и scope messenger:write' };
      }
      if (status === 429) {
        return { sent: false, mode, message: 'Avito API 429 — превышен лимит запросов, повторите позже' };
      }
      return { sent: false, mode, message: `Ошибка Avito Messenger: ${msg}` };
    }
  }

  private async resolveAccountId(
    tenantId: string,
    customerId: string,
    adId: string | null,
  ): Promise<string | null> {
    const lead = await this.prisma.avitoLeadReadModel.findFirst({
      where: { tenantId, customerId, ...(adId ? { adId } : {}) },
      orderBy: { lastActivityAt: 'desc' },
    });
    if (lead?.accountId) return lead.accountId;

    const detail = await this.prisma.avitoAccountDetailReadModel.findFirst({
      where: { tenantId, status: { in: ['ready', 'live', 'connected'] } },
    });
    return detail?.accountId ?? null;
  }
}
