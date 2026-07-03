import { Injectable } from '@nestjs/common';
import type { AvitoInstallationWizardDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';

const WIZARD_STEPS = [
  'Создать организацию',
  'Подключить Avito',
  'OAuth',
  'Webhook',
  'Feed',
  'AI',
  'Automation',
  'Notifications',
  'Health Check',
  'READY',
] as const;

@Injectable()
export class ProductionWizardService {
  constructor(private readonly prisma: PrismaService) {}

  async getWizard(tenantId: string): Promise<AvitoInstallationWizardDto> {
    const settings = await this.prisma.avitoProductionSettingsReadModel.findUnique({ where: { tenantId } });
    const currentStep = settings?.wizardStep ?? 1;
    const org = await this.prisma.organizationReadModel.findUnique({ where: { tenantId } });
    const account = await this.prisma.avitoAccountDetailReadModel.findFirst({ where: { tenantId } });
    const webhook = account
      ? await this.prisma.avitoWebhookConfigReadModel.findFirst({ where: { tenantId, accountId: account.accountId } })
      : null;
    const feed = await this.prisma.avitoFeedExportReadModel.findFirst({ where: { tenantId } });
    const agent = account
      ? await this.prisma.avitoSalesAgentConfigReadModel.findFirst({ where: { tenantId, accountId: account.accountId } })
      : null;
    const rules = await this.prisma.avitoAutomationRuleReadModel.count({ where: { tenantId } });
    const policies = await this.prisma.avitoNotificationPolicyReadModel.count({ where: { tenantId } });

    const doneFlags = [
      Boolean(org),
      Boolean(account),
      account?.status === 'ready' || account?.status === 'live' || account?.status === 'connected',
      Boolean(webhook?.webhookUrl),
      Boolean(feed),
      Boolean(agent),
      rules > 0,
      policies > 0,
      account?.lastSyncStatus === 'completed',
      settings?.wizardDone ?? false,
    ];

    const steps = WIZARD_STEPS.map((label, i) => {
      const stepNum = i + 1;
      let status: 'pending' | 'done' | 'active' | 'skipped' = 'pending';
      if (doneFlags[i]) status = 'done';
      else if (stepNum === currentStep) status = 'active';
      return { id: stepNum, label, status };
    });

    const ready = Boolean(doneFlags[9]) || (doneFlags.filter(Boolean).length >= 8 && Boolean(doneFlags[1]) && Boolean(doneFlags[2]));

    return { currentStep, totalSteps: WIZARD_STEPS.length, steps, ready };
  }

  async advanceStep(tenantId: string, step: number) {
    const wizard = await this.getWizard(tenantId);
    const done = step >= WIZARD_STEPS.length;
    await this.prisma.avitoProductionSettingsReadModel.upsert({
      where: { tenantId },
      create: { tenantId, wizardStep: step, wizardDone: done },
      update: { wizardStep: step, wizardDone: done || wizard.ready },
    });
    return this.getWizard(tenantId);
  }
}
