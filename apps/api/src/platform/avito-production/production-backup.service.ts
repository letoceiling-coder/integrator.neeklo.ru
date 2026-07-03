import { Injectable } from '@nestjs/common';
import type { AvitoBackupExportDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductionBackupService {
  constructor(private readonly prisma: PrismaService) {}

  async exportAll(tenantId: string): Promise<AvitoBackupExportDto> {
    const [rules, policies, agents, watchers, feeds, templates] = await Promise.all([
      this.prisma.avitoAutomationRuleReadModel.findMany({ where: { tenantId } }),
      this.prisma.avitoNotificationPolicyReadModel.findMany({ where: { tenantId } }),
      this.prisma.avitoSalesAgentConfigReadModel.findMany({ where: { tenantId } }),
      this.prisma.avitoAiWatcherReadModel.findMany({ where: { tenantId } }),
      this.prisma.avitoFeedExportReadModel.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.adTemplateReadModel.findMany({ where: { tenantId } }),
    ]);

    const payload = {
      automationRules: rules,
      notificationPolicies: policies,
      aiAgentConfigs: agents,
      watchers: watchers,
      feedExports: feeds,
      crmTemplates: templates,
    };

    const sections = Object.keys(payload);
    await this.prisma.avitoBackupSnapshotReadModel.create({
      data: {
        tenantId,
        kind: 'full',
        sections,
        payload,
        createdAt: new Date(),
      },
    });

    return { exportedAt: new Date().toISOString(), sections, payload };
  }

  async importConfig(tenantId: string, payload: Record<string, unknown>) {
    const rules = payload.automationRules as { name: string; enabled: boolean; metric: string; operator: string; threshold: number; actionType: string; actionPayload?: object; requiresConfirmation?: boolean }[] | undefined;
    if (rules?.length) {
      for (const r of rules) {
        await this.prisma.avitoAutomationRuleReadModel.create({
          data: {
            tenantId,
            name: r.name,
            enabled: r.enabled,
            metric: r.metric,
            operator: r.operator,
            threshold: r.threshold,
            actionType: r.actionType,
            actionPayload: r.actionPayload ?? {},
            requiresConfirmation: r.requiresConfirmation ?? true,
            createdAt: new Date(),
          },
        });
      }
    }
    return { imported: true };
  }
}
