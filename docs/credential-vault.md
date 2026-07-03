# Credential Vault

Encrypted storage for marketplace OAuth secrets — **never plaintext**, **never `.env` tokens**.

## Data model

```mermaid
erDiagram
  OAuthCredentialVault {
    uuid id PK
    uuid tenant_id
    string provider
    uuid account_id
    string external_account_id
    string display_name
    string grant_type
    string client_id_enc
    string client_secret_enc
    string access_token_enc
    string refresh_token_enc
    string[] scopes
    timestamptz token_expires_at
    timestamptz refresh_expires_at
    string status
    string health
    timestamptz last_refresh_at
    string last_error
    timestamptz last_success_at
    int key_version
  }

  OAuthPendingFlow {
    uuid id PK
    uuid tenant_id
    string provider
    string state UK
    uuid account_id
    string client_id_enc
    string client_secret_enc
    string redirect_uri
    uuid user_id
    timestamptz expires_at
  }

  OAuthCredentialVault ||--o| OAuthPendingFlow : "authorization in progress"
```

## Stored fields

| Field | Encrypted | Exposed in UI |
|-------|-----------|--------------|
| Client ID | ✅ | Masked (never returned via API) |
| Client Secret | ✅ | Never |
| Access Token | ✅ | Never (only expiry shown) |
| Refresh Token | ✅ | Never |
| Scopes | ❌ | ✅ |
| Status / Health | ❌ | ✅ |
| Expires At | ❌ | ✅ |

## Encryption

- Algorithm: **AES-256-GCM**
- Key derivation: `SHA-256(OAUTH_VAULT_MASTER_KEY + ":v" + keyVersion)`
- Blob format: `version:iv:tag:ciphertext` (base64url)

```mermaid
sequenceDiagram
  participant App
  participant Cipher as CredentialCipherService
  participant DB as PostgreSQL

  App->>Cipher: encrypt(plaintext, keyVersion)
  Cipher->>Cipher: deriveKey(version)
  Cipher->>Cipher: AES-256-GCM + random IV
  Cipher-->>App: encrypted blob
  App->>DB: store blob in *_enc column
```

## Key rotation

1. Increment `OAUTH_VAULT_KEY_VERSION` in environment
2. Call `CredentialVaultService.rotateAllKeys(tenantId)` (admin operation)
3. Each blob is decrypted with old version and re-encrypted with new version

## Unique constraint

`(tenantId, provider, accountId)` — one credential row per marketplace account.

## Status lifecycle

```mermaid
stateDiagram-v2
  [*] --> pending: connect started
  pending --> connected: tokens received
  connected --> expired: access token expired
  connected --> reauth_required: refresh failed
  connected --> disconnected: user disconnect
  expired --> connected: successful refresh
  reauth_required --> connected: reconnect
  disconnected --> [*]
```

## Implementation

- Service: `apps/api/src/platform/oauth-center/vault/credential-vault.service.ts`
- Cipher: `apps/api/src/platform/oauth-center/encryption/credential-cipher.service.ts`
- Schema: `apps/api/prisma/schema.prisma` → `OAuthCredentialVault`, `OAuthPendingFlow`
