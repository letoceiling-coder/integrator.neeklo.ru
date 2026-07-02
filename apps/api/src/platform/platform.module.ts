import { Global, Module } from '@nestjs/common';
import { EVENT_BUS, EVENT_STORE } from '@neeklo/kernel';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { EventStoreService } from './event-store/event-store.service';
import { EventBusService } from './event-bus/event-bus.service';

/**
 * Wires the framework-agnostic kernel ports to their infrastructure adapters and exports
 * them app-wide. Domain modules depend only on the `EVENT_STORE` / `EVENT_BUS` tokens.
 */
@Global()
@Module({
  imports: [PrismaModule, RedisModule],
  providers: [
    EventStoreService,
    EventBusService,
    { provide: EVENT_STORE, useExisting: EventStoreService },
    { provide: EVENT_BUS, useExisting: EventBusService },
  ],
  exports: [PrismaModule, RedisModule, EVENT_STORE, EVENT_BUS],
})
export class PlatformModule {}
