# OAuth Flow — Avito

Production Authorization Code flow with optional Client Credentials for service apps.

## Authorization Code (recommended)

```mermaid
sequenceDiagram
  actor User
  participant UI as Web UI
  participant API as NEEKLO API
  participant Vault as Credential Vault
  participant Avito as avito.ru/oauth

  User->>UI: Enter Client ID + Secret
  UI->>API: POST /api/auth/avito/connect
  API->>API: Create Account aggregate
  API->>Vault: Store encrypted credentials (pending)
  API->>API: Create OAuthPendingFlow (state, 15min TTL)
  API-->>UI: authorizationUrl + state
  UI->>Avito: Redirect user
  User->>Avito: Grant permissions
  Avito->>API: GET /api/auth/os/callback?code&state
  API->>API: Validate state + expiry
  API->>Avito: POST /token (authorization_code)
  Avito-->>API: access_token + refresh_token
  API->>Vault: Update encrypted tokens (connected)
  API->>Avito: GET /core/v1/accounts/self
  API->>API: AccountAuthorized event
  API->>API: oauth.connected event + audit log
  API->>UI: Redirect /avito/accounts?connected=1
```

## Client Credentials

For applications without user delegation:

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant Vault
  participant Avito as api.avito.ru/token

  UI->>API: POST /connect (grantType=client_credentials)
  API->>Avito: client_credentials grant
  Avito-->>API: access_token
  API->>Vault: Store tokens (connected)
  API-->>UI: accountId, credentialId, status=connected
```

## Token refresh

Automatic (Token Manager) and manual (`POST /api/auth/avito/refresh`):

```mermaid
sequenceDiagram
  participant TM as TokenManager
  participant Vault
  participant Avito

  TM->>Vault: listExpiringBefore(now + lead)
  loop each credential
    TM->>Vault: decrypt refresh_token
    TM->>Avito: grant_type=refresh_token
    Avito-->>TM: new access_token
    TM->>Vault: re-encrypt + update expiry
    TM->>TM: emit oauth.token_refreshed
  end
```

## Disconnect

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant Vault

  UI->>API: POST /disconnect { accountId }
  API->>Vault: delete credential row
  API->>API: AccountAuthorizationFailed
  API->>API: oauth.disconnected + oauth.credential_removed
```

## Redirect URIs

| Environment | Callback URL |
|-------------|--------------|
| Local | `http://localhost:3001/api/auth/os/callback` |
| Production | `https://integrator.neeklo.ru/api/auth/os/callback` |

Configure the same URI in Avito developer portal.

## State & CSRF

- `state` = cryptographically random UUID v4
- Stored in `oauth_pending_flow` with 15-minute TTL
- Callback rejected if state unknown or expired

## PKCE

Avito OAuth provider supports PKCE (`supportsPkce: true` in adapter config when required). Code verifier stored in `OAuthPendingFlow.codeVerifier` when enabled.

## UI flow

```
Marketplace → Avito → Подключить → OAuth → Проверка → Токены → ✓ Connected
```

Implemented in `apps/web/src/pages/settings/oauth-settings-page.tsx` (`/settings/oauth`).
