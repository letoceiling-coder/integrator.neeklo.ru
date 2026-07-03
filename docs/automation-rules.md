# Automation Rules

API: `GET/PUT /api/avito/automation/rules`, `POST /api/avito/automation/rules/evaluate`

User-defined rules with conditions and actions.

## Examples

| Condition | Action |
| --- | --- |
| CTR dropped 30% | Create recommendation |
| No messages 3 days | Suggest photo change (task) |
| AI confidence ≥ 95% | Recommendation only (no auto-send) |
| Budget ends in 2 days | Notify via policy channels |

## Safety

All rules default to `requiresConfirmation: true`. No irreversible actions (price change, message send, ad publish) without explicit user approval.

Read model: `AvitoAutomationRuleReadModel`
