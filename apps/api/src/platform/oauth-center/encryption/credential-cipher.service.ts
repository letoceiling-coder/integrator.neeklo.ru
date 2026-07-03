import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { Env } from '../../../config/env.schema';

/**
 * AES-256-GCM encryption for Credential Vault secrets.
 * Key material: SHA-256(OAUTH_VAULT_MASTER_KEY + keyVersion).
 */
@Injectable()
export class CredentialCipherService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private deriveKey(version: number): Buffer {
    const master = this.config.get('OAUTH_VAULT_MASTER_KEY', { infer: true });
    return createHash('sha256').update(`${master}:v${version}`).digest();
  }

  currentKeyVersion(): number {
    return this.config.get('OAUTH_VAULT_KEY_VERSION', { infer: true });
  }

  encrypt(plaintext: string, keyVersion?: number): string {
    const ver = keyVersion ?? this.currentKeyVersion();
    const key = this.deriveKey(ver);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [ver, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
  }

  decrypt(blob: string): string {
    const parts = blob.split(':');
    if (parts.length !== 4) throw new Error('Invalid encrypted blob format');
    const [verStr, ivB64, tagB64, dataB64] = parts;
    const ver = Number(verStr);
    const key = this.deriveKey(ver);
    const iv = Buffer.from(ivB64!, 'base64url');
    const tag = Buffer.from(tagB64!, 'base64url');
    const data = Buffer.from(dataB64!, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  /** Re-encrypt with current key version (rotation). */
  rotate(blob: string): string {
    const plain = this.decrypt(blob);
    return this.encrypt(plain, this.currentKeyVersion());
  }
}
