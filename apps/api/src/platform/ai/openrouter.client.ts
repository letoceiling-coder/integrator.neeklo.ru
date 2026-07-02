import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainError } from '@neeklo/kernel';
import type { Env } from '../../config/env.schema';

/** Logical model roles → concrete OpenRouter model ids (configurable per deployment). */
export type ModelRole = 'chat' | 'analytics' | 'listing' | 'summary' | 'vision' | 'ocr';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface ChatCompletionResult {
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}

/**
 * OpenRouter client with role-based model routing. Different roles (chat, analytics, listing
 * generation, summarization) resolve to independently-configurable models so the platform can
 * mix providers without touching call sites.
 */
@Injectable()
export class OpenRouterClient {
  private readonly logger = new Logger(OpenRouterClient.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  modelFor(role: ModelRole): string {
    switch (role) {
      case 'analytics':
        return this.config.get('AI_MODEL_ANALYTICS', { infer: true });
      case 'listing':
        return this.config.get('AI_MODEL_LISTING', { infer: true });
      case 'summary':
        return this.config.get('AI_MODEL_SUMMARY', { infer: true });
      case 'vision':
        return this.config.get('AI_MODEL_VISION', { infer: true });
      case 'ocr':
        return this.config.get('AI_MODEL_OCR', { infer: true });
      case 'chat':
      default:
        return this.config.get('AI_MODEL_CHAT', { infer: true });
    }
  }

  async chat(
    role: ModelRole,
    messages: ChatMessage[],
    opts: { temperature?: number; maxTokens?: number } = {},
  ): Promise<ChatCompletionResult> {
    const apiKey = this.config.get('OPENROUTER_API_KEY', { infer: true });
    if (!apiKey) throw new DomainError('ai_not_configured', 'OPENROUTER_API_KEY is not set');
    const model = this.modelFor(role);
    const baseUrl = this.config.get('OPENROUTER_BASE_URL', { infer: true });

    const startedAt = Date.now();
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'NEEKLO Marketplace OS',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 1024,
      }),
    });

    if (!res.ok) {
      throw new DomainError('ai_request_failed', `OpenRouter error ${res.status}`, {
        status: res.status,
        body: await res.text().catch(() => ''),
      });
    }

    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      text: json.choices[0]?.message.content ?? '',
      model,
      tokensIn: json.usage?.prompt_tokens ?? 0,
      tokensOut: json.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - startedAt,
    };
  }
}
