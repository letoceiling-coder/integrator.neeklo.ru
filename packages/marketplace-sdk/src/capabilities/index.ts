import type { MarketplaceContext } from '../types/common';

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  tokenType: string;
  scope?: string[];
}

export interface MarketplaceIdentity {
  /** Exchange credentials for tokens. */
  authorize(ctx: MarketplaceContext, credentials: OAuthCredentials): Promise<TokenSet>;
  refresh(ctx: MarketplaceContext, refreshToken: string): Promise<TokenSet>;
  revoke(ctx: MarketplaceContext): Promise<void>;
  /** Validate current authorization state. */
  validate(ctx: MarketplaceContext): Promise<{ valid: boolean; expiresAt?: string }>;
}

export interface MarketplaceAccountInfo {
  externalAccountId: string;
  displayName: string;
  email?: string;
  phone?: string;
  profileUrl?: string;
  verified: boolean;
}

export interface MarketplaceAccount {
  getInfo(ctx: MarketplaceContext): Promise<MarketplaceAccountInfo>;
  getLimits(ctx: MarketplaceContext): Promise<Record<string, number>>;
}

export interface MarketplaceCapabilities {
  list(ctx: MarketplaceContext): Promise<string[]>;
  has(ctx: MarketplaceContext, capability: string): Promise<boolean>;
}

export interface MediaAsset {
  id: string;
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
}

export interface MarketplaceMedia {
  upload(ctx: MarketplaceContext, file: Buffer, mimeType: string): Promise<MediaAsset>;
  delete(ctx: MarketplaceContext, mediaId: string): Promise<void>;
  get(ctx: MarketplaceContext, mediaId: string): Promise<MediaAsset | null>;
}

export interface OutboundMessage {
  conversationId: string;
  text: string;
  attachments?: string[];
}

export interface InboundMessage {
  conversationId: string;
  customerId: string;
  text: string;
  attachments: string[];
  receivedAt: string;
  externalAdId?: string;
}

export interface MarketplaceMessaging {
  send(ctx: MarketplaceContext, message: OutboundMessage): Promise<void>;
  listConversations(ctx: MarketplaceContext, pagination?: { cursor?: string; limit?: number }): Promise<{
    items: { id: string; customerId: string; lastMessageAt: string }[];
    nextCursor: string | null;
  }>;
}

export interface AnalyticsDataPoint {
  date: string;
  metrics: Record<string, number>;
}

export interface MarketplaceAnalytics {
  query(ctx: MarketplaceContext, query: { metric: string; range: { from: string; to: string } }): Promise<AnalyticsDataPoint[]>;
}

export interface MarketplaceOrder {
  externalId: string;
  status: string;
  amount: { amount: number; currency: string };
  customerId: string;
  createdAt: string;
}

export interface MarketplaceOrders {
  list(ctx: MarketplaceContext, range?: { from: string; to: string }): Promise<MarketplaceOrder[]>;
  get(ctx: MarketplaceContext, orderId: string): Promise<MarketplaceOrder | null>;
}

export interface MarketplaceNotification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

export interface MarketplaceNotifications {
  subscribe(ctx: MarketplaceContext, webhookUrl: string): Promise<{ subscriptionId: string }>;
  unsubscribe(ctx: MarketplaceContext, subscriptionId: string): Promise<void>;
}

export interface PromotionRequest {
  externalAdId: string;
  kind: string;
  durationHours?: number;
}

export interface PromotionResult {
  activated: boolean;
  cost: { amount: number; currency: string };
  expiresAt: string | null;
}

export interface MarketplacePromotion {
  activate(ctx: MarketplaceContext, request: PromotionRequest): Promise<PromotionResult>;
  listAvailable(ctx: MarketplaceContext): Promise<{ kind: string; label: string; costFrom: number }[]>;
}

export interface PublishListingInput {
  title: string;
  description: string;
  categoryId: string;
  price: { amount: number; currency: string };
  regionId: string;
  cityId: string;
  photoUrls: string[];
  attributes: Record<string, string | number | boolean>;
}

export interface PublishListingResult {
  externalId: string;
  url: string | null;
  publishedAt: string;
}

export interface MarketplacePublication {
  publish(ctx: MarketplaceContext, input: PublishListingInput): Promise<PublishListingResult>;
  update(ctx: MarketplaceContext, externalId: string, patch: Partial<PublishListingInput>): Promise<void>;
  archive(ctx: MarketplaceContext, externalId: string): Promise<void>;
  restore(ctx: MarketplaceContext, externalId: string): Promise<void>;
}

export interface StatsPoint {
  date: string;
  views: number;
  contacts: number;
  favorites: number;
}

export interface MarketplaceStatistics {
  fetchAdStats(
    ctx: MarketplaceContext,
    externalAdId: string,
    range: { from: string; to: string },
  ): Promise<StatsPoint[]>;
  fetchAccountStats(ctx: MarketplaceContext, range: { from: string; to: string }): Promise<Record<string, number>>;
}

export interface SearchQuery {
  query?: string;
  categoryId?: string;
  regionId?: string;
  priceMin?: number;
  priceMax?: number;
  cursor?: string;
  limit?: number;
}

export interface SearchResultItem {
  externalId: string;
  title: string;
  price: { amount: number; currency: string };
  url: string | null;
}

export interface MarketplaceSearch {
  search(ctx: MarketplaceContext, query: SearchQuery): Promise<{ items: SearchResultItem[]; nextCursor: string | null }>;
}

export interface CatalogItem {
  id: string;
  name: string;
  parentId: string | null;
  attributes: string[];
}

export interface MarketplaceCatalog {
  listProducts(ctx: MarketplaceContext): Promise<CatalogItem[]>;
}

export interface StoredFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MarketplaceFiles {
  upload(ctx: MarketplaceContext, name: string, content: Buffer): Promise<StoredFile>;
  download(ctx: MarketplaceContext, fileId: string): Promise<Buffer>;
  delete(ctx: MarketplaceContext, fileId: string): Promise<void>;
}

export type ModerationStatus = 'pending' | 'approved' | 'rejected';

export interface ModerationResult {
  status: ModerationStatus;
  reason: string | null;
  checkedAt: string;
}

export interface MarketplaceModeration {
  check(ctx: MarketplaceContext, externalAdId: string): Promise<ModerationResult>;
  submitForReview(ctx: MarketplaceContext, externalAdId: string): Promise<void>;
}

export interface NormalizedWebhookEvent {
  kind: 'message' | 'view' | 'contact' | 'status' | 'favorite' | 'order' | 'moderation';
  externalAdId?: string;
  conversationId?: string;
  customerId?: string;
  text?: string;
  occurredAt: string;
  raw: unknown;
}

export interface MarketplaceWebhooks {
  parse(body: unknown, headers: Record<string, string>): NormalizedWebhookEvent[];
  verifySignature(body: unknown, headers: Record<string, string>, secret: string): boolean;
}

export interface PriceRecommendation {
  suggested: { amount: number; currency: string };
  confidence: number;
  reason: string;
}

export interface MarketplacePricing {
  recommend(ctx: MarketplaceContext, externalAdId: string): Promise<PriceRecommendation>;
  getRules(ctx: MarketplaceContext, categoryId: string): Promise<Record<string, unknown>>;
}

export interface RegionNode {
  id: string;
  name: string;
  parentId: string | null;
  type: 'country' | 'region' | 'city' | 'district';
}

export interface MarketplaceRegions {
  list(ctx: MarketplaceContext, parentId?: string): Promise<RegionNode[]>;
  resolve(ctx: MarketplaceContext, regionId: string): Promise<RegionNode | null>;
}

export interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  attributeSchema: Record<string, unknown>;
}

export interface MarketplaceCategories {
  list(ctx: MarketplaceContext, parentId?: string): Promise<CategoryNode[]>;
  get(ctx: MarketplaceContext, categoryId: string): Promise<CategoryNode | null>;
}

export interface AttributeDefinition {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  required: boolean;
  options?: string[];
}

export interface MarketplaceAttributes {
  listForCategory(ctx: MarketplaceContext, categoryId: string): Promise<AttributeDefinition[]>;
}

export interface AiListingSuggestion {
  title: string;
  description: string;
  keywords: string[];
  score: number;
}

export interface MarketplaceAI {
  suggestListing(ctx: MarketplaceContext, productData: Record<string, unknown>): Promise<AiListingSuggestion>;
  scoreListing(ctx: MarketplaceContext, externalAdId: string): Promise<{ score: number; factors: Record<string, number> }>;
}

export interface CompetitorListing {
  externalId: string;
  title: string;
  price: { amount: number; currency: string };
  sellerId: string;
  url: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface MarketplaceCompetitors {
  track(ctx: MarketplaceContext, externalAdId: string, competitorIds: string[]): Promise<void>;
  list(ctx: MarketplaceContext, externalAdId: string): Promise<CompetitorListing[]>;
  changes(ctx: MarketplaceContext, externalAdId: string, since: string): Promise<{ type: string; at: string; details: Record<string, unknown> }[]>;
}

export interface BudgetAllocation {
  category: string;
  amount: { amount: number; currency: string };
  period: 'daily' | 'weekly' | 'monthly';
}

export interface MarketplaceBudget {
  getSpent(ctx: MarketplaceContext, range: { from: string; to: string }): Promise<{ amount: number; currency: string }>;
  setLimit(ctx: MarketplaceContext, allocation: BudgetAllocation): Promise<void>;
}

export interface AutomationRule {
  id: string;
  trigger: string;
  action: string;
  enabled: boolean;
}

export interface MarketplaceAutomation {
  listRules(ctx: MarketplaceContext): Promise<AutomationRule[]>;
  enable(ctx: MarketplaceContext, ruleId: string): Promise<void>;
  disable(ctx: MarketplaceContext, ruleId: string): Promise<void>;
}

export interface ReportDefinition {
  id: string;
  name: string;
  metrics: string[];
}

export interface MarketplaceReports {
  list(ctx: MarketplaceContext): Promise<ReportDefinition[]>;
  generate(ctx: MarketplaceContext, reportId: string, range: { from: string; to: string }): Promise<Record<string, unknown>>;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  checks: { name: string; ok: boolean; message?: string }[];
  checkedAt: string;
}

export interface MarketplaceHealth {
  check(ctx: MarketplaceContext): Promise<HealthStatus>;
}

export type SyncOperation = 'create' | 'update' | 'delete' | 'restore' | 'skip' | 'conflict';

export interface SyncChange {
  operation: SyncOperation;
  entityType: string;
  entityId: string;
  externalId?: string;
  payload?: Record<string, unknown>;
  conflictReason?: string;
}

export interface SyncResult {
  startedAt: string;
  completedAt: string;
  created: number;
  updated: number;
  deleted: number;
  restored: number;
  skipped: number;
  conflicts: SyncChange[];
  errors: { entityId: string; message: string }[];
}

export interface MarketplaceSync {
  pull(ctx: MarketplaceContext, since?: string): Promise<SyncChange[]>;
  push(ctx: MarketplaceContext, changes: SyncChange[]): Promise<SyncResult>;
  reconcile(ctx: MarketplaceContext): Promise<SyncResult>;
}

export interface ScheduledTask {
  id: string;
  cron: string;
  action: string;
  enabled: boolean;
}

export interface MarketplaceScheduler {
  list(ctx: MarketplaceContext): Promise<ScheduledTask[]>;
  schedule(ctx: MarketplaceContext, task: Omit<ScheduledTask, 'id'>): Promise<ScheduledTask>;
  cancel(ctx: MarketplaceContext, taskId: string): Promise<void>;
}

export interface TelemetryEvent {
  name: string;
  value: number;
  tags: Record<string, string>;
  at: string;
}

export interface MarketplaceTelemetry {
  emit(ctx: MarketplaceContext, events: TelemetryEvent[]): Promise<void>;
}
