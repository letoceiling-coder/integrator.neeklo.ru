import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  Permission,
  aiRunRequestSchema,
  createAgentSchema,
  createPromptSchema,
} from '@neeklo/contracts';
import type { CurrentUser as CurrentUserDto } from '@neeklo/contracts';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AiGatewayService } from '../../platform/ai-platform/gateway/ai-gateway.service';
import { AgentRuntimeService, AgentMarketplaceService } from '../../platform/ai-platform/agents/agent-runtime.service';
import { PromptRegistryService } from '../../platform/ai-platform/prompts/prompt-registry.service';
import { ToolRegistryV2Service } from '../../platform/ai-platform/tools/tool-runtime.service';
import { AiCostService, AiBenchmarkService, LearningEngine } from '../../platform/ai-platform/learning/learning-engines.service';
import { AiObservabilityService } from '../../platform/ai-platform/observability/ai-observability.service';
import { SkillFrameworkService } from '../../platform/ai-platform/agents/agent-runtime.service';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Controller('ai')
export class AiController {
  constructor(
    private readonly gateway: AiGatewayService,
    private readonly agents: AgentRuntimeService,
    private readonly marketplace: AgentMarketplaceService,
    private readonly prompts: PromptRegistryService,
    private readonly tools: ToolRegistryV2Service,
    private readonly cost: AiCostService,
    private readonly benchmark: AiBenchmarkService,
    private readonly learning: LearningEngine,
    private readonly observability: AiObservabilityService,
    private readonly skills: SkillFrameworkService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('run')
  @RequirePermissions(Permission.ChatWrite)
  run(@Body(new ZodValidationPipe(aiRunRequestSchema)) body: unknown) {
    return this.gateway.execute(body as Parameters<AiGatewayService['execute']>[0]);
  }

  @Get('agents')
  @RequirePermissions(Permission.ChatRead)
  listAgents(@CurrentUser() user: CurrentUserDto) {
    return this.marketplace.catalog(user.tenantId);
  }

  @Post('agents')
  @RequirePermissions(Permission.SettingsWrite)
  createAgent(
    @CurrentUser() user: CurrentUserDto,
    @Body(new ZodValidationPipe(createAgentSchema)) body: unknown,
  ) {
    return this.agents.create(user.tenantId, body as Parameters<AgentRuntimeService['create']>[1]);
  }

  @Get('prompts')
  @RequirePermissions(Permission.ChatRead)
  listPrompts(@CurrentUser() user: CurrentUserDto) {
    return this.prompts.list(user.tenantId);
  }

  @Post('prompts')
  @RequirePermissions(Permission.SettingsWrite)
  createPrompt(
    @CurrentUser() user: CurrentUserDto,
    @Body(new ZodValidationPipe(createPromptSchema)) body: { name: string; category?: string; template: string; tags?: string[] },
  ) {
    return this.prompts.create(user.tenantId, body.name, body.category ?? 'general', body.template, body.tags);
  }

  @Get('tools')
  @RequirePermissions(Permission.ChatRead)
  listTools(@Query('category') category?: string) {
    return this.tools.list(category);
  }

  @Get('skills')
  @RequirePermissions(Permission.ChatRead)
  listSkills() {
    return this.skills.list();
  }

  @Get('cost')
  @RequirePermissions(Permission.AnalyticsRead)
  costSummary(@CurrentUser() user: CurrentUserDto) {
    return this.cost.getSummary(user.tenantId);
  }

  @Post('benchmark')
  @RequirePermissions(Permission.AnalyticsRead)
  benchmark(
    @CurrentUser() user: CurrentUserDto,
    @Body() body: { taskType: string; prompt: string },
  ) {
    return this.benchmark.runBenchmark(user.tenantId, body.taskType, body.prompt);
  }

  @Get('learning')
  @RequirePermissions(Permission.AnalyticsRead)
  learning(@CurrentUser() user: CurrentUserDto) {
    return this.learning.list(user.tenantId);
  }

  @Get('observability')
  @RequirePermissions(Permission.AnalyticsRead)
  observability(@CurrentUser() user: CurrentUserDto) {
    return this.observability.getPipelineHealth(user.tenantId);
  }

  @Get('runs')
  @RequirePermissions(Permission.ChatRead)
  runs(@CurrentUser() user: CurrentUserDto, @Query('limit') limit = '20') {
    return this.prisma.aiRunReadModel.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { startedAt: 'desc' },
      take: Number(limit),
    });
  }

  @Get('dashboard')
  @RequirePermissions(Permission.AnalyticsRead)
  async dashboard(@CurrentUser() user: CurrentUserDto) {
    const [cost, health, agents, runs] = await Promise.all([
      this.cost.getSummary(user.tenantId),
      this.observability.getPipelineHealth(user.tenantId),
      this.marketplace.catalog(user.tenantId),
      this.prisma.aiRunReadModel.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { startedAt: 'desc' },
        take: 5,
      }),
    ]);
    return { cost, health, agents: agents.length, recentRuns: runs };
  }
}
