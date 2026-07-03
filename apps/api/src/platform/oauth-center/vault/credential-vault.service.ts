import { Injectable, NotFoundException } from '@nestjs/common';
import { MarketplaceCode } from '@neeklo/contracts';
import { OAuthCredentialStatus } from '@neeklo/contracts/events';
import { PrismaService } from '../../prisma/prisma.service';
import { CredentialCipherService } from '../encryption/credential-cipher.service';
import type {
  DecryptedOAuthCredentials,
  OAuthCredentialRecord,
  StoreCredentialInput,
  TokenUpdateInput,
} from '../providers/oauth-provider.types';

@Injectable()
export class CredentialVaultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: CredentialCipherService,
  ) {}

  async store(input: StoreCredentialInput): Promise<OAuthCredentialRecord> {
    const keyVersion = this.cipher.currentKeyVersion();
    const row = await this.prisma.oAuthCredentialVault.upsert({
      where: {
        tenantId_provider_accountId: {
          tenantId: input.tenantId,
          provider: input.provider,
          accountId: input.accountId,
        },
      },
      create: {
        tenantId: input.tenantId,
        provider: input.provider,
        accountId: input.accountId,
        displayName: input.displayName,
        grantType: input.grantType,
        clientIdEnc: this.cipher.encrypt(input.clientId, keyVersion),
        clientSecretEnc: this.cipher.encrypt(input.clientSecret, keyVersion),
        accessTokenEnc: input.accessToken ? this.cipher.encrypt(input.accessToken, keyVersion) : null,
        refreshTokenEnc: input.refreshToken ? this.cipher.encrypt(input.refreshToken, keyVersion) : null,
        scopes: input.scopes ?? [],
        tokenExpiresAt: input.tokenExpiresAt ?? null,
        refreshExpiresAt: input.refreshExpiresAt ?? null,
        externalAccountId: input.externalAccountId ?? null,
        status: input.status ?? OAuthCredentialStatus.PENDING,
        health: 'unknown',
        keyVersion,
      },
      update: {
        displayName: input.displayName,
        grantType: input.grantType,
        clientIdEnc: this.cipher.encrypt(input.clientId, keyVersion),
        clientSecretEnc: this.cipher.encrypt(input.clientSecret, keyVersion),
        accessTokenEnc: input.accessToken ? this.cipher.encrypt(input.accessToken, keyVersion) : undefined,
        refreshTokenEnc: input.refreshToken ? this.cipher.encrypt(input.refreshToken, keyVersion) : undefined,
        scopes: input.scopes ?? [],
        tokenExpiresAt: input.tokenExpiresAt ?? undefined,
        refreshExpiresAt: input.refreshExpiresAt ?? undefined,
        externalAccountId: input.externalAccountId ?? undefined,
        status: input.status ?? undefined,
        keyVersion,
        updatedAt: new Date(),
      },
    });
    return this.toRecord(row);
  }

  async findByAccount(tenantId: string, provider: MarketplaceCode, accountId: string): Promise<OAuthCredentialRecord | null> {
    const row = await this.prisma.oAuthCredentialVault.findUnique({
      where: { tenantId_provider_accountId: { tenantId, provider, accountId } },
    });
    return row ? this.toRecord(row) : null;
  }

  async findById(credentialId: string): Promise<OAuthCredentialRecord | null> {
    const row = await this.prisma.oAuthCredentialVault.findUnique({ where: { id: credentialId } });
    return row ? this.toRecord(row) : null;
  }

  async listByTenant(tenantId: string, provider?: MarketplaceCode): Promise<OAuthCredentialRecord[]> {
    const rows = await this.prisma.oAuthCredentialVault.findMany({
      where: { tenantId, ...(provider ? { provider } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toRecord(r));
  }

  async listExpiringBefore(before: Date): Promise<OAuthCredentialRecord[]> {
    const rows = await this.prisma.oAuthCredentialVault.findMany({
      where: {
        status: OAuthCredentialStatus.CONNECTED,
        tokenExpiresAt: { lte: before, not: null },
      },
    });
    return rows.map((r) => this.toRecord(r));
  }

  decrypt(record: OAuthCredentialRecord): DecryptedOAuthCredentials {
    return {
      clientId: this.cipher.decrypt(record.clientIdEnc),
      clientSecret: this.cipher.decrypt(record.clientSecretEnc),
      accessToken: record.accessTokenEnc ? this.cipher.decrypt(record.accessTokenEnc) : null,
      refreshToken: record.refreshTokenEnc ? this.cipher.decrypt(record.refreshTokenEnc) : null,
    };
  }

  /** Returns access token only — never expose secrets to callers. */
  async getAccessToken(tenantId: string, provider: MarketplaceCode, accountId: string): Promise<string | null> {
    const record = await this.findByAccount(tenantId, provider, accountId);
    if (!record?.accessTokenEnc) return null;
    if (record.tokenExpiresAt && record.tokenExpiresAt.getTime() <= Date.now()) return null;
    return this.cipher.decrypt(record.accessTokenEnc);
  }

  async updateTokens(credentialId: string, update: TokenUpdateInput): Promise<OAuthCredentialRecord> {
    const existing = await this.prisma.oAuthCredentialVault.findUnique({ where: { id: credentialId } });
    if (!existing) throw new NotFoundException('Credential not found');

    const keyVersion = this.cipher.currentKeyVersion();
    const row = await this.prisma.oAuthCredentialVault.update({
      where: { id: credentialId },
      data: {
        accessTokenEnc: this.cipher.encrypt(update.accessToken, keyVersion),
        refreshTokenEnc:
          update.refreshToken !== undefined
            ? update.refreshToken
              ? this.cipher.encrypt(update.refreshToken, keyVersion)
              : null
            : undefined,
        tokenExpiresAt: update.tokenExpiresAt,
        refreshExpiresAt: update.refreshExpiresAt ?? undefined,
        externalAccountId: update.externalAccountId ?? undefined,
        scopes: update.scopes ?? undefined,
        status: OAuthCredentialStatus.CONNECTED,
        lastRefreshAt: new Date(),
        lastSuccessAt: new Date(),
        lastError: null,
        health: 'healthy',
        keyVersion,
      },
    });
    return this.toRecord(row);
  }

  async updateStatus(
    credentialId: string,
    patch: Partial<Pick<OAuthCredentialRecord, 'status' | 'health' | 'lastError' | 'lastSuccessAt'>>,
  ): Promise<OAuthCredentialRecord> {
    const row = await this.prisma.oAuthCredentialVault.update({
      where: { id: credentialId },
      data: {
        status: patch.status,
        health: patch.health,
        lastError: patch.lastError,
        lastSuccessAt: patch.lastSuccessAt,
      },
    });
    return this.toRecord(row);
  }

  async remove(credentialId: string): Promise<void> {
    await this.prisma.oAuthCredentialVault.delete({ where: { id: credentialId } });
  }

  async rotateAllKeys(tenantId: string): Promise<number> {
    const rows = await this.prisma.oAuthCredentialVault.findMany({ where: { tenantId } });
    let count = 0;
    for (const row of rows) {
      await this.prisma.oAuthCredentialVault.update({
        where: { id: row.id },
        data: {
          clientIdEnc: this.cipher.rotate(row.clientIdEnc),
          clientSecretEnc: this.cipher.rotate(row.clientSecretEnc),
          accessTokenEnc: row.accessTokenEnc ? this.cipher.rotate(row.accessTokenEnc) : null,
          refreshTokenEnc: row.refreshTokenEnc ? this.cipher.rotate(row.refreshTokenEnc) : null,
          keyVersion: this.cipher.currentKeyVersion(),
        },
      });
      count++;
    }
    return count;
  }

  private toRecord(row: {
    id: string;
    tenantId: string;
    provider: string;
    accountId: string;
    externalAccountId: string | null;
    displayName: string;
    grantType: string;
    clientIdEnc: string;
    clientSecretEnc: string;
    accessTokenEnc: string | null;
    refreshTokenEnc: string | null;
    scopes: string[];
    tokenExpiresAt: Date | null;
    refreshExpiresAt: Date | null;
    status: string;
    health: string;
    lastRefreshAt: Date | null;
    lastError: string | null;
    lastSuccessAt: Date | null;
    keyVersion: number;
    createdAt: Date;
    updatedAt: Date;
  }): OAuthCredentialRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      provider: row.provider as MarketplaceCode,
      accountId: row.accountId,
      externalAccountId: row.externalAccountId,
      displayName: row.displayName,
      grantType: row.grantType as 'authorization_code' | 'client_credentials',
      scopes: row.scopes,
      tokenExpiresAt: row.tokenExpiresAt,
      refreshExpiresAt: row.refreshExpiresAt,
      status: row.status as OAuthCredentialStatus,
      health: row.health as OAuthCredentialRecord['health'],
      lastRefreshAt: row.lastRefreshAt,
      lastError: row.lastError,
      lastSuccessAt: row.lastSuccessAt,
      keyVersion: row.keyVersion,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      clientIdEnc: row.clientIdEnc,
      clientSecretEnc: row.clientSecretEnc,
      accessTokenEnc: row.accessTokenEnc,
      refreshTokenEnc: row.refreshTokenEnc,
    };
  }
}
