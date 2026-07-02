# Automation Studio

Visual workflow editor (React Flow) backed by **Workflow Engine**.

## Node types

Event, Condition, Decision, Delay, AI, Action, Marketplace Action, Notification, Loop, Scheduler

## API

- `GET /api/commerce/automations`
- `POST /api/commerce/automations`

Definitions stored in `AutomationReadModel`; runtime triggers via `WorkflowEngine.register()`.

## Bootstrap workflows

- `auto-reply-task` — creates task + notification on inbound message
- `deal-ai-stage` — intelligence-driven deal stage suggestion
