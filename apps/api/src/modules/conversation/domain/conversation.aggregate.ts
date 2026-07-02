import {
  CommerceEventType,
  ConversationStatus,
  EventType,
  type EventPayloadMap,
  type InboxChannel,
} from '@neeklo/contracts';
import { AggregateRoot, DomainError, type RecordedEvent } from '@neeklo/kernel';

interface ConversationState {
  channel: InboxChannel;
  customerId: string;
  adId: string | null;
  status: ConversationStatus;
  subject: string;
  pinned: boolean;
  tags: string[];
  assigneeId: string | null;
  externalThreadId: string | null;
  aiSummary: string | null;
}

/** Unified Inbox aggregate — platform-agnostic conversation thread. */
export class ConversationAggregate extends AggregateRoot {
  private state!: ConversationState;

  get aggregateType(): string {
    return 'conversation';
  }

  get snapshot(): Readonly<ConversationState> {
    return this.state;
  }

  static start(
    id: string,
    input: {
      channel: InboxChannel;
      customerId: string;
      adId: string | null;
      subject: string;
      externalThreadId: string | null;
    },
  ): ConversationAggregate {
    const c = new ConversationAggregate(id);
    c.raise(CommerceEventType.ConversationStarted, input);
    return c;
  }

  receiveMessage(
    marketplace: string,
    adId: string | null,
    customerId: string,
    text: string,
    attachments: string[] = [],
  ): void {
    this.raise(EventType.MessageReceived, {
      conversationId: this.id,
      marketplace: marketplace as EventPayloadMap['conversation.message_received']['marketplace'],
      adId,
      customerId,
      text,
      attachments,
      receivedAt: new Date().toISOString(),
    });
  }

  sendMessage(text: string): void {
    this.raise(EventType.MessageSent, {
      conversationId: this.id,
      text,
      sentAt: new Date().toISOString(),
    });
  }

  sendAiReply(model: string, text: string, intent: string | null, tokensIn: number, tokensOut: number, latencyMs: number): void {
    this.raise(EventType.AIReplySent, {
      conversationId: this.id,
      model,
      text,
      intent,
      tokensIn,
      tokensOut,
      latencyMs,
      sentAt: new Date().toISOString(),
    });
  }

  handOff(toUserId: string, reason: string | null): void {
    this.raise(EventType.ConversationHandedOff, { conversationId: this.id, toUserId, reason });
  }

  pin(): void {
    if (this.state.pinned) return;
    this.raise(CommerceEventType.ConversationPinned, { pinned: true });
  }

  unpin(): void {
    if (!this.state.pinned) return;
    this.raise(CommerceEventType.ConversationUnpinned, {});
  }

  tag(tag: string, action: 'add' | 'remove' = 'add'): void {
    this.raise(CommerceEventType.ConversationTagged, { tag, action });
  }

  changeStatus(to: ConversationStatus, reason: string | null = null): void {
    if (this.state.status === to) return;
    this.raise(CommerceEventType.ConversationStatusChanged, {
      from: this.state.status,
      to,
      reason,
    });
  }

  assign(assigneeId: string, assigneeName: string | null): void {
    this.raise(CommerceEventType.ConversationAssigned, { assigneeId, assigneeName });
  }

  setAiSummary(summary: string, model = 'default'): void {
    this.raise(CommerceEventType.ConversationAiSummaryGenerated, {
      summary,
      model,
      generatedAt: new Date().toISOString(),
    });
  }

  protected apply(event: RecordedEvent): void {
    switch (event.type) {
      case CommerceEventType.ConversationStarted: {
        const p = event.payload as EventPayloadMap['conversation.started'];
        this.state = {
          channel: p.channel,
          customerId: p.customerId,
          adId: p.adId,
          status: ConversationStatus.OPEN,
          subject: p.subject,
          pinned: false,
          tags: [],
          assigneeId: null,
          externalThreadId: p.externalThreadId,
          aiSummary: null,
        };
        break;
      }
      case CommerceEventType.ConversationPinned:
        this.state.pinned = true;
        break;
      case CommerceEventType.ConversationUnpinned:
        this.state.pinned = false;
        break;
      case CommerceEventType.ConversationTagged: {
        const p = event.payload as EventPayloadMap['conversation.tagged'];
        if (p.action === 'remove') {
          this.state.tags = this.state.tags.filter((t) => t !== p.tag);
        } else if (!this.state.tags.includes(p.tag)) {
          this.state.tags = [...this.state.tags, p.tag];
        }
        break;
      }
      case CommerceEventType.ConversationStatusChanged: {
        const p = event.payload as EventPayloadMap['conversation.status_changed'];
        this.state.status = p.to as ConversationStatus;
        break;
      }
      case CommerceEventType.ConversationAssigned: {
        const p = event.payload as EventPayloadMap['conversation.assigned'];
        this.state.assigneeId = p.assigneeId;
        break;
      }
      case CommerceEventType.ConversationAiSummaryGenerated: {
        const p = event.payload as EventPayloadMap['conversation.ai_summary_generated'];
        this.state.aiSummary = p.summary;
        break;
      }
      case EventType.MessageReceived:
      case EventType.MessageSent:
      case EventType.AIReplySent:
      case EventType.ConversationHandedOff:
        break;
      default:
        if (!this.state) throw new DomainError('invalid_state', 'Conversation not started');
    }
  }
}
