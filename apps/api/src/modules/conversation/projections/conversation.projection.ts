import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  CommerceEventType,
  ConversationStatus,
  EventType,
  type InboxChannel,
} from '@neeklo/contracts';
import type { StoredEvent } from '@neeklo/kernel';
import type { Projection, ProjectionTx } from '../../../platform/projections/projection';

const HANDLED = new Set([
  CommerceEventType.ConversationStarted,
  CommerceEventType.ConversationPinned,
  CommerceEventType.ConversationUnpinned,
  CommerceEventType.ConversationTagged,
  CommerceEventType.ConversationStatusChanged,
  CommerceEventType.ConversationAssigned,
  CommerceEventType.ConversationAiSummaryGenerated,
  EventType.MessageReceived,
  EventType.MessageSent,
  EventType.AIReplySent,
  EventType.ConversationHandedOff,
]);

@Injectable()
export class ConversationProjection implements Projection {
  readonly name = 'conversation_read_model';
  readonly handles = HANDLED;

  async project(event: StoredEvent, tx: ProjectionTx): Promise<void> {
    const at = new Date(event.occurredAt);

    switch (event.type) {
      case CommerceEventType.ConversationStarted: {
        const p = event.payload as { channel: string; customerId: string; adId: string | null; subject: string; externalThreadId: string | null };
        const customer = await tx.customerReadModel.findUnique({ where: { id: p.customerId } });
        let adTitle: string | null = null;
        if (p.adId) {
          const ad = await tx.adReadModel.findUnique({ where: { id: p.adId } });
          adTitle = ad?.title ?? null;
        }
        await tx.conversationReadModel.upsert({
          where: { id: event.aggregateId },
          create: {
            id: event.aggregateId,
            tenantId: event.tenantId,
            channel: p.channel,
            customerId: p.customerId,
            customerName: customer?.displayName ?? 'Клиент',
            adId: p.adId,
            adTitle,
            status: ConversationStatus.OPEN,
            subject: p.subject,
            externalThreadId: p.externalThreadId,
            createdAt: at,
            updatedAt: at,
          },
          update: { updatedAt: at },
        });
        break;
      }
      case EventType.MessageReceived: {
        const p = event.payload as { text: string; attachments: string[]; customerId: string };
        const msgId = uuid();
        await tx.messageReadModel.create({
          data: {
            id: msgId,
            tenantId: event.tenantId,
            conversationId: event.aggregateId,
            direction: 'inbound',
            text: p.text,
            attachments: p.attachments,
            sentAt: at,
          },
        });
        await tx.conversationReadModel.update({
          where: { id: event.aggregateId },
          data: {
            unreadCount: { increment: 1 },
            lastMessageAt: at,
            lastMessagePreview: p.text.slice(0, 200),
            updatedAt: at,
          },
        });
        break;
      }
      case EventType.MessageSent: {
        const p = event.payload as { text: string };
        await tx.messageReadModel.create({
          data: {
            id: uuid(),
            tenantId: event.tenantId,
            conversationId: event.aggregateId,
            direction: 'outbound',
            text: p.text,
            sentAt: at,
          },
        });
        await tx.conversationReadModel.update({
          where: { id: event.aggregateId },
          data: {
            lastMessageAt: at,
            lastMessagePreview: p.text.slice(0, 200),
            updatedAt: at,
          },
        });
        break;
      }
      case EventType.AIReplySent: {
        const p = event.payload as { text: string };
        await tx.messageReadModel.create({
          data: {
            id: uuid(),
            tenantId: event.tenantId,
            conversationId: event.aggregateId,
            direction: 'ai',
            text: p.text,
            isAi: true,
            sentAt: at,
          },
        });
        await tx.conversationReadModel.update({
          where: { id: event.aggregateId },
          data: {
            lastMessageAt: at,
            lastMessagePreview: p.text.slice(0, 200),
            updatedAt: at,
          },
        });
        break;
      }
      case CommerceEventType.ConversationPinned:
        await tx.conversationReadModel.update({ where: { id: event.aggregateId }, data: { pinned: true, updatedAt: at } });
        break;
      case CommerceEventType.ConversationUnpinned:
        await tx.conversationReadModel.update({ where: { id: event.aggregateId }, data: { pinned: false, updatedAt: at } });
        break;
      case CommerceEventType.ConversationTagged: {
        const p = event.payload as { tag: string; action: string };
        const conv = await tx.conversationReadModel.findUnique({ where: { id: event.aggregateId } });
        if (!conv) break;
        const tags = p.action === 'remove' ? conv.tags.filter((t) => t !== p.tag) : [...new Set([...conv.tags, p.tag])];
        await tx.conversationReadModel.update({ where: { id: event.aggregateId }, data: { tags, updatedAt: at } });
        break;
      }
      case CommerceEventType.ConversationStatusChanged: {
        const p = event.payload as { to: string };
        await tx.conversationReadModel.update({ where: { id: event.aggregateId }, data: { status: p.to, updatedAt: at } });
        break;
      }
      case CommerceEventType.ConversationAssigned: {
        const p = event.payload as { assigneeId: string; assigneeName: string | null };
        await tx.conversationReadModel.update({
          where: { id: event.aggregateId },
          data: { assigneeId: p.assigneeId, assigneeName: p.assigneeName, updatedAt: at },
        });
        break;
      }
      case CommerceEventType.ConversationAiSummaryGenerated: {
        const p = event.payload as { summary: string };
        await tx.conversationReadModel.update({ where: { id: event.aggregateId }, data: { aiSummary: p.summary, updatedAt: at } });
        break;
      }
      case EventType.ConversationHandedOff: {
        const p = event.payload as { toUserId: string };
        await tx.conversationReadModel.update({
          where: { id: event.aggregateId },
          data: { assigneeId: p.toUserId, status: ConversationStatus.PENDING, updatedAt: at },
        });
        break;
      }
    }
  }
}
