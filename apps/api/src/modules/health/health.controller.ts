import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { Public } from '../auth/decorators';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check(): Promise<{ status: string; db: boolean; uptime: number }> {
    let db = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    return { status: db ? 'ok' : 'degraded', db, uptime: process.uptime() };
  }
}
