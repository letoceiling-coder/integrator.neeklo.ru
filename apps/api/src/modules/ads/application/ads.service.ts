import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import type { ChangePriceDto, CreateAdDto } from '@neeklo/contracts';
import { NotFoundError, type AppendContext } from '@neeklo/kernel';
import { RequestContextService } from '../../../platform/context/request-context';
import { AdAggregate } from '../domain/ad.aggregate';
import { AdRepository } from '../domain/ad.repository';

/**
 * Write-side application service (the "C" in CQRS). Loads/mutates the {@link AdAggregate} and
 * persists resulting events; every event is stamped with the ambient request context so it is
 * fully attributable and replayable.
 */
@Injectable()
export class AdsService {
  constructor(
    private readonly repo: AdRepository,
    private readonly ctx: RequestContextService,
  ) {}

  private appendContext(): AppendContext {
    const rc = this.ctx.require();
    return { tenantId: rc.tenantId, actor: rc.actor, correlationId: rc.correlationId };
  }

  async create(dto: CreateAdDto): Promise<{ id: string }> {
    const id = uuid();
    const ad = AdAggregate.create(id, {
      marketplace: dto.marketplace,
      title: dto.title,
      categoryId: dto.categoryId,
      subcategoryId: dto.subcategoryId,
      regionId: dto.regionId,
      cityId: dto.cityId,
      price: dto.price,
      description: dto.description,
    });
    await this.repo.save(ad, this.appendContext());
    return { id };
  }

  async changePrice(id: string, dto: ChangePriceDto): Promise<void> {
    const ad = await this.loadOrThrow(id);
    ad.changePrice(dto.price, dto.reason);
    await this.repo.save(ad, this.appendContext());
  }

  async publish(id: string, externalId: string, url: string | null): Promise<void> {
    const ad = await this.loadOrThrow(id);
    ad.publish(externalId, url);
    await this.repo.save(ad, this.appendContext());
  }

  async archive(id: string, reason: string | null): Promise<void> {
    const ad = await this.loadOrThrow(id);
    ad.archive(reason);
    await this.repo.save(ad, this.appendContext());
  }

  async recordView(id: string, count: number, source: string | null): Promise<void> {
    const ad = await this.loadOrThrow(id);
    ad.recordView(count, source);
    await this.repo.save(ad, this.appendContext());
  }

  private async loadOrThrow(id: string): Promise<AdAggregate> {
    const ad = await this.repo.load(id);
    if (!ad) throw new NotFoundError('Ad', id);
    return ad;
  }
}
