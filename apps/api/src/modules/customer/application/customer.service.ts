import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import type { InboxChannel } from '@neeklo/contracts';
import { NotFoundError, type AppendContext } from '@neeklo/kernel';
import { RequestContextService } from '../../../platform/context/request-context';
import { CustomerAggregate } from '../domain/customer.aggregate';
import { CustomerRepository } from '../domain/customer.repository';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import { KnowledgeGraphV2Service } from '../../../platform/intelligence/knowledge-graph/knowledge-graph-v2.service';

@Injectable()
export class CustomerService {
  constructor(
    private readonly repo: CustomerRepository,
    private readonly ctx: RequestContextService,
  ) {}

  private appendContext(): AppendContext {
    const rc = this.ctx.require();
    return { tenantId: rc.tenantId, actor: rc.actor, correlationId: rc.correlationId };
  }

  async create(input: {
    displayName: string;
    phone?: string | null;
    email?: string | null;
    channel: InboxChannel;
    externalId?: string | null;
    cityIds?: string[];
  }): Promise<{ id: string }> {
    const id = uuid();
    const customer = CustomerAggregate.create(id, {
      displayName: input.displayName,
      phone: input.phone ?? null,
      email: input.email ?? null,
      channel: input.channel,
      externalId: input.externalId ?? null,
      cityIds: input.cityIds,
    });
    await this.repo.save(customer, this.appendContext());
    return { id };
  }

  async recordInterest(customerId: string, interest: string, adId: string | null, score?: number): Promise<void> {
    const customer = await this.loadOrThrow(customerId);
    customer.recordInterest(null, adId, interest, score);
    await this.repo.save(customer, this.appendContext());
  }

  private async loadOrThrow(id: string): Promise<CustomerAggregate> {
    const c = await this.repo.load(id);
    if (!c) throw new NotFoundError('Customer', id);
    return c;
  }
}

@Injectable()
export class CustomerQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeGraph: KnowledgeGraphV2Service,
  ) {}

  async get360(customerId: string, tenantId: string) {
    const customer = await this.prisma.customerReadModel.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) return null;

    const [conversations, deals, graph] = await Promise.all([
      this.prisma.conversationReadModel.findMany({ where: { tenantId, customerId }, orderBy: { lastMessageAt: 'desc' }, take: 20 }),
      this.prisma.dealReadModel.findMany({ where: { tenantId, customerId }, orderBy: { updatedAt: 'desc' }, take: 20 }),
      this.knowledgeGraph.getContext(tenantId, 'customer', customerId, 2),
    ]);

    return {
      ...customer,
      conversations,
      deals,
      graph,
      recommendations: [],
    };
  }

  list(tenantId: string, q?: string) {
    return this.prisma.customerReadModel.findMany({
      where: {
        tenantId,
        ...(q ? { displayName: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { lastActivityAt: 'desc' },
      take: 100,
    });
  }
}
