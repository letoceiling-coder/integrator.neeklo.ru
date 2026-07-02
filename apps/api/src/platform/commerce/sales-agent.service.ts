import { Injectable, Logger, Optional } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AiTaskType } from '@neeklo/contracts';
import { AiGatewayService } from '../ai-platform/gateway/ai-gateway.service';
import { KnowledgeBaseService } from '../avito/knowledge/knowledge-base.service';
import { ConversationService } from '../../modules/conversation/application/conversation.service';
import { TaskEngine, NotificationEngine } from './commerce-services';
import { ObservabilityService } from '../marketplace-core/observability/observability.service';

export interface AgentReplyRequest {
  tenantId: string;
  conversationId: string;
  customerId: string;
  adId: string | null;
  message: string;
  autoSend?: boolean;
  minConfidence?: number;
}

export interface AgentReplyResult {
  draft: string;
  intent: string;
  confidence: number;
  actions: { type: string; reason: string }[];
  sent: boolean;
  stopped?: boolean;
  reason?: string;
}

/** AI Sales Agent — Gateway + Knowledge Base RAG + confidence gating. */
@Injectable()
export class SalesAgentService {
  private readonly logger = new Logger(SalesAgentService.name);

  constructor(
    private readonly gateway: AiGatewayService,
    private readonly conversations: ConversationService,
    private readonly tasks: TaskEngine,
    private readonly notifications: NotificationEngine,
    private readonly observability: ObservabilityService,
    @Optional() private readonly knowledge?: KnowledgeBaseService,
  ) {}

  async reply(req: AgentReplyRequest): Promise<AgentReplyResult> {
    return this.replyWithOptions(req);
  }

  async replyWithOptions(req: AgentReplyRequest): Promise<AgentReplyResult> {
    const started = Date.now();
    const runId = uuid();
    const minConfidence = req.minConfidence ?? 0.7;

    const kbContext = this.knowledge ? await this.knowledge.buildRagContext(req.tenantId, req.message) : '';
    const enrichedInput = kbContext ? `${req.message}\n\n--- Knowledge Base ---\n${kbContext}` : req.message;

    const result = await this.gateway.executeWithContext(
      {
        taskType: AiTaskType.CHAT,
        input: enrichedInput,
        skillIds: ['sales', 'negotiation', 'support'],
        context: {
          entityType: 'conversation',
          entityId: req.conversationId,
          customerId: req.customerId,
          adId: req.adId,
        },
        maxSteps: 5,
      },
      {
        tenantId: req.tenantId,
        actorId: null,
        correlationId: req.conversationId,
        runId,
      },
    );

    const draft = result.output;
    const intent = 'sales_reply';
    const confidence = this.estimateConfidence(result);
    const actions = result.toolCalls.map((t) => ({ type: t.name, reason: t.success ? 'executed' : 'failed' }));

    if (confidence < minConfidence) {
      await this.tasks.create(req.tenantId, {
        title: 'AI передал диалог менеджеру (низкая уверенность)',
        description: draft.slice(0, 300),
        entityType: 'conversation',
        entityId: req.conversationId,
        createdByAi: true,
        priority: 'high',
      });
      await this.notifications.notify(req.tenantId, {
        source: 'ai',
        category: 'inbox',
        title: 'Требуется менеджер',
        body: `Уверенность AI ${(confidence * 100).toFixed(0)}% — диалог ${req.conversationId}`,
        priority: 'high',
        entityType: 'conversation',
        entityId: req.conversationId,
      });

      await this.logReply(req, started, { intent, confidence, runId: result.runId, model: result.model, costUsd: result.costUsd, stopped: true });
      return { draft, intent, confidence, actions, sent: false, stopped: true, reason: 'low_confidence' };
    }

    let sent = false;
    if (req.autoSend) {
      await this.conversations.sendMessage(req.conversationId, { text: draft, attachments: [] });
      sent = true;
    } else if (confidence >= minConfidence) {
      await this.tasks.create(req.tenantId, {
        title: 'Проверить AI-ответ клиенту',
        entityType: 'conversation',
        entityId: req.conversationId,
        createdByAi: true,
        priority: 'normal',
      });
    }

    await this.logReply(req, started, { intent, confidence, runId: result.runId, model: result.model, costUsd: result.costUsd, autoSend: req.autoSend ?? false, sent });
    return { draft, intent, confidence, actions, sent };
  }

  private estimateConfidence(result: { output: string; toolCalls: { success: boolean }[]; latencyMs: number }) {
    const toolScore = result.toolCalls.length
      ? result.toolCalls.filter((t) => t.success).length / result.toolCalls.length
      : 0.9;
    const lengthScore = result.output.length > 30 && result.output.length < 4000 ? 0.9 : 0.6;
    const latencyScore = result.latencyMs < 20_000 ? 0.85 : 0.5;
    return Math.min(0.99, toolScore * 0.3 + lengthScore * 0.4 + latencyScore * 0.3);
  }

  private async logReply(
    req: AgentReplyRequest,
    started: number,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.observability.audit({
      tenantId: req.tenantId,
      actorType: 'ai',
      actorId: null,
      action: 'agent.reply',
      resourceType: 'conversation',
      resourceId: req.conversationId,
      correlationId: req.conversationId,
      details: { ...details, latencyMs: Date.now() - started },
    });
  }

  async generateSummary(
    tenantId: string,
    conversationId: string,
    customerId: string,
    messages: string[],
  ): Promise<string> {
    const runId = uuid();
    const result = await this.gateway.executeWithContext(
      {
        taskType: AiTaskType.SUMMARY,
        input: messages.join('\n---\n'),
        context: { entityType: 'conversation', entityId: conversationId, customerId },
        maxSteps: 2,
      },
      {
        tenantId,
        actorId: null,
        correlationId: conversationId,
        runId,
      },
    );
    return result.output;
  }
}
