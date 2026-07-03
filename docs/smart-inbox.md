# Smart Inbox

API: `GET /api/avito/sales/inbox?conversationId=`

3-panel layout:

- **Left:** conversations (Commerce read model)
- **Center:** messages + send (`/commerce/inbox/:id/send`)
- **Right:** Customer 360 + lead + pipeline stage

Data source: existing `ConversationReadModel` populated by CRM bridge from Avito messenger.
