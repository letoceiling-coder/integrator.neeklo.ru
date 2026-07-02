import { Global, Module, forwardRef } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { AiEventPublisher } from './events/ai-event.publisher';
import { AiGatewayService } from './gateway/ai-gateway.service';
import { AiOrchestratorService } from './orchestrator/ai-orchestrator.service';
import { AiRouterService } from './router/ai-router.service';
import { PlannerEngine } from './planner/planner.engine';
import { ReasoningEngine } from './reasoning/reasoning.engine';
import { ToolRuntimeService, ToolRegistryV2Service } from './tools/tool-runtime.service';
import { PromptRegistryService } from './prompts/prompt-registry.service';
import { MemoryV2Service } from './memory/memory-v2.service';
import {
  AgentRuntimeService,
  AgentMarketplaceService,
  SkillFrameworkService,
} from './agents/agent-runtime.service';
import {
  EvaluationEngine,
  OptimizationEngine,
  LearningEngine,
  AiCostService,
  AiBenchmarkService,
} from './learning/learning-engines.service';
import { AiObservabilityService } from './observability/ai-observability.service';
import { WorkflowAiService } from './workflow/workflow-ai.service';
import { AiPlatformBootstrapService } from './bootstrap/ai-platform-bootstrap.service';

@Global()
@Module({
  imports: [forwardRef(() => CommerceModule)],
  providers: [
    AiEventPublisher,
    AiGatewayService,
    AiOrchestratorService,
    AiRouterService,
    PlannerEngine,
    ReasoningEngine,
    ToolRuntimeService,
    ToolRegistryV2Service,
    PromptRegistryService,
    MemoryV2Service,
    AgentRuntimeService,
    AgentMarketplaceService,
    SkillFrameworkService,
    EvaluationEngine,
    OptimizationEngine,
    LearningEngine,
    AiCostService,
    AiBenchmarkService,
    AiObservabilityService,
    WorkflowAiService,
    AiPlatformBootstrapService,
  ],
  exports: [
    AiGatewayService,
    AiOrchestratorService,
    AiRouterService,
    ToolRuntimeService,
    ToolRegistryV2Service,
    PromptRegistryService,
    MemoryV2Service,
    AgentRuntimeService,
    AgentMarketplaceService,
    SkillFrameworkService,
    LearningEngine,
    AiCostService,
    AiBenchmarkService,
    AiObservabilityService,
  ],
})
export class AiPlatformModule {}
