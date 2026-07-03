# Backup

API: `GET /api/avito/production/backup/export`, `POST /api/avito/production/backup/import`

Exports (no secrets):

- Automation rules  
- Notification policies  
- AI agent configs  
- Watchers  
- Feed export history  
- CRM templates  

Stored in `AvitoBackupSnapshotReadModel`. Credentials remain in Credential Vault only.
