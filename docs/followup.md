# Follow-up Engine

Service: `AvitoFollowUpEngineService`

Default rules on new lead:

| Delay | Trigger |
| --- | --- |
| 1 day | no_reply |
| 3 days | no_reply |
| 7 days | no_reply |
| 30 days | post_sale |

Hourly tick creates tasks + notifications via existing `TaskEngine` / `NotificationEngine`.
