# Release Candidate — Phase A7 Audit

## Checklist

| Area | Status | Notes |
| --- | --- | --- |
| OAuth | ✅ | OAuth Center + live checklist probes |
| Credential Vault | ✅ | Token resolve via Vault; backup excludes secrets |
| Messenger | ✅ | Official `POST /messenger/v1/.../messages` in Production mode |
| Feed | ✅ | Validate, diff, rollback, export via Feed Studio |
| Live Sync | ✅ | Workers monitored; sync lag in monitor |
| CRM | ✅ | Webhook → CRM bridge; leads in readiness |
| AI | ✅ | Read models only; live test confirms |
| Automation | ✅ | Rules/watchers in readiness + backup |
| Watchers | ✅ | Count in production readiness |
| Executive AI | ✅ | Via Automation Platform |
| Operations | ✅ | Feed export reuses Operations service |
| Analytics | ✅ | Stats scope probe in permissions |
| Production Monitoring | ✅ | `/avito/production/monitor` |
| Security | ✅ | Sandbox default; scope checks before send |
| Performance | ✅ | Request log latency; capped queries |
| Documentation | ✅ | 7 docs in `docs/` |

## Routes

- UI: `/avito/production`  
- API: `/api/avito/production/*`  
- Commerce send: `POST /api/commerce/inbox/:id/send` → local + Avito outbound  

## Before first users

1. `prisma db push`  
2. Complete Installation Wizard  
3. Switch Sandbox → Production  
4. Run Live Test for all components  
5. Score ≥ 70% on Production Readiness  

System is **Release Candidate** ready for first real users after checklist pass.

## Next: 30-day dogfooding

Before **Release 1.0**, run the system as the only interface to Avito:

- [Dogfooding Protocol](./dogfooding-protocol.md)
- [Production Backlog](./backlog/PRODUCTION_BACKLOG.md)

No architecture changes during dogfooding — backlog only.
