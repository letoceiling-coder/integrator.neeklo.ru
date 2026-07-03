import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  MarketplaceCode,
  OAuthCredentialStatus,
  type OAuthProvisionResultDto,
  type OAuthSyncWizardStepDto,
} from '@neeklo/contracts';
import type { AppendContext } from '@neeklo/kernel';
import { PrismaService } from '../prisma/prisma.service';
import { AvitoClient } from '../adapters/avito/avito.client';
import { AccountRepository } from '../../modules/account/domain/account.repository';
import { AvitoAccountCenterService } from '../avito/account/avito-account-center.service';
import { OAuthValidationService } from './oauth-validation.service';
import { CredentialVaultService } from './vault/credential-vault.service';
import { friendlyAvitoError } from './avito-api-errors';

/**
 * Post-OAuth provisioning: profile, ads, sync wizard → READY.
 */
@Injectable()
export class OAuthProvisioningService {
  private readonly logger = new Logger(OAuthProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly avito: AvitoClient,
    private readonly accountRepo: AccountRepository,
    private readonly accountCenter: AvitoAccountCenterService,
    private readonly validation: OAuthValidationService,
    private readonly vault: CredentialVaultService,
  ) {}

  async provisionAfterConnect(
    tenantId: string,
    accountId: string,
    ctx: AppendContext,
  ): Promise<OAuthProvisionResultDto> {
    const credential = await this.vault.findByAccount(tenantId, MarketplaceCode.AVITO, accountId);
    if (!credential || credential.status !== OAuthCredentialStatus.CONNECTED) {
      throw new Error('OAuth credential not connected');
    }

    const { syncJobId } = await this.accountCenter.recordSyncStart(tenantId, accountId, ctx);
    const wizardSteps: OAuthSyncWizardStepDto[] = [];

    try {
      const profile = await this.avito.request<{
        id: number;
        name?: string;
        email?: string;
        phone?: string;
        profile_type?: string;
        type?: string;
      }>(tenantId, accountId, 'GET', '/core/v1/accounts/self');

      const externalAccountId = String(profile.id);
      const displayName = profile.name ?? `Avito #${profile.id}`;
      const grantedScopes = credential.scopes;

      let itemsCount = 0;
      try {
        const items = await this.avito.request<{ resources?: { id: number }[]; items?: { id: number }[] }>(
          tenantId,
          accountId,
          'GET',
          '/core/v1/items',
          { query: { user_id: profile.id } },
        );
        itemsCount = (items.resources ?? items.items ?? []).length;
      } catch (e) {
        this.logger.warn(`Items fetch: ${friendlyAvitoError(e, 'Объявления')}`);
      }

      let tariffPayload: unknown = null;
      try {
        tariffPayload = await this.avito.request(tenantId, accountId, 'GET', '/tariff/info/1');
      } catch (e) {
        this.logger.warn(`Tariff fetch: ${friendlyAvitoError(e, 'Тариф')}`);
      }

      await this.prisma.accountReadModel.updateMany({
        where: { id: accountId, organizationId: tenantId },
        data: { displayName, externalAccountId, status: 'active' },
      });

      await this.prisma.avitoAccountDetailReadModel.upsert({
        where: { tenantId_accountId: { tenantId, accountId } },
        create: {
          id: uuid(),
          tenantId,
          accountId,
          externalAccountId,
          status: 'syncing',
          permissions: grantedScopes.length ? grantedScopes : ['messaging', 'statistics', 'items:info'],
          syncHistory: [],
          updatedAt: new Date(),
        },
        update: {
          externalAccountId,
          status: 'syncing',
          permissions: grantedScopes.length ? grantedScopes : undefined,
          updatedAt: new Date(),
        },
      });

      await this.runSyncWizard(tenantId, accountId, profile.id, wizardSteps);

      await this.persistWizardSteps(tenantId, accountId, wizardSteps, {
        profile: { ...profile, tariff: tariffPayload },
        scopes: grantedScopes,
      });

      await this.prisma.avitoAccountDetailReadModel.update({
        where: { tenantId_accountId: { tenantId, accountId } },
        data: { status: 'ready', lastSyncStatus: 'completed', lastSyncAt: new Date(), lastSyncError: null },
      });

      await this.accountCenter.recordSyncComplete(tenantId, accountId, syncJobId, itemsCount, ctx);

      const checklist = await this.validation.getProductionChecklist(tenantId, accountId);

      return {
        accountId,
        externalAccountId,
        displayName,
        itemsCount,
        accountStatus: 'ready',
        checklist,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.persistWizardSteps(tenantId, accountId, wizardSteps, {});
      await this.accountCenter.recordSyncFailed(tenantId, accountId, syncJobId, message, ctx);
      throw e;
    }
  }

  /** Sync wizard with progress persisted to syncHistory after each step. */
  private async runSyncWizard(
    tenantId: string,
    accountId: string,
    avitoUserId: number,
    steps: OAuthSyncWizardStepDto[],
  ): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const wizard: { name: string; run: () => Promise<void> }[] = [
      {
        name: 'profile',
        run: async () => {
          await this.avito.request(tenantId, accountId, 'GET', '/core/v1/accounts/self');
        },
      },
      {
        name: 'ads',
        run: async () => {
          await this.avito.request(tenantId, accountId, 'GET', '/core/v1/items', {
            query: { user_id: avitoUserId },
          });
        },
      },
      {
        name: 'categories',
        run: async () => {
          await this.avito.request(tenantId, accountId, 'GET', '/autoload/v1/user-docs/tree', {
            query: { if_modified_since: '1970-01-01' },
          });
        },
      },
      {
        name: 'stats',
        run: async () => {
          await this.avito.request(tenantId, accountId, 'POST', `/stats/v1/accounts/${avitoUserId}/items`, {
            body: {
              dateFrom: today,
              dateTo: today,
              fields: ['uniqViews', 'uniqContacts'],
              itemIds: [],
              periodGrouping: 'day',
            },
          });
        },
      },
      {
        name: 'messenger',
        run: async () => {
          await this.avito.request(tenantId, accountId, 'GET', `/messenger/v2/accounts/${avitoUserId}/chats`, {
            query: { limit: 20 },
          });
        },
      },
      {
        name: 'autoload',
        run: async () => {
          await this.avito.request(tenantId, accountId, 'GET', '/autoload/v2/profile');
        },
      },
      {
        name: 'promotion',
        run: async () => {
          await this.avito.request(tenantId, accountId, 'GET', `/core/v1/accounts/${avitoUserId}/items/vas/prices`, {
            query: { itemIds: '' },
          });
        },
      },
      {
        name: 'tariff',
        run: async () => {
          await this.avito.request(tenantId, accountId, 'GET', '/tariff/info/1');
        },
      },
    ];

    for (const step of wizard) {
      const started = Date.now();
      steps.push({ name: step.name, status: 'running', message: 'In progress…' });
      await this.persistWizardSteps(tenantId, accountId, steps, {});

      try {
        await step.run();
        const latencyMs = Date.now() - started;
        const idx = steps.findIndex((s) => s.name === step.name && s.status === 'running');
        if (idx >= 0) {
          steps[idx] = {
            name: step.name,
            status: 'completed',
            message: 'OK',
            latencyMs,
            completedAt: new Date().toISOString(),
          };
        }
        this.logger.log(`Sync wizard [${accountId}] ${step.name} ✓ (${latencyMs}ms)`);
      } catch (e) {
        const msg = friendlyAvitoError(e, step.name);
        const isLimited = msg.includes('тариф') || msg.includes('403');
        const idx = steps.findIndex((s) => s.name === step.name && s.status === 'running');
        if (idx >= 0) {
          steps[idx] = {
            name: step.name,
            status: isLimited ? 'unavailable' : 'failed',
            message: msg,
            latencyMs: Date.now() - started,
            completedAt: new Date().toISOString(),
          };
        }
        this.logger.warn(`Sync wizard [${accountId}] ${step.name}: ${msg}`);
      }

      await this.persistWizardSteps(tenantId, accountId, steps, {});
    }
  }

  private async persistWizardSteps(
    tenantId: string,
    accountId: string,
    steps: OAuthSyncWizardStepDto[],
    meta: Record<string, unknown>,
  ): Promise<void> {
    const existing = await this.prisma.avitoAccountDetailReadModel.findFirst({
      where: { tenantId, accountId },
    });
    const prevMeta =
      existing?.syncHistory && Array.isArray(existing.syncHistory)
        ? ((existing.syncHistory as { meta?: Record<string, unknown> }[]).find((x) => x && 'meta' in x) as
            | { meta?: Record<string, unknown> }
            | undefined)?.meta ?? {}
        : {};

    await this.prisma.avitoAccountDetailReadModel.updateMany({
      where: { tenantId, accountId },
      data: {
        syncHistory: [{ steps, meta: { ...prevMeta, ...meta }, updatedAt: new Date().toISOString() }] as object,
        updatedAt: new Date(),
      },
    });
  }
}

