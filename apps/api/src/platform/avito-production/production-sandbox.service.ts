import { Injectable } from '@nestjs/common';
import type { AvitoRuntimeMode } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductionSandboxService {
  constructor(private readonly prisma: PrismaService) {}

  async getMode(tenantId: string): Promise<AvitoRuntimeMode> {
    const row = await this.prisma.avitoProductionSettingsReadModel.findUnique({ where: { tenantId } });
    return (row?.runtimeMode ?? 'sandbox') as AvitoRuntimeMode;
  }

  async setMode(tenantId: string, mode: AvitoRuntimeMode) {
    return this.prisma.avitoProductionSettingsReadModel.upsert({
      where: { tenantId },
      create: { tenantId, runtimeMode: mode, wizardStep: 1 },
      update: { runtimeMode: mode },
    });
  }
}
