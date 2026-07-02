import { Injectable } from '@nestjs/common';
import { DomainError } from '@neeklo/kernel';

export interface PolicyContext {
  tenantId: string;
  accountId?: string;
  marketplace?: string;
  ad?: {
    status: string;
    photoCount: number;
    authorized: boolean;
    moderationStatus?: string;
    regionAllowed: boolean;
    withinLimits: boolean;
  };
}

export interface PolicyViolation {
  code: string;
  message: string;
}

export interface PolicyResult {
  allowed: boolean;
  violations: PolicyViolation[];
}

/**
 * Domain Policies — centralized business rules for marketplace operations.
 * Called before publication, sync, and promotion actions.
 */
@Injectable()
export class MarketplacePolicyEngine {
  evaluatePublication(ctx: PolicyContext): PolicyResult {
    const violations: PolicyViolation[] = [];
    const ad = ctx.ad;

    if (!ad) {
      violations.push({ code: 'ad_missing', message: 'Объявление не найдено' });
      return { allowed: false, violations };
    }
    if (!ad.authorized) {
      violations.push({ code: 'not_authorized', message: 'Аккаунт маркетплейса не авторизован' });
    }
    if (!ad.withinLimits) {
      violations.push({ code: 'limit_exceeded', message: 'Исчерпан лимит публикаций' });
    }
    if (ad.photoCount === 0) {
      violations.push({ code: 'no_photos', message: 'Для публикации необходима хотя бы одна фотография' });
    }
    if (ad.moderationStatus === 'rejected') {
      violations.push({ code: 'moderation_rejected', message: 'Объявление не прошло модерацию' });
    }
    if (!ad.regionAllowed) {
      violations.push({ code: 'region_forbidden', message: 'Регион запрещён политикой организации' });
    }

    return { allowed: violations.length === 0, violations };
  }

  enforcePublication(ctx: PolicyContext): void {
    const result = this.evaluatePublication(ctx);
    if (!result.allowed) {
      throw new DomainError('policy_violation', result.violations[0]!.message, {
        violations: result.violations,
      });
    }
  }

  evaluateSync(ctx: PolicyContext): PolicyResult {
    const violations: PolicyViolation[] = [];
    if (!ctx.accountId) {
      violations.push({ code: 'account_missing', message: 'Аккаунт не указан' });
    }
    return { allowed: violations.length === 0, violations };
  }
}
