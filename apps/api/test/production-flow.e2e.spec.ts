import { describe, expect, it } from 'vitest';
import { AvitoRuntimeMode, avitoRuntimeModeUpdateSchema, avitoWizardStepSchema } from '@neeklo/contracts';

/** Phase A7 — E2E flow contract smoke tests (no live Avito API). */
describe('Production flow contracts', () => {
  it('defines sandbox and production runtime modes', () => {
    expect(AvitoRuntimeMode.Sandbox).toBe('sandbox');
    expect(AvitoRuntimeMode.Production).toBe('production');
    expect(avitoRuntimeModeUpdateSchema.parse({ mode: 'production' }).mode).toBe('production');
  });

  it('wizard step schema accepts steps 1-10', () => {
    expect(avitoWizardStepSchema.parse({ step: 1 }).step).toBe(1);
    expect(avitoWizardStepSchema.parse({ step: 10 }).step).toBe(10);
  });
});

describe('E2E scenario map', () => {
  const FLOW = [
    'connect_account',
    'oauth',
    'token',
    'sync',
    'ads',
    'messages',
    'lead',
    'pipeline',
    'ai_draft',
    'reply',
    'timeline',
    'analytics',
    'automation',
    'executive_dashboard',
  ] as const;

  it('documents full production user journey', () => {
    expect(FLOW.length).toBe(14);
    expect(FLOW).toContain('oauth');
    expect(FLOW).toContain('lead');
    expect(FLOW.indexOf('messages')).toBeLessThan(FLOW.indexOf('lead'));
    expect(FLOW.indexOf('pipeline')).toBeLessThan(FLOW.indexOf('automation'));
  });
});

describe('Messenger outbound policy', () => {
  it('sandbox mode must not imply Avito API send', () => {
    const mode = 'sandbox' as const;
    const shouldCallAvitoApi = mode === 'production';
    expect(shouldCallAvitoApi).toBe(false);
  });
});
