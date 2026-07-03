import { z } from 'zod';

/** Validated at boot — the app refuses to start with a malformed environment. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(3001),
  API_URL: z.string().url().default('http://localhost:3001'),
  WEB_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_ACCESS_TTL: z.coerce.number().int().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().default(2_592_000),

  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  AI_MODEL_CHAT: z.string().default('openai/gpt-4o-mini'),
  AI_MODEL_ANALYTICS: z.string().default('anthropic/claude-3.7-sonnet'),
  AI_MODEL_LISTING: z.string().default('openai/gpt-4o'),
  AI_MODEL_SUMMARY: z.string().default('google/gemini-2.0-flash'),
  AI_MODEL_VISION: z.string().default('qwen/qwen-2.5-vl-72b-instruct'),
  AI_MODEL_OCR: z.string().default('mistralai/mistral-small-3.1-24b-instruct'),
  AI_IMAGE_PROVIDER: z.string().default('stub'),

  S3_ENDPOINT: z.string().default(''),
  S3_REGION: z.string().default('ru-1'),
  S3_BUCKET: z.string().default('neeklo-media'),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),

  AVITO_CLIENT_ID: z.string().default(''),
  AVITO_CLIENT_SECRET: z.string().default(''),
  AVITO_BASE_URL: z.string().url().default('https://api.avito.ru'),
  AVITO_OAUTH_SCOPES: z
    .string()
    .default('messenger:read,messenger:write,stats:read,items:info,user:read,autoload:reports'),
  /** Canonical OAuth callback path — must match Avito Developer Portal. */
  OAUTH_REDIRECT_PATH: z.string().default('/api/auth/os/callback'),

  /** 32-byte master key as 64-char hex — required in production for Credential Vault. */
  OAUTH_VAULT_MASTER_KEY: z.string().min(32),
  OAUTH_VAULT_KEY_VERSION: z.coerce.number().int().positive().default(1),
  OAUTH_TOKEN_REFRESH_LEAD_SEC: z.coerce.number().int().positive().default(300),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
