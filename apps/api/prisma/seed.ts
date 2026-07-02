import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { AdStatus, EventType, MarketplaceCode, Role } from '@neeklo/contracts';

const prisma = new PrismaClient();

interface SeedEvent {
  aggregateId: string;
  type: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

async function main(): Promise<void> {
  // ── Tenant + owner ────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000001', name: 'NEEKLO Demo' },
  });

  const passwordHash = await argon2.hash('neeklo12345');
  await prisma.user.upsert({
    where: { email: 'owner@neeklo.dev' },
    update: { passwordHash, role: Role.OWNER },
    create: {
      tenantId: tenant.id,
      email: 'owner@neeklo.dev',
      name: 'Demo Owner',
      passwordHash,
      role: Role.OWNER,
    },
  });

  // ── Demo ads as real event streams (projections build read models on API boot) ──
  const now = Date.now();
  const catalog: { title: string; price: number; region: string; city: string; category: string }[] = [
    { title: 'iPhone 15 Pro 256GB', price: 89_990_00, region: 'ru-msk', city: 'msk', category: 'electronics' },
    { title: 'Диван угловой IKEA', price: 34_500_00, region: 'ru-spb', city: 'spb', category: 'furniture' },
    { title: 'Велосипед Merida', price: 42_000_00, region: 'ru-msk', city: 'msk', category: 'sport' },
    { title: 'MacBook Air M3', price: 119_000_00, region: 'ru-ekb', city: 'ekb', category: 'electronics' },
  ];

  const events: SeedEvent[] = [];
  catalog.forEach((c, idx) => {
    const adId = randomUUID();
    const created = new Date(now - (7 - idx) * 86_400_000);
    events.push({
      aggregateId: adId,
      type: EventType.AdCreated,
      occurredAt: created,
      payload: {
        marketplace: MarketplaceCode.AVITO,
        title: c.title,
        categoryId: c.category,
        subcategoryId: null,
        regionId: c.region,
        cityId: c.city,
        price: { amount: c.price, currency: 'RUB' },
        description: `${c.title} в отличном состоянии.`,
        photos: [],
        aiScore: 60 + idx * 8,
      },
    });
    events.push({
      aggregateId: adId,
      type: EventType.AdPublished,
      occurredAt: new Date(created.getTime() + 3_600_000),
      payload: {
        marketplace: MarketplaceCode.AVITO,
        externalId: `avito-${100000 + idx}`,
        url: `https://www.avito.ru/item/${100000 + idx}`,
        publishedAt: new Date(created.getTime() + 3_600_000).toISOString(),
      },
    });
    events.push({
      aggregateId: adId,
      type: EventType.AdStatusChanged,
      occurredAt: new Date(created.getTime() + 3_600_000),
      payload: { from: AdStatus.DRAFT, to: AdStatus.ACTIVE, reason: 'published' },
    });
    // Some views and contacts to populate metrics.
    for (let v = 0; v < 3; v++) {
      events.push({
        aggregateId: adId,
        type: EventType.ViewRecorded,
        occurredAt: new Date(created.getTime() + (v + 1) * 7_200_000),
        payload: { count: 20 + idx * 5 + v * 3, source: 'search', at: new Date(created.getTime() + (v + 1) * 7_200_000).toISOString() },
      });
    }
    events.push({
      aggregateId: adId,
      type: EventType.ContactRecorded,
      occurredAt: new Date(created.getTime() + 20_000_000),
      payload: { channel: 'message', at: new Date(created.getTime() + 20_000_000).toISOString() },
    });
    events.push({
      aggregateId: adId,
      type: EventType.BudgetSpent,
      occurredAt: new Date(created.getTime() + 21_000_000),
      payload: {
        marketplace: MarketplaceCode.AVITO,
        adId,
        category: 'promotion',
        amount: { amount: 500_00, currency: 'RUB' },
        spentAt: new Date(created.getTime() + 21_000_000).toISOString(),
      },
    });
  });

  // Group by aggregate to assign gap-free stream versions.
  const byAggregate = new Map<string, SeedEvent[]>();
  for (const e of events) {
    const list = byAggregate.get(e.aggregateId) ?? [];
    list.push(e);
    byAggregate.set(e.aggregateId, list);
  }

  let seeded = 0;
  for (const [aggregateId, list] of byAggregate) {
    const existing = await prisma.eventStore.count({ where: { aggregateType: 'ad', aggregateId } });
    if (existing > 0) continue;
    await prisma.eventStore.createMany({
      data: list.map((e, version) => ({
        eventId: randomUUID(),
        aggregateType: 'ad',
        aggregateId,
        streamVersion: version,
        type: e.type,
        tenantId: tenant.id,
        actorType: 'system',
        actorId: null,
        correlationId: randomUUID(),
        causationId: null,
        occurredAt: e.occurredAt,
        payload: e.payload,
        metadata: { seeded: true },
      })),
    });
    seeded += list.length;
  }

  console.log(`Seed complete: tenant=${tenant.id}, owner=owner@neeklo.dev / neeklo12345, events=${seeded}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
