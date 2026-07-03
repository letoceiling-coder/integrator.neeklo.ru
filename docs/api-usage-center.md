# API Usage Center

UI: `/avito/live` → **API Usage** tab  
API: `GET /api/avito/live/usage`

## Metrics

| Metric | Description |
| --- | --- |
| requestsLastHour | Count in rolling hour |
| requestsLastDay | Count in rolling 24h |
| errors429 | Rate limit hits |
| avgLatencyMs | Mean latency |
| rateLimitRemaining | Last response header value |
| heaviestRequests | Top URLs by count + avg latency |
| recentErrors | Last 20 HTTP ≥400 |

## Logging

Every Avito Live API call writes to `AvitoLiveRequestLogReadModel`:

- `requestId` (UUID)
- `correlationId` (sync job / HTTP context)
- `worker`
- `method`, `url`, `status`, `latencyMs`
- `retryCount`
- `rateLimitRemaining`
- `responsePreview` (truncated)
- `headers` (JSON)

Service: `AvitoLiveRequestLogService`
