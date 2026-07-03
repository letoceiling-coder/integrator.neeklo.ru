# Media Studio Pro

API: `POST /api/avito/operations/media/jobs`, `GET media/assets`

Extends `MediaPipelineService` + `JobEngine`.

## Operations

| Kind | Pipeline behavior |
| --- | --- |
| watermark | SVG overlay |
| resize | SVG dimensions from input |
| banner / infographic | AI text + SVG layout |
| remove_background / enhance | Requires `AI_IMAGE_PROVIDER` ≠ stub |
| generate_image | OpenRouter / stub SVG |

All outputs → Selectel S3 via `ObjectStorageService`.
