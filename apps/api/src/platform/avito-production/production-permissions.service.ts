import { Injectable } from '@nestjs/common';
import { MarketplaceCode, type AvitoPermissionsDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialVaultService } from '../oauth-center/vault/credential-vault.service';
import { AvitoClient } from '../adapters/avito/avito.client';

const REQUIRED_SCOPES = [
  'messenger:read',
  'messenger:write',
  'stats:read',
  'items:info',
  'user:read',
  'autoload:reports',
] as const;

const API_CHECKS: { scope: string; method: string; path: string; probe: (selfId: number) => { method: string; path: string; body?: unknown } }[] = [
  { scope: 'messenger:read', method: 'GET', path: '/messenger/v2/chats', probe: (id) => ({ method: 'GET', path: `/messenger/v2/accounts/${id}/chats` }) },
  { scope: 'stats:read', method: 'POST', path: '/stats/v1/items', probe: (id) => ({ method: 'POST', path: `/stats/v1/accounts/${id}/items`, body: { dateFrom: new Date().toISOString().slice(0, 10), dateTo: new Date().toISOString().slice(0, 10), fields: ['uniqViews'], itemIds: [], periodGrouping: 'day' } }) },
  { scope: 'items:info', method: 'GET', path: '/core/v1/items', probe: (id) => ({ method: 'GET', path: '/core/v1/items', body: undefined }) },
  { scope: 'autoload:reports', method: 'GET', path: '/autoload/v2/profile', probe: () => ({ method: 'GET', path: '/autoload/v2/profile' }) },
];

@Injectable()
export class ProductionPermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: CredentialVaultService,
    private readonly avito: AvitoClient,
  ) {}

  async get(tenantId: string, accountId: string): Promise<AvitoPermissionsDto> {
    const cred = await this.vault.findByAccount(tenantId, MarketplaceCode.AVITO, accountId);
    const grantedScopes = cred?.scopes ?? [];
    const detail = await this.prisma.avitoAccountDetailReadModel.findFirst({ where: { tenantId, accountId } });
    const tariff = detail?.status ?? 'unknown';

    let selfId: number | null = null;
    try {
      const self = await this.avito.request<{ id: number }>(tenantId, accountId, 'GET', '/core/v1/accounts/self');
      selfId = self.id;
    } catch {
      selfId = null;
    }

    const permissions: AvitoPermissionsDto['permissions'] = REQUIRED_SCOPES.map((scope) => {
      const prefix = scope.split(':')[0] ?? scope;
      const granted = grantedScopes.some((s) => s === scope || s.startsWith(prefix));
      return { scope, granted, available: granted, message: granted ? 'Scope granted' : 'Scope missing in OAuth token' };
    });

    for (const check of API_CHECKS) {
      const idx = permissions.findIndex((p) => p.scope === check.scope);
      const row = idx >= 0 ? permissions[idx] : undefined;
      if (!row?.granted || !selfId) continue;
      try {
        const probe = check.probe(selfId);
        await this.avito.request(tenantId, accountId, probe.method, probe.path, { body: probe.body });
        permissions[idx] = { scope: row.scope, granted: row.granted, available: true, message: 'API probe OK' };
      } catch {
        permissions[idx] = { scope: row.scope, granted: row.granted, available: false, message: 'Scope granted but API unavailable for tariff/account' };
      }
    }

    const unavailableApis = permissions.filter((p) => !p.available).map((p) => p.scope);

    return { grantedScopes, tariff, permissions, unavailableApis };
  }
}
