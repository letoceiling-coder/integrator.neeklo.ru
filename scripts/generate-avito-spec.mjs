import fs from 'node:fs';
import path from 'node:path';
import { appendProductSections } from './avito-spec-sections.mjs';

const OPENAPI_DIR = path.resolve('docs/avito-openapi');
const OUT = path.resolve('docs/AVITO_PRODUCT_SPEC.md');

const SECTION_META = {
  auth: 'Авторизация',
  item: 'Объявления',
  messenger: 'Мессенджер',
  autoload: 'Автозагрузка',
  promotion: 'Продвижение',
  user: 'Информация о пользователе',
  cpa: 'CPA Авито',
  cpxpromo: 'Настройка цены целевого действия',
  tariff: 'Тарифы',
  job: 'Авито.Работа',
  'stock-management': 'Управление остатками',
  ratings: 'Рейтинги и отзывы',
  'accounts-hierarchy': 'Иерархия аккаунтов',
  'order-management': 'Управление заказами',
  'delivery-sandbox': 'Доставка (sandbox)',
  'realty-reports': 'Аналитика по недвижимости',
  calltracking: 'CallTracking',
  auction: 'CPA-аукцион',
  autostrategy: 'Автостратегия',
  trxpromo: 'TrxPromo',
  'sbc-gateway': 'Рассылка скидок (SBC)',
  str: 'Краткосрочная аренда',
  ads: 'Авито Реклама',
  'avito-promo': 'Авито Promo',
  autoteka: 'Автотека',
};

function parseSpec(slug) {
  const raw = JSON.parse(fs.readFileSync(path.join(OPENAPI_DIR, `${slug}.json`), 'utf8'));
  const spec =
    typeof raw.swagger === 'string'
      ? JSON.parse(raw.swagger)
      : raw.openapi
        ? raw
        : JSON.parse(raw.swagger || '{}');
  return { spec, md: raw.md || '' };
}

function esc(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\r/g, '');
}

const endpoints = [];
const sections = [];

for (const file of fs.readdirSync(OPENAPI_DIR).filter((f) => f.endsWith('.json'))) {
  const slug = file.replace('.json', '');
  const { spec, md } = parseSpec(slug);
  const title = spec.info?.title || SECTION_META[slug] || slug;
  const scopes = spec.components?.securitySchemes?.AuthorizationCode?.flows?.authorizationCode?.scopes || {};
  const rateLimitHeaders = !!spec.components?.headers?.['X-RateLimit-Limit'];
  const eps = [];

  for (const [p, item] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(item)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      const ep = {
        slug,
        section: title,
        method: method.toUpperCase(),
        path: p,
        operationId: op.operationId || '',
        summary: op.summary || '',
        description: (op.description || '').slice(0, 800),
        deprecated: !!op.deprecated,
        tags: op.tags || [],
        security: op.security || spec.security || [],
        parameters: (op.parameters || []).map((param) => ({
          name: param.name,
          in: param.in,
          required: !!param.required,
          description: param.description || '',
        })),
        requestBody: op.requestBody ? Object.keys(op.requestBody.content || {}) : [],
        responses: Object.entries(op.responses || {}).map(([code, r]) => ({
          code,
          description: r.description || '',
        })),
      };
      eps.push(ep);
      endpoints.push(ep);
    }
  }

  sections.push({ slug, title, md, scopes, rateLimitHeaders, endpoints: eps, version: spec.info?.version });
}

const lines = [];
const w = (s = '') => lines.push(s);

// ─── HEADER ───────────────────────────────────────────────────
w('# AVITO PRODUCT SPEC');
w('');
w('> **NEEKLO Marketplace OS — Avito Product Bible / Master Specification**');
w('>');
w('> | | |');
w('> | --- | --- |');
w('> | Версия | 1.0.0 |');
w('> | Дата | 2026-07-03 |');
w('> | Домен | https://integrator.neeklo.ru |');
w('> | Сервер | root@212.67.9.173 |');
w('> | API Portal | https://developers.avito.ru/api-catalog |');
w('> | OpenAPI | 3.0.0 |');
w('> | Base URL | https://api.avito.ru |');
w('> | Support | supportautoload@avito.ru, +7 495 777-10-66 |');
w('');
w('**Статус:** Product Specification — реализация только после утверждения этого документа.');
w('');
w('**Принцип:** Не придумывать функции без основания в официальной документации Avito.');
w('');
w('---');
w('');
w('## Document Control');
w('');
w('| Поле | Значение |');
w('| --- | --- |');
w(`| Официальных API-секций | ${sections.length} |`);
w(`| Задокументированных HTTP-операций | ${endpoints.length} |`);
w('| Источник endpoints | GET https://developers.avito.ru/web/1/openapi/info/{slug} |');
w('| NEEKLO Architecture | Stage 1–7 (Event Store → Avito Enterprise → Professional Workspace) |');
w('');
w('---');
w('');
w('## Table of Contents');
w('');
const toc = [
  ['1', 'Executive Summary', '1-executive-summary'],
  ['2', 'Полная карта API', '2-полная-карта-api'],
  ['3', 'OAuth, Scopes, Tokens', '3-oauth-scopes-tokens'],
  ['4', 'Матрица возможностей NEEKLO × Avito', '4-матрица-возможностей'],
  ['5', 'User Flow: Account Connection', '5-user-flow-account-connection'],
  ['6', 'Settings Screen Specification', '6-settings-screen'],
  ['7', 'Ads Management', '7-ads-management'],
  ['8', 'Ad Editor', '8-ad-editor'],
  ['9', 'Regional Publishing', '9-regional-publishing'],
  ['10', 'Autoload / Feed Manager', '10-autoload-feed-manager'],
  ['11', 'Messenger / Inbox', '11-messenger-inbox'],
  ['12', 'AI Agent', '12-ai-agent'],
  ['13', 'Notifications', '13-notifications'],
  ['14', 'Analytics', '14-analytics'],
  ['15', 'Expenses / Budget', '15-expenses-budget'],
  ['16', 'Media Studio', '16-media-studio'],
  ['17', 'Competitors', '17-competitors'],
  ['18', 'UI/UX + API Mapping per Screen', '18-ui-specifications'],
  ['19', 'NEEKLO Architecture Mapping', '19-neeklo-architecture-mapping'],
  ['20', 'Final Audit + Roadmap Avito Complete', '20-final-audit-roadmap'],
  ['A', 'Appendix: Full Endpoint Catalog', 'appendix-a-full-endpoint-catalog'],
  ['B', 'Appendix: OAuth Scopes', 'appendix-b-oauth-scopes'],
  ['C', 'Appendix: Errors & Rate Limits', 'appendix-c-errors-rate-limits'],
  ['D', 'Appendix: Screen Specifications', 'appendix-d-screen-specifications'],
];
for (const [n, title, anchor] of toc) w(`${n}. [${title}](#${anchor})`);
w('');
w('---');
w('');

// ─── 1 EXECUTIVE SUMMARY ────────────────────────────────────
w('## 1. Executive Summary');
w('');
w('### 1.1. Контекст продукта');
w('');
w('NEEKLO Marketplace OS — event-sourced операционная система для продаж на маркетплейсах.');
w('Avito — первый marketplace adapter. Продукт развёрнут на **integrator.neeklo.ru** (212.67.9.173).');
w('');
w('### 1.2. Ключевые выводы из официальной документации Avito');
w('');
w('| # | Вывод | Источник |');
w('| --- | --- | --- |');
w('| 1 | Два OAuth2 flow: `client_credentials` (личный кабинет) и `authorization_code` + `refresh_token` (приложения) | auth API |');
w('| 2 | Access token TTL = **24 часа**; refresh token TTL = **1 год** | auth API |');
w('| 3 | Messenger API требует тариф «Максимальный» (Товары/Работа) или «Расширенный/Максимальный» (Услуги) | messenger docs |');
w('| 4 | Массовая публикация объявлений — через **Autoload** (XML/feed), не единый REST CRUD | autoload API |');
w('| 5 | Item API — статистика, VAS, статусы; не полноценный CRUD для всех категорий | item API |');
w('| 6 | Stats API — uniqViews, uniqContacts, uniqFavorites по itemIds | stats in item/messenger context |');
w('| 7 | Promotion — отдельные API: promotion, cpa, cpxpromo, trxpromo, autostrategy | respective sections |');
w('| 8 | Webhooks — Messenger v3 subscribe/unsubscribe | messenger API |');
w('| 9 | Sandbox — только Delivery API | delivery-sandbox |');
w('| 10 | **Нет API для мониторинга конкурентов** | — |');
w('| 11 | Rate limits — заголовки X-RateLimit-Limit / X-RateLimit-Remaining (не все секции) | OpenAPI components |');
w('| 12 | Иерархия аккаунтов — API только для **ключей компании**, не сотрудника | accounts-hierarchy, messenger docs |');
w('');
w('### 1.3. Текущее состояние NEEKLO (Release 0.6–0.7)');
w('');
w('| Модуль | UI | API | Avito API Grounding | Статус |');
w('| --- | --- | --- | --- | --- |');
w('| Account Center | /avito/accounts | GET/POST /api/avito/accounts* | core/v1/accounts/self | ✔ |');
w('| Analytics | /avito/analytics | GET /api/avito/analytics/* | stats/v1/accounts/{id}/items | ✔ |');
w('| Listing Generator | /avito/listing | POST /api/avito/listing/generate | AI local + autoload export (planned) | 🟡 |');
w('| Regional Publishing | /avito/regional | POST /api/avito/regional/publish | Local drafts; autoload for publish | 🟡 |');
w('| Knowledge Base | /avito/knowledge | /api/avito/knowledge/* | N/A (NEEKLO S3 + RAG) | ✔ |');
w('| Inbox | /chats | /api/commerce/inbox/* | messenger/v1,v2,v3 | 🟡 partial |');
w('| AI Agent | /chats, /ai/assistant | /api/avito/agent/reply | messenger:write | 🟡 |');
w('| Notifications | /avito/notifications | /api/avito/notifications/* | webhook + external channels | 🟡 |');
w('| Autoload Feed Manager | — | — | autoload/v4/* | 🔴 |');
w('| Promotion Center | — | — | promotion/cpa/cpxpromo | 🔴 |');
w('| Ad Editor (full) | /ads | /api/ads/* | items:info + autoload | 🔴 |');
w('| Competitors | scaffold | — | **No official API** | 🔴 |');
w('');
w('---');
w('');

// ─── 2 API MAP ──────────────────────────────────────────────
w('## 2. Полная карта API');
w('');
w(`Официальный каталог [developers.avito.ru/api-catalog](https://developers.avito.ru/api-catalog) содержит **${sections.length} секций** и **${endpoints.length} HTTP-операций**.`);
w('');
w('### 2.1. Summary by section');
w('');
w('| # | Slug | Title | Operations | Rate Limit |');
w('| ---: | --- | --- | ---: | --- |');
sections
  .sort((a, b) => a.slug.localeCompare(b.slug))
  .forEach((s, i) => {
    w(`| ${i + 1} | \`${s.slug}\` | ${esc(s.title)} | ${s.endpoints.length} | ${s.rateLimitHeaders ? '✔' : '—'} |`);
  });
w('');

for (const s of sections.sort((a, b) => a.slug.localeCompare(b.slug))) {
  w(`### 2.2.${sections.sort((a, b) => a.slug.localeCompare(b.slug)).indexOf(s) + 1}. ${esc(s.title)} (\`${s.slug}\`)`);
  w('');
  if (s.md) {
    w('<details>');
    w('<summary>Official section documentation (excerpt)</summary>');
    w('');
    w(s.md.split('\n').slice(0, 40).join('\n'));
    w('');
    w('</details>');
    w('');
  }
  w('| Method | Path | operationId | Summary | Dep |');
  w('| --- | --- | --- | --- | --- |');
  for (const ep of s.endpoints) {
    w(
      `| ${ep.method} | \`${ep.path}\` | \`${ep.operationId}\` | ${esc(ep.summary)} | ${ep.deprecated ? '⚠️' : '—'} |`,
    );
  }
  w('');
  w('#### Parameters & Responses per operation');
  w('');
  for (const ep of s.endpoints) {
    w(`##### \`${ep.method} ${ep.path}\` — ${esc(ep.summary)}`);
    w('');
    if (ep.description) w(`> ${esc(ep.description)}`);
    w('');
    if (ep.parameters.length) {
      w('**Parameters:**');
      w('');
      w('| Name | In | Required | Description |');
      w('| --- | --- | --- | --- |');
      for (const p of ep.parameters) {
        w(`| \`${p.name}\` | ${p.in} | ${p.required ? 'yes' : 'no'} | ${esc(p.description)} |`);
      }
      w('');
    }
    if (ep.requestBody.length) {
      w(`**Request Body Content-Types:** ${ep.requestBody.join(', ')}`);
      w('');
    }
    if (ep.responses.length) {
      w('**Responses:**');
      w('');
      w('| Code | Description |');
      w('| --- | --- |');
      for (const r of ep.responses) {
        w(`| ${r.code} | ${esc(r.description)} |`);
      }
      w('');
    }
    w('---');
    w('');
  }
}

appendProductSections(w, esc, sections, endpoints);

fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log('Written', lines.length, 'lines to', OUT);
console.log('Endpoints:', endpoints.length);
