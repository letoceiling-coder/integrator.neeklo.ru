
export function appendProductSections(w, esc, sections, endpoints) {
  // ─── 3 OAUTH ────────────────────────────────────────────────
  w('## 3. OAuth, Scopes, Tokens');
  w('');
  w('### 3.1. Типы авторизации (официально)');
  w('');
  w('| Flow | Grant Type | Use Case | Refresh | TTL Access | TTL Refresh |');
  w('| --- | --- | --- | --- | --- | --- |');
  w('| Персональная | `client_credentials` | Интеграция своего аккаунта Avito Pro | Re-request token | 24h | N/A |');
  w('| Приложение | `authorization_code` | Доступ к данным других пользователей | `refresh_token` | 24h | 1 year |');
  w('');
  w('### 3.2. Token endpoints');
  w('');
  w('| Method | Path | operationId | Purpose |');
  w('| --- | --- | --- | --- |');
  w('| POST | `/token` | getAccessToken | client_credentials → access_token |');
  w('| POST | `/token` (variant) | getAccessTokenAuthorizationCode | authorization_code → access + refresh |');
  w('| POST | `/token` (variant) | refreshAccessTokenAuthorizationCode | refresh_token → new tokens |');
  w('');
  w('**Request (client_credentials):**');
  w('```');
  w('POST https://api.avito.ru/token');
  w('Content-Type: application/x-www-form-urlencoded');
  w('');
  w('grant_type=client_credentials&client_id=CLIENT_ID&client_secret=CLIENT_SECRET');
  w('```');
  w('');
  w('**Response 200:**');
  w('```json');
  w('{ "access_token": "...", "expires_in": 86400, "token_type": "Bearer" }');
  w('```');
  w('');
  w('### 3.3. Authorization Code flow (multi-tenant apps)');
  w('');
  w('```mermaid');
  w('sequenceDiagram');
  w('  participant U as User');
  w('  participant N as NEEKLO Web');
  w('  participant A as avito.ru/oauth');
  w('  participant API as api.avito.ru/token');
  w('  participant DB as Credential Vault');
  w('');
  w('  U->>N: Connect Avito Account');
  w('  N->>A: Redirect with client_id, scope, state');
  w('  U->>A: Approve scopes');
  w('  A->>N: Redirect URI ?code=AUTH_CODE&state=STATE');
  w('  N->>API: POST grant_type=authorization_code');
  w('  API-->>N: access_token + refresh_token');
  w('  N->>DB: Encrypt store tokens per tenant/account');
  w('  N->>API: GET /core/v1/accounts/self');
  w('  API-->>N: account profile');
  w('  N-->>U: Connected ✔');
  w('```');
  w('');
  w('### 3.4. NEEKLO Credential Storage (planned — ADR Stage 4)');
  w('');
  w('| Field | Storage | Encrypted | Notes |');
  w('| --- | --- | --- | --- |');
  w('| client_id | Tenant settings OR env (single-tenant deploy) | No | integrator.neeklo.ru uses env today |');
  w('| client_secret | Vault / env | **Yes** | Never expose to frontend |');
  w('| access_token | Redis cache + DB | Yes | TTL aligned with expires_in |');
  w('| refresh_token | DB vault | **Yes** | Only for authorization_code flow |');
  w('| scopes | DB | No | Audit which permissions granted |');
  w('');
  w('### 3.5. Error codes (auth)');
  w('');
  w('| HTTP | Meaning | NEEKLO UX |');
  w('| --- | --- | --- |');
  w('| 401 | Invalid credentials | «Проверьте Client ID / Secret» |');
  w('| 403 | Expired token | Auto-refresh or re-connect |');
  w('| 402 | Subscription required | «Требуется тариф Расширенный/Максимальный» |');
  w('');
  w('---');
  w('');

  // ─── 4 CAPABILITY MATRIX ────────────────────────────────────
  w('## 4. Матрица возможностей');
  w('');
  w('Легенда: ✔ = официальный API + реализуемо | 🟡 = частично / workaround | 🔴 = нет в API | ✔* = реализовано в NEEKLO |');
  w('');
  const capabilities = [
    ['OAuth client_credentials', 'POST /token', '✔', '—', '24h token, no refresh', 'NEEKLO uses this today'],
    ['OAuth authorization_code', 'POST /token + avito.ru/oauth', '✔', '—', 'App registration required', 'Multi-tenant roadmap'],
    ['Refresh token', 'POST /token refresh_token', '✔', '—', '1 year refresh TTL', 'Not wired in NEEKLO yet'],
    ['Profile / Self', 'GET /core/v1/accounts/self', '✔', '—', 'user:read scope for apps', '✔* implemented'],
    ['Wallet balance', 'user API', '✔', '—', 'user_balance:read', 'Not in NEEKLO UI'],
    ['Operation history', 'user API', '✔', '—', 'user_operations:read', 'Maps to Budget import'],
    ['List items (REST CRUD)', 'item API', '🟡', '—', 'items:info — read/status/VAS, not full CRUD', 'Use Autoload for write'],
    ['Create ad via REST', 'item API', '🔴', '—', 'Publication via Autoload feed', 'Local draft + export'],
    ['Edit ad via REST', 'item API', '🟡', '—', 'Limited; category-dependent', 'Autoload preferred'],
    ['Archive ad', 'item API', '🟡', '—', 'Via item status / autoload', 'NEEKLO domain event AdArchived'],
    ['Apply VAS / promotion', 'promotion, items:apply_vas', '✔', '—', 'Paid services', 'Not implemented'],
    ['Item statistics', 'POST /stats/v1/accounts/{id}/items', '✔', '—', 'stats:read, max 1000 items/request', '✔* implemented'],
    ['Autoload upload', 'autoload/v4/*', '✔', '—', 'XML/feed based', '🔴 not implemented'],
    ['Autoload reports', 'autoload reports', '✔', '—', 'autoload:reports scope', 'Feed status UI planned'],
    ['Messenger list chats', 'GET messenger v2', '✔', '—', 'Subscription required', '🟡 listConversations stub'],
    ['Messenger read messages', 'GET messenger v3', '✔', '—', 'messenger:read', '🟡 partial'],
    ['Messenger send text', 'POST messenger v1 messages', '✔', '—', 'messenger:write', '✔* implemented'],
    ['Messenger send image', 'uploadImages + postSendImageMessage', '✔', '—', 'messenger:write', 'Not implemented'],
    ['Messenger voice', 'getVoiceFiles', '✔', '—', 'messenger:read', 'Not implemented'],
    ['Messenger webhook', 'postWebhookV3', '✔', '—', 'HTTPS callback URL', '🟡 verifySignature stub'],
    ['Messenger blacklist', 'postBlacklistV2', '✔', '—', 'messenger:write', 'Not in UI'],
    ['Regional multi-city publish', '—', '🔴', '—', 'No single API; duplicate via Autoload', 'Local draft batches'],
    ['Competitor tracking', '—', '🔴', '—', 'No official API', 'Separate module / manual'],
    ['CPA / auction', 'cpa, auction APIs', '✔', '—', 'B2B vertical', 'Out of MVP scope'],
    ['Job vacancies', 'job API', '✔', '—', 'job:* scopes', 'Separate vertical'],
    ['STR (short rent)', 'str API', '✔', '—', 'short_term_rent:*', 'Category-specific'],
    ['Delivery orders', 'order-management', '✔', '—', 'B2C sellers only', 'Not in scope'],
    ['Ratings/reviews', 'ratings API', '✔', '—', 'Read/manage reviews', 'Future'],
    ['CallTracking', 'calltracking API', '✔', '—', 'Phone analytics', 'Future'],
    ['Realty analytics', 'realty-reports', '✔', '—', 'Real estate vertical', 'Future'],
    ['Stock management', 'stock-management', '✔', '—', 'Quantity in listing', 'Autoload attrs'],
    ['SBC discount broadcast', 'sbc-gateway beta', '✔', '—', 'Beta', 'Future'],
    ['Sandbox (full)', '—', '🔴', '—', 'Only delivery-sandbox exists', 'Use prod carefully'],
  ];
  w('| Feature | Avito API | API Exists | NEEKLO Status | Limitation | Comment |');
  w('| --- | --- | --- | --- | --- | --- |');
  for (const row of capabilities) {
    w(`| ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} | ${row[4]} | ${row[5]} |`);
  }
  w('');
  w('---');
  w('');

  // ─── 5 USER FLOW ────────────────────────────────────────────
  w('## 5. User Flow: Account Connection');
  w('');
  w('```mermaid');
  w('flowchart TD');
  w('  A[User opens Settings → Avito] --> B{Credentials configured?}');
  w('  B -->|No| C[Enter Client ID + Secret OR OAuth Connect]');
  w('  B -->|Yes| D[Show connection status]');
  w('  C --> E[POST /api/avito/accounts or OAuth callback]');
  w('  E --> F[Backend: POST api.avito.ru/token]');
  w('  F --> G{Token OK?}');
  w('  G -->|No| H[Show error + audit log]');
  w('  G -->|Yes| I[GET /core/v1/accounts/self]');
  w('  I --> J[Persist AccountReadModel + AvitoAccountDetail]');
  w('  J --> K[Emit avito.account_linked event]');
  w('  K --> L[Test connection ✔]');
  w('  L --> M[Optional: POST sync]');
  w('  M --> N[Pull stats via stats/v1]');
  w('  N --> O[Register webhook messenger v3]');
  w('  O --> P[Subscribe Redis event bus → projections]');
  w('  P --> Q[Realtime via webhook NOT websocket from Avito]');
  w('```');
  w('');
  w('### 5.1. Refresh Token sub-flow (authorization_code only)');
  w('');
  w('```mermaid');
  w('sequenceDiagram');
  w('  participant API as NEEKLO API');
  w('  participant V as Credential Vault');
  w('  participant A as api.avito.ru');
  w('  API->>V: Get refresh_token for account');
  w('  API->>A: POST grant_type=refresh_token');
  w('  alt 200 OK');
  w('    A-->>API: new access + refresh');
  w('    API->>V: Rotate tokens');
  w('  else 403 expired refresh');
  w('    API-->>API: Mark account status=reauth_required');
  w('  end');
  w('```');
  w('');
  w('### 5.2. Realtime model (honest)');
  w('');
  w('| Mechanism | Avito provides | NEEKLO implements |');
  w('| --- | --- | --- |');
  w('| Webhook push (messages) | ✔ Messenger v3 | POST /api/webhooks/avito (planned) |');
  w('| WebSocket from Avito | 🔴 No | — |');
  w('| Polling chats | ✔ API allowed | Fallback with rate limit respect |');
  w('| SSE to browser | N/A | NEEKLO internal SSE (Stage 0.8+) |');
  w('');
  w('---');
  w('');

  // ─── 6 SETTINGS ───────────────────────────────────────────
  w('## 6. Settings Screen');
  w('');
  w('**Route:** `/settings/avito` (new) or extend `/avito/accounts`');
  w('**NEEKLO API:** `/api/avito/*` + `/api/marketplace/accounts`');
  w('');
  w('### 6.1. Layout sections');
  w('');
  w('| Section | Fields | API Mapping |');
  w('| --- | --- | --- |');
  w('| General | Account name, marketplace=avito, active toggle | AccountReadModel |');
  w('| OAuth | Client ID, Client Secret (masked), Redirect URI (read-only) | Env / vault |');
  w('| Scopes | Checklist of granted scopes | OAuth token response.scope |');
  w('| Webhook | Webhook URL (generated), Secret, Subscribe button | postWebhookV3 |');
  w('| Tokens | Access expiry, Refresh expiry, Force refresh | Internal |');
  w('| Status | connected / degraded / reauth_required | health + plugin |');
  w('| Test connection | Button → health check | GET /core/v1/accounts/self |');
  w('| Sync history | Table from AvitoAccountDetail.syncHistory | avito.account_sync_* events |');
  w('| Error log | AuditLog filtered action=avito_* | Observability |');
  w('| Rate limits | Last X-RateLimit-* headers | Response interceptor |');
  w('| API logs | Request log (admin only) | TelemetrySpan |');
  w('');
  w('### 6.2. UX Specification');
  w('');
  w('- Client Secret: never show after save; rotate flow');
  w('- Redirect URI for integrator.neeklo.ru: `https://integrator.neeklo.ru/oauth/avito/callback`');
  w('- Warning banner if tariff insufficient (402 from messenger)');
  w('- Empty state links to https://www.avito.ru/professionals/api');
  w('');
  w('### 6.3. Sequence: Test Connection');
  w('');
  w('```mermaid');
  w('sequenceDiagram');
  w('  participant UI as Settings UI');
  w('  participant API as NEEKLO API');
  w('  participant P as Avito Plugin');
  w('  participant A as api.avito.ru');
  w('  UI->>API: POST /avito/accounts/:id/test');
  w('  API->>P: health.check()');
  w('  P->>A: POST /token + GET /accounts/self');
  w('  A-->>P: 200');
  w('  P-->>API: healthy');
  w('  API-->>UI: { status, latencyMs, checks }');
  w('```');
  w('');
  w('---');
  w('');

  // ─── 7 ADS MANAGEMENT ───────────────────────────────────────
  w('## 7. Ads Management');
  w('');
  w('**Route:** `/ads` (existing Ads Workspace)');
  w('');
  w('### 7.1. Data sources');
  w('');
  w('| Source | When | API |');
  w('| --- | --- | --- |');
  w('| NEEKLO Event Store + AdReadModel | Primary list | /api/ads |');
  w('| Avito Item API | Enrich status/externalId | items:info (scope) |');
  w('| Autoload reports | Sync publish state | autoload:reports |');
  w('');
  w('### 7.2. Feature matrix');
  w('');
  w('| UI Feature | Official API | Implementation |');
  w('| --- | --- | --- |');
  w('| List + pagination | AdReadModel cursor | ✔* |');
  w('| Filters status/marketplace/region | Read model | ✔* |');
  w('| Search title | SearchIndexEntry | ✔* commerce search |');
  w('| Folders / Groups | — | NEEKLO AdGroupReadModel (local) |');
  w('| Tags / Labels | — | NEEKLO metadata (local) |');
  w('| Drafts | — | NEEKLO draft ads (local events) |');
  w('| Archive | item status / autoload | Domain AdArchived event |');
  w('| History | Event store | ListingHistoryEntry |');
  w('| Copy ad | — | Clone aggregate → new AdCreated |');
  w('| Bulk price change | autoload feed OR manual | NEEKLO bulk job → export XML |');
  w('| Bulk publish | autoload | 🔴 Feed Manager required |');
  w('| Bulk archive | autoload deactivate | 🔴 Feed Manager |');
  w('');
  w('### 7.3. Use Cases');
  w('');
  w('| ID | Actor | Flow | Edge Case |');
  w('| --- | --- | --- | --- |');
  w('| AD-01 | Manager | Filter active ads in Moscow | Empty → calm empty state |');
  w('| AD-02 | Manager | Bulk +10% price | Preview diff before apply |');
  w('| AD-03 | Owner | Export selected to Autoload XML | Invalid category → validation errors |');
  w('| AD-04 | System | Sync externalId from Avito | API 403 → show reauth |');
  w('');
  w('---');
  w('');

  // ─── 8 AD EDITOR ────────────────────────────────────────────
  w('## 8. Ad Editor');
  w('');
  w('**Route:** `/ads?id={adId}` (Ads Workspace detail panel)');
  w('');
  w('### 8.1. Single-page sections');
  w('');
  w('| Block | Editable | Avito API | NEEKLO fallback |');
  w('| --- | --- | --- | --- |');
  w('| Photos | Yes | Autoload images / item | S3 MediaAsset |');
  w('| Video | Category-dependent | Autoload | URL reference |');
  w('| Title | Yes | Autoload field | Local + AI generator |');
  w('| Description | Yes | Autoload | Local + AI |');
  w('| Category / Subcategory | Yes | Autoload taxonomy | Static map + KB |');
  w('| Attributes | Yes | Autoload params | Category schema cache |');
  w('| Price | Yes | Autoload Price | AdReadModel |');
  w('| Address / City / Region | Yes | Autoload Address | Region IDs |');
  w('| Status | Read + actions | items:info | Projection |');
  w('| Views / Contacts | Read | stats/v1 | MetricSnapshot |');
  w('| Statistics chart | Read | stats:v1 daily | Analytics Center |');
  w('| Comments | — | 🔴 No API | — |');
  w('| History | Read | — | Event stream replay |');
  w('| AI suggestions | Yes | — | AiGateway + Intelligence |');
  w('| Competitors | Read | 🔴 No API | Manual / future module |');
  w('');
  w('### 8.2. Publish action (honest UX)');
  w('');
  w('```');
  w('[ Save locally ]  [ Export to Autoload XML ]  [ Queue feed upload ]');
  w('');
  w('ℹ️ Прямая публикация через REST недоступна. Объявление будет отправлено через');
  w('   фид Автозагрузки после проверки формата.');
  w('```');
  w('');
  w('---');
  w('');

  // ─── 9 REGIONAL ─────────────────────────────────────────────
  w('## 9. Regional Publishing');
  w('');
  w('### 9.1. Official capability');
  w('');
  w('Avito **не предоставляет** единый API «опубликовать одно объявление в N регионов».');
  w('Региональность достигается через:');
  w('');
  w('1. **Отдельные объявления** в Autoload feed с разными Address/Region');
  w('2. **Дублирование** item entries в XML');
  w('');
  w('### 9.2. NEEKLO approach (current + planned)');
  w('');
  w('| Step | Action | User sees |');
  w('| --- | --- | --- |');
  w('| 1 | Select source ad | Source title/price |');
  w('| 2 | AI localize per region | Preview localized title/price |');
  w('| 3 | Create RegionalDraftReadModel | Batch table |');
  w('| 4 | publishMode=draft | «Будет опубликовано через Autoload» |');
  w('| 5 | Export batch XML | Download + Feed Manager queue |');
  w('');
  w('```mermaid');
  w('flowchart LR');
  w('  S[Source Ad] --> AI[AI Regional localize]');
  w('  AI --> D[Regional Drafts]');
  w('  D --> X[Autoload XML Export]');
  w('  X --> F[Feed Upload]');
  w('  F --> R[Autoload Report]');
  w('  R --> SYNC[Sync externalIds]');
  w('```');
  w('');
  w('---');
  w('');

  // ─── 10 AUTOLOAD ────────────────────────────────────────────
  w('## 10. Autoload / Feed Manager');
  w('');
  w('### 10.1. Official Autoload API (section `autoload`)');
  w('');
  const autoload = sections.find((s) => s.slug === 'autoload');
  if (autoload) {
    w(`Operations in spec: **${autoload.endpoints.length}**`);
    w('');
    w('| Method | Path | Summary |');
    w('| --- | --- | --- |');
    for (const ep of autoload.endpoints) {
      w(`| ${ep.method} | \`${ep.path}\` | ${esc(ep.summary)} |`);
    }
    w('');
  }
  w('**Important:** v1/v2/v3 report endpoints deprecated → use **autoload/v4**');
  w('');
  w('### 10.2. Feed Manager product spec');
  w('');
  w('| Feature | Format | API | Status |');
  w('| --- | --- | --- | --- |');
  w('| Upload feed | XML (primary), CSV/JSON convert → XML | autoload upload | 🔴 |');
  w('| Schedule auto-update | Cron + diff | NEEKLO job engine | 🔴 |');
  w('| Upload history | — | autoload v4 uploads | 🔴 |');
  w('| Error report | — | autoload reports | 🔴 |');
  w('| Validation preview | — | Local XSD + Avito rules | 🔴 |');
  w('| Preview rendered ad | — | Local template | 🔴 |');
  w('');
  w('### 10.3. Feed formats');
  w('');
  w('| Format | Support | Notes |');
  w('| --- | --- | --- |');
  w('| XML | ✔ Primary | Avito Autoload native |');
  w('| CSV | 🟡 Import | Convert to XML internally |');
  w('| JSON | 🟡 Import | Convert to XML internally |');
  w('');
  w('Support contact: supportautoload@avito.ru');
  w('');
  w('---');
  w('');

  // ─── 11 MESSENGER ───────────────────────────────────────────
  w('## 11. Messenger / Inbox');
  w('');
  w('### 11.1. Official Messenger endpoints');
  w('');
  const messenger = sections.find((s) => s.slug === 'messenger');
  if (messenger) {
    w('| Method | Path | operationId | Summary |');
    w('| --- | --- | --- | --- |');
    for (const ep of messenger.endpoints) {
      w(`| ${ep.method} | \`${ep.path}\` | \`${ep.operationId}\` | ${esc(ep.summary)} |`);
    }
    w('');
  }
  w('### 11.2. Inbox UI spec (3-column — existing /avito/inbox via /chats)');
  w('');
  w('| Column | Content | API |');
  w('| --- | --- | --- |');
  w('| Left | Conversation list, filters unread/pinned | GET messenger v2 chats → commerce inbox |');
  w('| Center | Message thread | GET messenger v3 messages |');
  w('| Right | Customer 360, ad context, AI | commerce customers + ads |');
  w('');
  w('### 11.3. Feature matrix');
  w('');
  w('| Feature | API | Status |');
  w('| --- | --- | --- |');
  w('| Receive messages | webhook v3 + poll | 🟡 |');
  w('| Send text | POST v1 messages | ✔* |');
  w('| Send image | uploadImages | 🔴 |');
  w('| Attachments | API limited | 🔴 |');
  w('| Read receipts | chatRead | 🔴 |');
  w('| Blacklist | postBlacklistV2 | 🔴 |');
  w('| Voice messages | getVoiceFiles | 🔴 |');
  w('| AI Draft | — | ✔* AiGateway |');
  w('| AI Summary | — | ✔* |');
  w('| AI Agent auto-send | messenger:write | 🟡 confidence gate 0.7 |');
  w('');
  w('### 11.4. Webhook sequence');
  w('');
  w('```mermaid');
  w('sequenceDiagram');
  w('  participant Avito');
  w('  participant WH as NEEKLO /api/webhooks/avito');
  w('  participant EB as Event Bus');
  w('  participant P as Conversation Projection');
  w('  participant UI as Inbox SSE');
  w('  Avito->>WH: POST message payload');
  w('  WH->>WH: verify signature');
  w('  WH->>EB: avito.webhook_received');
  w('  EB->>P: project message');
  w('  P->>UI: notify (future SSE)');
  w('```');
  w('');
  w('---');
  w('');

  // ─── 12 AI AGENT ────────────────────────────────────────────
  w('## 12. AI Agent');
  w('');
  w('Uses **NEEKLO AI Platform** (Stage 0.5) — not Avito-native.');
  w('Avito API involvement: `messenger:write` for send only.');
  w('');
  w('### 12.1. Settings');
  w('');
  w('| Setting | Type | Default | Data source |');
  w('| --- | --- | --- | --- |');
  w('| enabled | boolean | false | Tenant aiSettings |');
  w('| workingHours | schedule | 09-21 | Tenant settings |');
  w('| maxDiscountPercent | number | 0 | Tenant policy |');
  w('| maxDialogTurns | number | 20 | Agent config |');
  w('| handoffToManager | boolean | true | Agent config |');
  w('| useKnowledgeBase | boolean | true | Avito KB service |');
  w('| useCustomerHistory | boolean | true | CustomerReadModel |');
  w('| useAdHistory | boolean | true | ListingHistory |');
  w('| useRegionalIntel | boolean | true | RegionalIntelligenceEngine |');
  w('| useForecast | boolean | true | ForecastEngine |');
  w('| useDecisionEngine | boolean | true | DecisionEngine |');
  w('| useMemory | boolean | true | AiMemory v2 |');
  w('| tone | enum | professional | Prompt registry |');
  w('| systemPromptId | uuid | — | PromptRegistry |');
  w('| strategy | enum | balanced | StrategyReadModel |');
  w('');
  w('### 12.2. Safety gates');
  w('');
  w('- Auto-send only if confidence ≥ 0.7 (existing SalesAgentService)');
  w('- Never auto-send outside workingHours');
  w('- Audit every AI send as event with correlationId');
  w('- Rate limit sends per Avito messenger limits');
  w('');
  w('---');
  w('');

  // ─── 13 NOTIFICATIONS ───────────────────────────────────────
  w('## 13. Notifications');
  w('');
  w('| Channel | Avito API | NEEKLO | Status |');
  w('| --- | --- | --- | --- |');
  w('| Telegram | — | TELEGRAM_BOT_TOKEN | 🟡 config only |');
  w('| MAX | — | maxUserId field | 🟡 |');
  w('| Email | — | SMTP (future) | 🔴 |');
  w('| Web Push | — | browser API | 🔴 |');
  w('');
  w('### Event triggers');
  w('');
  w('| Event | Source | Default |');
  w('| --- | --- | --- |');
  w('| New message | webhook | ✔ on |');
  w('| New deal | NEEKLO deal event | ✔ on |');
  w('| API error | observability | ✔ on |');
  w('| Promotion ending | promotion API poll | 🟡 future |');
  w('| AI recommendation | RecommendationEngine | ✔ on |');
  w('');
  w('---');
  w('');

  // ─── 14 ANALYTICS ───────────────────────────────────────────
  w('## 14. Analytics');
  w('');
  w('### 14.1. Official stats fields (stats/v1)');
  w('');
  w('| Metric | API field | NEEKLO field |');
  w('| --- | --- | --- |');
  w('| Views | uniqViews | views |');
  w('| Contacts | uniqContacts | contacts |');
  w('| Favorites | uniqFavorites | favorites |');
  w('| CTR | derived | ctr (MetricsEngine) |');
  w('| ROI/ROAS | — | derived + budget import |');
  w('| CPA | — | MetricsEngine |');
  w('');
  w('### 14.2. Granularity');
  w('');
  w('| Period | API | UI |');
  w('| --- | --- | --- |');
  w('| Daily | periodGrouping=day | ✔ charts |');
  w('| Weekly | aggregate in NEEKLO | Intelligence warehouse |');
  w('| By region | RegionalIntelligenceEngine | /analytics/regional |');
  w('| By ad | itemIds[] | /avito/analytics/ads/:id |');
  w('');
  w('---');
  w('');

  // ─── 15 EXPENSES ────────────────────────────────────────────
  w('## 15. Expenses / Budget');
  w('');
  w('| Data | Official API | NEEKLO |');
  w('| --- | --- | --- |');
  w('| Wallet balance | user_balance:read | Future |');
  w('| Operations history | user_operations:read | Future auto-import |');
  w('| CPA spend | cpa API | Future |');
  w('| Promotion spend | promotion API | Future |');
  w('| Manual CSV import | — | ✔* BudgetImportReadModel |');
  w('| Excel import | — | 🟡 parse xlsx → CSV |');
  w('');
  w('---');
  w('');

  // ─── 16 MEDIA STUDIO ────────────────────────────────────────
  w('## 16. Media Studio');
  w('');
  w('**Not Avito API** — NEEKLO AI + Selectel S3.');
  w('');
  w('| Asset | Generation | Storage | Link to ad |');
  w('| --- | --- | --- | --- |');
  w('| Photo | AI image model via OpenRouter | S3 storageKey | MediaAssetReadModel |');
  w('| Banner | AI | S3 | entityType=ad |');
  w('| Infographic | AI | S3 | |');
  w('| Presentation PDF | AI + pdf lib | S3 | |');
  w('');
  w('Publish to Avito: include URLs in Autoload XML image fields.');
  w('');
  w('---');
  w('');

  // ─── 17 COMPETITORS ─────────────────────────────────────────
  w('## 17. Competitors');
  w('');
  w('### ⚠️ OFFICIAL STATUS: NO API');
  w('');
  w('Avito Business API **не предоставляет** endpoints для:');
  w('- мониторинга чужих объявлений');
  w('- отслеживания цен конкурентов');
  w('- позиций в выдаче');
  w('');
  w('### NEEKLO honest approach');
  w('');
  w('| Approach | Compliance | Status |');
  w('| --- | --- | --- |');
  w('| Competitor Intelligence Engine (internal snapshots) | Only user-provided data | 🟡 scaffold |');
  w('| Manual competitor URL entry | User responsibility | Future |');
  w('| Third-party parsers | **Risk** — may violate ToS | **Not recommended** |');
  w('| UI scaffold /competitors | Shows «В разработке» | ✔ honest |');
  w('');
  w('---');
  w('');

  // ─── 18 UI SPECS ────────────────────────────────────────────
  w('## 18. UI/UX + API Mapping per Screen');
  w('');
  const screens = [
    ['Account Center', '/avito/accounts', 'GET /api/avito/accounts', 'AvitoAccountDetailReadModel', 'Manage linked accounts, sync'],
    ['Analytics Center', '/avito/analytics', 'GET /api/avito/analytics/*', 'stats/v1 + MetricsWarehouse', 'Tabs: summary, ads, regional'],
    ['Listing Generator', '/avito/listing', 'POST /api/avito/listing/generate', 'AI pipeline 8 steps', 'Not direct Avito publish'],
    ['Regional Publishing', '/avito/regional', 'POST /api/avito/regional/publish', 'RegionalDraftReadModel', 'Draft + autoload export'],
    ['Knowledge Base', '/avito/knowledge', '/api/avito/knowledge/*', 'S3 + chunks', 'RAG for agent'],
    ['Notifications', '/avito/notifications', '/api/avito/notifications/*', 'NotificationChannelReadModel', 'Channel config'],
    ['Inbox', '/chats', '/api/commerce/inbox/*', 'messenger + ConversationReadModel', '3-column workspace'],
    ['Ads Workspace', '/ads', '/api/ads', 'AdReadModel + events', 'Virtual scroll list'],
    ['Dashboard', '/', 'aggregate APIs', 'multiple', 'Executive KPIs'],
    ['Settings Avito', '/settings/avito', 'NEW', 'vault + plugin', 'OAuth + webhooks'],
    ['Feed Manager', '/avito/feeds', 'NEW', 'autoload/v4', 'Not built'],
    ['Promotion Center', '/avito/promotion', 'NEW', 'promotion API', 'Not built'],
  ];
  w('| Screen | Route | NEEKLO API | Avito API | Purpose |');
  w('| --- | --- | --- | --- | --- |');
  for (const s of screens) w(`| ${s[0]} | ${s[1]} | ${s[2]} | ${s[3]} | ${s[4]} |`);
  w('');
  w('Each screen requires (before implementation):');
  w('- UI Specification (layout, states, empty/error/loading)');
  w('- UX Specification (flows, keyboard, a11y)');
  w('- API Mapping table');
  w('- Mermaid sequence diagram');
  w('- Use cases + edge cases');
  w('');
  w('Detailed per-screen specs: see **Appendix D**.');
  w('');
  w('---');
  w('');

  // ─── 19 ARCHITECTURE ────────────────────────────────────────
  w('## 19. NEEKLO Architecture Mapping');
  w('');
  w('```mermaid');
  w('flowchart TB');
  w('  subgraph UI["apps/web /avito/*"]');
  w('    PAGES[Pages]');
  w('  end');
  w('  subgraph API["apps/api/modules/avito"]');
  w('    CTRL[AvitoController]');
  w('  end');
  w('  subgraph Platform["platform/avito/*"]');
  w('    SVC[14 Services]');
  w('  end');
  w('  subgraph Plugin["plugins/avito"]');
  w('    PLG[AvitoMarketplacePlugin]');
  w('  end');
  w('  subgraph AvitoAPI["api.avito.ru"]');
  w('    REST[REST + OAuth]');
  w('  end');
  w('  subgraph Core["Stage 1-3"]');
  w('    ES[Event Store]');
  w('    EB[Event Bus]');
  w('    INT[Intelligence]');
  w('  end');
  w('  PAGES --> CTRL --> SVC --> PLG --> REST');
  w('  SVC --> ES');
  w('  SVC --> INT');
  w('  EB --> SVC');
  w('```');
  w('');
  w('| Stage | Reuse for Avito |');
  w('| --- | --- |');
  w('| 0.1 Event Store | avito.* event catalog |');
  w('| 0.2 Marketplace SDK | Plugin capabilities |');
  w('| 0.3 Intelligence | Forecast, Regional, Recommendations |');
  w('| 0.4 Commerce | Inbox, Deals, Budget, Agent |');
  w('| 0.5 AI Platform | Listing Generator, Sales Agent |');
  w('| 0.6 Avito Enterprise | platform/avito/* |');
  w('| 0.7 Professional Workspace | Dashboard, Copilot, Command Palette |');
  w('');
  w('---');
  w('');

  // ─── 20 ROADMAP ─────────────────────────────────────────────
  w('## 20. Final Audit + Roadmap Avito Complete');
  w('');
  w('### 20.1. Compliance audit');
  w('');
  w('| Check | Result |');
  w('| --- | --- |');
  w('| Every feature mapped to official API or marked unavailable | ✔ |');
  w('| No fake REST publish | ✔ — Autoload path documented |');
  w('| Messenger tariff warning | ✔ |');
  w('| Competitors marked unavailable | ✔ |');
  w('| Webhook signature TODO flagged | ✔ — must implement before prod webhooks |');
  w('| Architecture reuses Stage 1-7 | ✔ |');
  w('');
  w('### 20.2. Roadmap Avito Complete');
  w('');
  w('| Phase | Feature | Status | Depends on |');
  w('| --- | --- | --- | --- |');
  w('| A1 | Fix TypeScript + build | 🟡 | — |');
  w('| A2 | OAuth authorization_code + vault | 🔴 | ADR Stage 4 |');
  w('| A3 | Webhook ingress + signature | 🔴 | HTTPS integrator.neeklo.ru |');
  w('| A4 | Messenger v2/v3 full (list/read) | 🟡 | Tariff |');
  w('| A5 | Autoload Feed Manager v4 | 🔴 | autoload API |');
  w('| A6 | Settings screen | 🔴 | A2 |');
  w('| A7 | Promotion Center | 🔴 | promotion API |');
  w('| A8 | Image messages | 🔴 | messenger API |');
  w('| A9 | Wallet/operations auto-sync | 🔴 | user API |');
  w('| A10 | Competitor module (manual) | 🔴 | No API |');
  w('| B1 | Account Center | ✔ | client_credentials |');
  w('| B2 | Stats sync | ✔ | stats:read |');
  w('| B3 | Send message | ✔ | messenger:write |');
  w('| B4 | Listing Generator AI | ✔ | AI platform |');
  w('| B5 | Regional drafts | ✔ | local |');
  w('| B6 | Inbox UI | ✔ | commerce |');
  w('| B7 | Analytics UI | ✔ | projections |');
  w('| B8 | KB + RAG | ✔ | S3 |');
  w('| B9 | Budget CSV import | ✔ | local |');
  w('| B10 | AI Agent reply | ✔ | gateway |');
  w('');
  w('### 20.3. Production deployment (integrator.neeklo.ru)');
  w('');
  w('| Item | Value |');
  w('| --- | --- |');
  w('| Server | root@212.67.9.173 |');
  w('| App path | /opt/neeklo-integrator |');
  w('| API port | 127.0.0.1:3022 |');
  w('| Webhook URL | https://integrator.neeklo.ru/api/webhooks/avito |');
  w('| OAuth callback | https://integrator.neeklo.ru/oauth/avito/callback |');
  w('| Demo login | owner@neeklo.dev (change in prod) |');
  w('');
  w('---');
  w('');

  // ─── APPENDIX A ─────────────────────────────────────────────
  w('## Appendix A: Full Endpoint Catalog');
  w('');
  w(`Total: **${endpoints.length}** operations across **${sections.length}** sections.`);
  w('');
  w('| # | Section | Method | Path | operationId | Summary | Deprecated |');
  w('| ---: | --- | --- | --- | --- | --- | --- |');
  endpoints.forEach((ep, i) => {
    w(
      `| ${i + 1} | ${ep.slug} | ${ep.method} | \`${ep.path}\` | \`${ep.operationId}\` | ${esc(ep.summary)} | ${ep.deprecated ? 'yes' : ''} |`,
    );
  });
  w('');
  w('---');
  w('');

  // ─── APPENDIX B SCOPES ──────────────────────────────────────
  w('## Appendix B: OAuth Scopes');
  w('');
  const allScopes = new Map();
  for (const s of sections) {
    for (const [k, v] of Object.entries(s.scopes)) allScopes.set(k, v);
  }
  w('| Scope | Description | Required for |');
  w('| --- | --- | --- |');
  for (const [k, v] of allScopes) w(`| \`${k}\` | ${esc(v)} | See capability matrix |`);
  w('');
  w('---');
  w('');

  // ─── APPENDIX C ERRORS ──────────────────────────────────────
  w('## Appendix C: Errors & Rate Limits');
  w('');
  w('### Standard HTTP errors (Avito API)');
  w('');
  w('| Code | Meaning | Action |');
  w('| --- | --- | --- |');
  w('| 400 | Bad request / validation | Show field errors |');
  w('| 401 | Unauthorized | Refresh token or reauth |');
  w('| 402 | Payment required / subscription | Show tariff upgrade CTA |');
  w('| 403 | Forbidden / expired token | Reauth |');
  w('| 404 | Not found | Check path version (v1 vs v2) |');
  w('| 429 | Rate limited | Backoff using X-RateLimit-Remaining |');
  w('| 500 | Server error | Retry with exponential backoff |');
  w('');
  w('### Rate limit headers (when present)');
  w('');
  w('| Header | Description |');
  w('| --- | --- |');
  w('| X-RateLimit-Limit | Requests per minute |');
  w('| X-RateLimit-Remaining | Remaining in window |');
  w('');
  w('---');
  w('');

  // ─── APPENDIX D SCREENS ─────────────────────────────────────
  w('## Appendix D: Screen Specifications');
  w('');
  for (const s of screens) {
    w(`### D.${screens.indexOf(s) + 1}. ${s[0]}`);
    w('');
    w(`- **Route:** \`${s[1]}\``);
    w(`- **NEEKLO API:** \`${s[2]}\``);
    w(`- **Avito grounding:** ${s[3]}`);
    w(`- **Purpose:** ${s[4]}`);
    w('');
    w('#### UI States');
    w('');
    w('| State | Behavior |');
    w('| --- | --- |');
    w('| Loading | Skeleton matching page layout |');
    w('| Empty | Calm empty state with next action CTA |');
    w('| Error | ApiError code + retry button |');
    w('| Degraded | Avito not configured — local-only mode banner |');
    w('');
    w('#### Edge Cases');
    w('');
    w('- 402 subscription: block messenger actions, show tariff info');
    w('- Token expired mid-session: silent refresh or redirect to settings');
    w('- Rate limit 429: queue job, notify user');
    w('');
    w('---');
    w('');
  }

  appendExtendedScreenSpecs(w, esc);
  appendVerticalAppendices(w, esc, sections);
  appendGlossary(w);

  w('## Document End');
  w('');
  w('> Generated from official Avito OpenAPI specs via `scripts/generate-avito-spec.mjs`');
  w(`> ${endpoints.length} endpoints | ${sections.length} sections | ${new Date().toISOString().slice(0, 10)}`);
  w('');
  w('**Next step:** Review and approve this specification before implementation.');
}

function appendExtendedScreenSpecs(w, esc) {
  w('');
  w('---');
  w('');
  w('## Appendix E: Extended UI/UX Specifications');
  w('');
  w('> Полные спецификации экранов для команды реализации Release Avito Complete.');
  w('');

  const extendedScreens = [
    {
      name: 'Account Center',
      route: '/avito/accounts',
      api: '/api/avito/accounts, POST /api/avito/accounts/:id/sync',
      avito: 'GET /core/v1/accounts/self, sync orchestrator',
      layout: 'PageHeader + table of accounts + detail drawer',
      components: ['AccountTable', 'SyncStatusBadge', 'SyncHistoryTimeline', 'ConnectButton'],
      useCases: [
        'UC-ACC-01: Owner views all linked Avito accounts for tenant',
        'UC-ACC-02: Manager triggers manual sync for one account',
        'UC-ACC-03: System shows last sync error with correlationId',
        'UC-ACC-04: User connects new account via OAuth (future)',
      ],
      edgeCases: [
        'Avito credentials missing → degraded mode banner',
        'Sync returns limited → explain autoload not configured',
        'Multiple accounts → company key vs employee key warning',
      ],
    },
    {
      name: 'Analytics Center',
      route: '/avito/analytics',
      api: 'GET /api/avito/analytics/summary, /ads/:id, /regional',
      avito: 'POST /stats/v1/accounts/{user_id}/items',
      layout: 'Tabs: Overview | Ads | Regional + Recharts',
      components: ['SummaryCards', 'AdStatsChart', 'RegionalTable', 'PeriodPicker'],
      useCases: [
        'UC-ANA-01: View daily views/contacts/favorites for date range',
        'UC-ANA-02: Compare ads by CTR',
        'UC-ANA-03: Drill into single ad stats',
      ],
      edgeCases: [
        'itemIds batch > limit → chunk requests',
        'No externalId on ad → show local metrics only',
        'stats:read scope missing → permission error',
      ],
    },
    {
      name: 'Listing Generator',
      route: '/avito/listing',
      api: 'POST /api/avito/listing/generate, GET pipelines',
      avito: 'None direct — output → Autoload XML',
      layout: 'Input panel + 8-step pipeline stepper + output preview',
      components: ['ProductInput', 'PipelineStepper', 'QualityScore', 'ExportButton'],
      useCases: [
        'UC-LST-01: Enter product description → run AI pipeline',
        'UC-LST-02: Review each step output before final',
        'UC-LST-03: Save as local ad draft',
        'UC-LST-04: Export to Autoload feed',
      ],
      edgeCases: [
        'OpenRouter unavailable → step fails gracefully',
        'Rate limit on AI → queue job',
        'Category unknown → prompt user to select',
      ],
    },
    {
      name: 'Regional Publishing',
      route: '/avito/regional',
      api: 'POST /api/avito/regional/publish, GET drafts',
      avito: 'Autoload multi-item feed (no single regional API)',
      layout: 'Source ad picker + region multi-select + batch preview table',
      components: ['RegionPicker', 'DraftBatchTable', 'PublishModeSelector', 'ExportXml'],
      useCases: [
        'UC-REG-01: Select source ad and target regions',
        'UC-REG-02: AI generates localized title/price per region',
        'UC-REG-03: User reviews batch before export',
        'UC-REG-04: Export Autoload XML for upload',
      ],
      edgeCases: [
        'User expects one-click publish → show honest modal about Autoload',
        '100+ regions → async job + progress',
      ],
    },
    {
      name: 'Knowledge Base',
      route: '/avito/knowledge',
      api: 'GET/POST /api/avito/knowledge, search',
      avito: 'None — NEEKLO S3 storage',
      layout: 'Document list + upload dropzone + search',
      components: ['DocTable', 'UploadZone', 'CategoryFilter', 'ChunkIndicator'],
      useCases: [
        'UC-KB-01: Upload PDF/DOCX policy document',
        'UC-KB-02: Search chunks for Sales Agent RAG',
        'UC-KB-03: Re-index document after edit',
      ],
      edgeCases: [
        'Large file → size limit + S3 multipart',
        'No embeddings yet → keyword search fallback',
      ],
    },
    {
      name: 'Unified Inbox',
      route: '/chats',
      api: '/api/commerce/inbox/*, POST /api/avito/agent/reply',
      avito: 'messenger v2 chats, v3 messages, v1 send',
      layout: '3-column: list | thread | context panel',
      components: ['ConversationList', 'MessageThread', 'Customer360', 'AiDraftBar'],
      useCases: [
        'UC-INB-01: List unread conversations sorted by lastMessageAt',
        'UC-INB-02: Send reply to customer',
        'UC-INB-03: AI draft → edit → send',
        'UC-INB-04: Pin conversation',
        'UC-INB-05: AI agent auto-reply with confidence gate',
      ],
      edgeCases: [
        '402 messenger tariff → block send, show upgrade',
        'Webhook delay → show polling indicator',
        'Mobile → stack columns, drawer for context',
      ],
    },
    {
      name: 'Ads Workspace',
      route: '/ads',
      api: '/api/ads, /api/ads/:id',
      avito: 'items:info (enrichment), autoload (publish)',
      layout: 'Virtual list + detail studio panel',
      components: ['VirtualAdList', 'AdStudioPanel', 'FilterBar', 'BulkActionBar'],
      useCases: [
        'UC-ADS-01: Scroll 10k+ ads with virtual list',
        'UC-ADS-02: Change price → AdPriceChanged event',
        'UC-ADS-03: Archive ad',
        'UC-ADS-04: Open in Listing Generator',
      ],
      edgeCases: [
        'Optimistic update failure → rollback + toast',
        'externalId missing → badge «Не синхронизировано»',
      ],
    },
    {
      name: 'Avito Settings',
      route: '/settings/avito',
      api: 'NEW: /api/avito/settings, /api/avito/oauth/*',
      avito: 'POST /token, postWebhookV3',
      layout: 'Sectioned form with status sidebar',
      components: ['CredentialForm', 'WebhookConfig', 'ScopeChecklist', 'TestConnection', 'ApiLogTable'],
      useCases: [
        'UC-SET-01: Configure client_credentials',
        'UC-SET-02: Complete OAuth for multi-user app',
        'UC-SET-03: Register webhook URL',
        'UC-SET-04: Test connection',
        'UC-SET-05: View API error log',
      ],
      edgeCases: [
        'Secret rotation → invalidate cached token',
        'Webhook URL must be HTTPS',
      ],
    },
    {
      name: 'Feed Manager',
      route: '/avito/feeds',
      api: 'NEW: /api/avito/autoload/*',
      avito: 'autoload/v4/uploads, reports',
      layout: 'Feed list + upload wizard + report viewer',
      components: ['FeedList', 'UploadWizard', 'ValidationReport', 'ScheduleCron'],
      useCases: [
        'UC-FED-01: Upload XML feed',
        'UC-FED-02: View upload report errors',
        'UC-FED-03: Schedule recurring sync',
        'UC-FED-04: Preview XML before upload',
      ],
      edgeCases: [
        'Invalid XML schema → line-level errors',
        'Partial success in report → highlight failed items',
      ],
    },
    {
      name: 'Promotion Center',
      route: '/avito/promotion',
      api: 'NEW: /api/avito/promotion/*',
      avito: 'promotion, cpxpromo, trxpromo APIs',
      layout: 'Ad selector + VAS catalog + apply confirmation',
      components: ['VasCatalog', 'ApplyVasModal', 'PromotionHistory'],
      useCases: [
        'UC-PRO-01: List available VAS for item',
        'UC-PRO-02: Apply XL/Premium to ad',
        'UC-PRO-03: View promotion spend',
      ],
      edgeCases: [
        'items:apply_vas scope required',
        'Insufficient balance → user_balance API',
      ],
    },
    {
      name: 'AI Cost / Agent Settings',
      route: '/ai/assistant, /ai/cost',
      api: '/api/ai/*, /api/avito/agent/reply',
      avito: 'messenger:write only for send',
      layout: 'Agent toggles + cost charts',
      components: ['AgentToggle', 'WorkingHours', 'MaxDiscount', 'CostChart'],
      useCases: [
        'UC-AI-01: Enable/disable sales agent per tenant',
        'UC-AI-02: Configure handoff rules',
        'UC-AI-03: Monitor AI spend',
      ],
      edgeCases: [
        'Agent sends during off-hours → queue for morning',
        'Discount exceeds max → require manager approval',
      ],
    },
    {
      name: 'Budget / Expenses',
      route: '/budget',
      api: '/api/commerce/budget, /api/avito/budget/import',
      avito: 'user_operations (future), manual CSV',
      layout: 'Summary cards + import + region breakdown',
      components: ['BudgetSummary', 'ImportCsv', 'RegionBreakdown'],
      useCases: [
        'UC-BUD-01: Import CSV expenses',
        'UC-BUD-02: View ROI/ROAS from MetricsEngine',
        'UC-BUD-03: Auto-sync wallet operations (future)',
      ],
      edgeCases: [
        'Duplicate import rows → idempotent by hash',
        'Missing Avito spend data → manual only label',
      ],
    },
  ];

  for (const screen of extendedScreens) {
    w(`### E.${extendedScreens.indexOf(screen) + 1} ${screen.name}`);
    w('');
    w('| Property | Value |');
    w('| --- | --- |');
    w(`| Route | \`${screen.route}\` |`);
    w(`| NEEKLO API | ${esc(screen.api)} |`);
    w(`| Avito API | ${esc(screen.avito)} |`);
    w(`| Layout | ${esc(screen.layout)} |`);
    w(`| Components | ${screen.components.map((c) => `\`${c}\``).join(', ')} |`);
    w('');
    w('#### Use Cases');
    w('');
    for (const uc of screen.useCases) w(`- ${uc}`);
    w('');
    w('#### Edge Cases');
    w('');
    for (const ec of screen.edgeCases) w(`- ${ec}`);
    w('');
    w('#### Sequence Diagram');
    w('');
    w('```mermaid');
    w('sequenceDiagram');
    w('  participant U as User');
    w('  participant UI as Web UI');
    w('  participant API as NEEKLO API');
    w('  participant AV as api.avito.ru');
    w('  U->>UI: Open ' + screen.name);
    w('  UI->>API: Fetch data');
    w('  API->>AV: Official API call (if applicable)');
    w('  AV-->>API: Response');
    w('  API-->>UI: DTO');
    w('  UI-->>U: Render');
    w('```');
    w('');
    w('#### UI States Table');
    w('');
    w('| State | Visual | Action |');
    w('| --- | --- | --- |');
    w('| loading | Skeleton | — |');
    w('| empty | Icon + hint + CTA | Primary action |');
    w('| error | Inline alert | Retry |');
    w('| degraded | Yellow banner | Link to Settings |');
    w('| success | Data view | — |');
    w('');
    w('#### Accessibility');
    w('');
    w('- Keyboard navigation for tables and dialogs');
    w('- Focus trap in modals');
    w('- aria-live for new messages (inbox)');
    w('- Color contrast per oklch design tokens');
    w('');
    w('---');
    w('');
  }
}

function appendVerticalAppendices(w, esc, sections) {
  w('## Appendix F: Vertical-Specific Avito APIs');
  w('');
  w('> Секции API, не входящие в MVP Avito Complete, но доступные официально.');
  w('');

  const verticals = [
    { slug: 'job', note: 'Вакансии и резюме — scopes job:*' },
    { slug: 'str', note: 'Краткосрочная аренда — scopes short_term_rent:*' },
    { slug: 'delivery-sandbox', note: 'Sandbox только для логистики' },
    { slug: 'order-management', note: 'B2C продавцы — управление заказами доставки' },
    { slug: 'realty-reports', note: 'Аналитика недвижимости' },
    { slug: 'calltracking', note: 'Колл-трекинг' },
    { slug: 'autoteka', note: 'Проверка авто' },
    { slug: 'tariff', note: 'Тарифы транспорт' },
    { slug: 'ads', note: 'Авито Реклама кабинет' },
    { slug: 'avito-promo', note: 'Avito Promo агентства' },
    { slug: 'sbc-gateway', note: 'Beta — рассылка скидок в messenger' },
  ];

  for (const v of verticals) {
    const s = sections.find((x) => x.slug === v.slug);
    if (!s) continue;
    w(`### F.${verticals.indexOf(v) + 1} ${esc(s.title)} (\`${v.slug}\`)`);
    w('');
    w(`> ${v.note}`);
    w('');
    w('| Method | Path | Summary |');
    w('| --- | --- | --- |');
    for (const ep of s.endpoints) {
      w(`| ${ep.method} | \`${ep.path}\` | ${esc(ep.summary)} |`);
    }
    w('');
    w('**NEEKLO status:** Out of scope for Avito Complete MVP unless tenant vertical requires it.');
    w('');
    w('---');
    w('');
  }
}

function appendGlossary(w) {
  w('## Appendix G: Glossary & References');
  w('');
  w('| Term | Definition |');
  w('| --- | --- |');
  w('| Autoload | Avito bulk listing upload via XML/feed files |');
  w('| VAS | Value Added Service — paid promotion (XL, Premium, etc.) |');
  w('| client_credentials | OAuth flow for own Avito Pro account |');
  w('| authorization_code | OAuth flow for accessing other users data |');
  w('| Item | Avito listing/ad |');
  w('| Feed | Autoload upload file (usually XML) |');
  w('| Scope | OAuth permission string |');
  w('| Webhook | HTTPS callback from Avito messenger |');
  w('| Projection | NEEKLO read model rebuilt from events |');
  w('| Credential Vault | Planned encrypted per-tenant token storage |');
  w('');
  w('### Official links');
  w('');
  w('- [Портал разработчика Авито](https://developers.avito.ru/)');
  w('- [Каталог API](https://developers.avito.ru/api-catalog)');
  w('- [Регистрация приложения](https://developers.avito.ru/applications)');
  w('- [API keys (личный кабинет)](https://www.avito.ru/professionals/api)');
  w('- [Условия использования API](https://www.avito.ru/legal/pro_tools/public-api)');
  w('- [OpenAPI 3.0 Specification](https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.0.md)');
  w('- Support: supportautoload@avito.ru, 8 800 600-00-01');
  w('');
  w('### NEEKLO internal docs');
  w('');
  w('- `docs/avito-platform.md` — Release 0.6 architecture');
  w('- `docs/decision-records.md` — ADR + gap analysis');
  w('- `docs/architecture.md` — Stage 1–3 platform');
  w('- `deploy/README.md` — integrator.neeklo.ru deployment');
  w('');
  w('---');
  w('');
  w('## Appendix H: Terms of Service Compliance Checklist');
  w('');
  w('| Rule | NEEKLO compliance |');
  w('| --- | --- |');
  w('| Use only official API | ✔ — no scraping in product spec |');
  w('| Respect rate limits | ✔ — backoff + header tracking planned |');
  w('| Paid tariff for Messenger | ✔ — disclosed in UI |');
  w('| Secure credential storage | 🟡 — vault planned |');
  w('| Webhook signature verification | 🟡 — must implement before prod |');
  w('| No competitor scraping | ✔ — marked unavailable |');
  w('| User consent for OAuth scopes | ✔ — minimal scope principle |');
  w('');
}

