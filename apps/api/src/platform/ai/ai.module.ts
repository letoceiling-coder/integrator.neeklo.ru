import { Global, Module } from '@nestjs/common';
import { OpenRouterClient } from './openrouter.client';
import { AiToolRegistry } from './tool-registry';

@Global()
@Module({
  providers: [OpenRouterClient, AiToolRegistry],
  exports: [OpenRouterClient, AiToolRegistry],
})
export class AiModule {}
