# Media Studio

AI media processing via **Job Engine** — all tasks async with domain events.

## Job kinds

generate_image, remove_background, enhance, infographic, banner, cover, collage, watermark, resize, presentation, pdf, video

## Events

`media.job_created`, `media.job_completed`, `media.job_failed`

## API

- `GET /api/commerce/media/jobs`
- `POST /api/commerce/media/jobs`

Jobs persist to `MediaJobReadModel`; completion emits events on `commerce` stream.
