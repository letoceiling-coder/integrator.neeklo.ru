# Monitoring

API: `GET /api/avito/production/monitor?accountId=`

Metrics from `AvitoLiveRequestLogReadModel` and sync workers:

- Errors / latency / retries / 429  
- Webhook failures  
- Sync lag  
- Queue depth  
- Worker status  

Realtime: `GET /api/avito/production/events` (SSE) — webhook events pushed to UI.
