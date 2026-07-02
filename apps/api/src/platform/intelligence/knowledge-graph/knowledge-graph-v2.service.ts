import { Injectable } from '@nestjs/common';
import type { StoredEvent } from '@neeklo/kernel';
import { EventType, IntelligenceEventType } from '@neeklo/contracts';
import { KnowledgeGraphService, EdgeRelation, NodeKind } from '../../marketplace-core/knowledge-graph/knowledge-graph.service';
import { PrismaService } from '../../prisma/prisma.service';

/** Extended node kinds for v2. */
export const NodeKindV2 = {
  ...NodeKind,
  EMPLOYEE: 'employee',
  CITY: 'city',
  CAMPAIGN: 'campaign',
  DECISION: 'decision',
  FORECAST: 'forecast',
  EXPERIMENT: 'experiment',
  METRIC: 'metric',
} as const;

export const EdgeRelationV2 = {
  ...EdgeRelation,
  WORKS_FOR: 'works_for',
  LOCATED_IN_CITY: 'located_in_city',
  PART_OF_CAMPAIGN: 'part_of_campaign',
  DECIDED: 'decided',
  FORECASTS: 'forecasts',
  TESTS: 'tests',
  MEASURES: 'measures',
  RECOMMENDS_ACTION: 'recommends_action',
} as const;

/**
 * Knowledge Graph v2 — extends Stage 2 graph with BFS traversal and richer event ingestion.
 */
@Injectable()
export class KnowledgeGraphV2Service {
  constructor(
    private readonly v1: KnowledgeGraphService,
    private readonly prisma: PrismaService,
  ) {}

  ingestEvent(event: StoredEvent): Promise<void> {
    return this.v1.ingestEvent(event);
  }

  /** Ingest intelligence layer events into the graph. */
  async ingestIntelligenceEvent(event: StoredEvent): Promise<void> {
    await this.v1.ingestEvent(event);

    const payload = event.payload as Record<string, unknown>;

    switch (event.type) {
      case IntelligenceEventType.DecisionMade: {
        const entityType = payload.entityType as string;
        const entityId = payload.entityId as string;
        const decisionNode = await this.v1.upsertNode(
          event.tenantId,
          NodeKindV2.DECISION,
          event.eventId,
          `decision:${payload.action}`,
          { action: payload.action, confidence: payload.confidence },
        );
        const entityNode = await this.v1.upsertNode(event.tenantId, entityType, entityId, `${entityType}:${entityId.slice(0, 8)}`);
        await this.v1.link(event.tenantId, decisionNode, entityNode, EdgeRelationV2.DECIDED);
        break;
      }
      case IntelligenceEventType.ForecastGenerated: {
        const forecastNode = await this.v1.upsertNode(
          event.tenantId,
          NodeKindV2.FORECAST,
          event.eventId,
          'forecast',
          { algorithm: payload.algorithm },
        );
        const entityNode = await this.v1.upsertNode(
          event.tenantId,
          payload.entityType as string,
          payload.entityId as string,
          `${payload.entityType}:${(payload.entityId as string).slice(0, 8)}`,
        );
        await this.v1.link(event.tenantId, forecastNode, entityNode, EdgeRelationV2.FORECASTS);
        break;
      }
      case IntelligenceEventType.OpportunityDetected: {
        const oppNode = await this.v1.upsertNode(
          event.tenantId,
          'opportunity',
          event.eventId,
          `opportunity:${payload.kind}`,
        );
        const entityNode = await this.v1.upsertNode(
          event.tenantId,
          payload.entityType as string,
          payload.entityId as string,
          `${payload.entityType}:${(payload.entityId as string).slice(0, 8)}`,
        );
        await this.v1.link(event.tenantId, oppNode, entityNode, EdgeRelation.RECOMMENDS);
        break;
      }
      case EventType.MessageReceived: {
        const p = payload as { adId?: string; conversationId?: string; customerId?: string };
        if (p.adId) {
          const adNode = await this.v1.upsertNode(event.tenantId, NodeKind.AD, p.adId, `ad:${p.adId.slice(0, 8)}`);
          if (p.customerId) {
            const custNode = await this.v1.upsertNode(event.tenantId, NodeKind.CUSTOMER, p.customerId, `customer:${p.customerId.slice(0, 8)}`);
            await this.v1.link(event.tenantId, custNode, adNode, EdgeRelation.MESSAGED_IN);
          }
        }
        break;
      }
      case EventType.AdCreated: {
        const p = payload as { cityId?: string; marketplace?: string };
        if (p.cityId) {
          const adNode = await this.v1.upsertNode(event.tenantId, NodeKind.AD, event.aggregateId, event.aggregateId.slice(0, 8));
          const cityNode = await this.v1.upsertNode(event.tenantId, NodeKindV2.CITY, p.cityId, p.cityId);
          await this.v1.link(event.tenantId, adNode, cityNode, EdgeRelationV2.LOCATED_IN_CITY);
        }
        break;
      }
    }
  }

  /** BFS graph traversal up to `depth` hops. */
  async getContext(tenantId: string, kind: string, entityId: string, depth = 2) {
    const root = await this.prisma.knowledgeNode.findUnique({
      where: { tenantId_kind_entityId: { tenantId, kind, entityId } },
    });
    if (!root) return { nodes: [], edges: [] };

    const visited = new Set<string>([root.id]);
    const nodes = new Map<string, { kind: string; entityId: string; label: string; properties: Record<string, unknown> }>();
    const edges: { relation: string; from: string; to: string }[] = [];

    nodes.set(root.id, {
      kind: root.kind,
      entityId: root.entityId,
      label: root.label,
      properties: root.properties as Record<string, unknown>,
    });

    let frontier = [root.id];
    for (let d = 0; d < depth; d++) {
      const nextFrontier: string[] = [];
      for (const nodeId of frontier) {
        const connected = await this.prisma.knowledgeEdge.findMany({
          where: { tenantId, OR: [{ fromNodeId: nodeId }, { toNodeId: nodeId }] },
          include: { fromNode: true, toNode: true },
          take: 50,
        });
        for (const edge of connected) {
          edges.push({ relation: edge.relation, from: edge.fromNode.entityId, to: edge.toNode.entityId });
          for (const n of [edge.fromNode, edge.toNode]) {
            if (!visited.has(n.id)) {
              visited.add(n.id);
              nextFrontier.push(n.id);
              nodes.set(n.id, {
                kind: n.kind,
                entityId: n.entityId,
                label: n.label,
                properties: n.properties as Record<string, unknown>,
              });
            }
          }
        }
      }
      frontier = nextFrontier;
    }

    return { nodes: [...nodes.values()], edges };
  }

  async findPath(tenantId: string, fromKind: string, fromId: string, toKind: string, toId: string, maxDepth = 4) {
    const ctx = await this.getContext(tenantId, fromKind, fromId, maxDepth);
    const target = ctx.nodes.find((n) => n.kind === toKind && n.entityId === toId);
    return target ? { found: true, path: ctx.edges } : { found: false, path: [] };
  }
}
