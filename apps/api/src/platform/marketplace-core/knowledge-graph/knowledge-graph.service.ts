import { Injectable, Logger } from '@nestjs/common';
import type { StoredEvent } from '@neeklo/kernel';
import { PrismaService } from '../../prisma/prisma.service';

/** Canonical node kinds in the knowledge graph. */
export const NodeKind = {
  ORGANIZATION: 'organization',
  USER: 'user',
  ACCOUNT: 'account',
  AD: 'ad',
  CUSTOMER: 'customer',
  CONVERSATION: 'conversation',
  MESSAGE: 'message',
  REGION: 'region',
  COMPETITOR: 'competitor',
  BUDGET: 'budget',
  MEDIA: 'media',
  CAMPAIGN: 'campaign',
  EVENT: 'event',
  RECOMMENDATION: 'recommendation',
  MARKETPLACE: 'marketplace',
} as const;

export const EdgeRelation = {
  OWNS: 'owns',
  MANAGES: 'manages',
  PUBLISHED_ON: 'published_on',
  CONNECTED_TO: 'connected_to',
  MESSAGED_IN: 'messaged_in',
  COMPETES_WITH: 'competes_with',
  SPENT_FROM: 'spent_from',
  LOCATED_IN: 'located_in',
  TRIGGERED: 'triggered',
  RECOMMENDS: 'recommends',
  CAUSED_BY: 'caused_by',
} as const;

/**
 * Knowledge Graph — links all platform entities so AI understands relationships.
 * Updated from the event stream; queryable for context assembly.
 */
@Injectable()
export class KnowledgeGraphService {
  private readonly logger = new Logger(KnowledgeGraphService.name);

  constructor(private readonly prisma: PrismaService) {}

  async upsertNode(
    tenantId: string,
    kind: string,
    entityId: string,
    label: string,
    properties: Record<string, unknown> = {},
  ): Promise<string> {
    const node = await this.prisma.knowledgeNode.upsert({
      where: { tenantId_kind_entityId: { tenantId, kind, entityId } },
      create: { tenantId, kind, entityId, label, properties, updatedAt: new Date() },
      update: { label, properties, updatedAt: new Date() },
    });
    return node.id;
  }

  async link(
    tenantId: string,
    fromNodeId: string,
    toNodeId: string,
    relation: string,
    weight = 1,
    properties: Record<string, unknown> = {},
  ): Promise<void> {
    await this.prisma.knowledgeEdge.upsert({
      where: {
        tenantId_fromNodeId_toNodeId_relation: { tenantId, fromNodeId, toNodeId, relation },
      },
      create: { tenantId, fromNodeId, toNodeId, relation, weight, properties },
      update: { weight, properties },
    });
  }

  /** Fold a domain event into graph nodes and edges. */
  async ingestEvent(event: StoredEvent): Promise<void> {
    const eventNodeId = await this.upsertNode(
      event.tenantId,
      NodeKind.EVENT,
      event.eventId,
      event.type,
      { aggregateType: event.aggregateType, aggregateId: event.aggregateId },
    );

    const aggregateNodeId = await this.upsertNode(
      event.tenantId,
      event.aggregateType,
      event.aggregateId,
      `${event.aggregateType}:${event.aggregateId.slice(0, 8)}`,
    );

    await this.link(event.tenantId, eventNodeId, aggregateNodeId, EdgeRelation.TRIGGERED);

    if (event.type === 'ad.created') {
      const payload = event.payload as { marketplace?: string; regionId?: string };
      if (payload.marketplace) {
        const mpNode = await this.upsertNode(event.tenantId, NodeKind.MARKETPLACE, payload.marketplace, payload.marketplace);
        await this.link(event.tenantId, aggregateNodeId, mpNode, EdgeRelation.PUBLISHED_ON);
      }
      if (payload.regionId) {
        const regionNode = await this.upsertNode(event.tenantId, NodeKind.REGION, payload.regionId, payload.regionId);
        await this.link(event.tenantId, aggregateNodeId, regionNode, EdgeRelation.LOCATED_IN);
      }
    }

    if (event.type === 'account.created') {
      const payload = event.payload as { organizationId?: string; marketplace?: string };
      if (payload.organizationId) {
        const orgNode = await this.upsertNode(event.tenantId, NodeKind.ORGANIZATION, payload.organizationId, 'organization');
        await this.link(event.tenantId, orgNode, aggregateNodeId, EdgeRelation.OWNS);
      }
    }
  }

  /** Get related entities for AI context assembly. */
  async getContext(tenantId: string, kind: string, entityId: string, depth = 2): Promise<{
    nodes: { kind: string; entityId: string; label: string; properties: Record<string, unknown> }[];
    edges: { relation: string; from: string; to: string }[];
  }> {
    const root = await this.prisma.knowledgeNode.findUnique({
      where: { tenantId_kind_entityId: { tenantId, kind, entityId } },
    });
    if (!root) return { nodes: [], edges: [] };

    const edges = await this.prisma.knowledgeEdge.findMany({
      where: {
        tenantId,
        OR: [{ fromNodeId: root.id }, { toNodeId: root.id }],
      },
      include: { fromNode: true, toNode: true },
      take: 100,
    });

    const nodeMap = new Map<string, { kind: string; entityId: string; label: string; properties: Record<string, unknown> }>();
    nodeMap.set(root.id, { kind: root.kind, entityId: root.entityId, label: root.label, properties: root.properties as Record<string, unknown> });

    for (const edge of edges) {
      nodeMap.set(edge.fromNode.id, {
        kind: edge.fromNode.kind,
        entityId: edge.fromNode.entityId,
        label: edge.fromNode.label,
        properties: edge.fromNode.properties as Record<string, unknown>,
      });
      nodeMap.set(edge.toNode.id, {
        kind: edge.toNode.kind,
        entityId: edge.toNode.entityId,
        label: edge.toNode.label,
        properties: edge.toNode.properties as Record<string, unknown>,
      });
    }

    return {
      nodes: [...nodeMap.values()],
      edges: edges.map((e) => ({
        relation: e.relation,
        from: e.fromNode.entityId,
        to: e.toNode.entityId,
      })),
    };
  }
}
