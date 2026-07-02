# Task Center

AI and workflow-generated tasks for operators.

## Events

`task.created`, `task.completed`, `task.assigned`

## API

- `GET /api/commerce/tasks`
- `POST /api/commerce/tasks/:id/complete`

## Auto-creation

Workflow `auto-reply-task` on inbound messages; Sales Agent creates review tasks for AI drafts.

UI: `/tasks`
