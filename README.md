# Jenkins App

Minimal CI/CD control plane implementation based on `cicd_prd (1).docx`.

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Run in development mode:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
npm start
```

## API

- `POST /webhook`
- `GET /builds`
- `GET /builds/:id`
- `GET /builds/:id/logs`
- `POST /builds/:id/cancel`
- `GET /builds/:id/artifacts`

## Developer notes

- SQLite is used for the initial implementation.
- Worker polling is implemented in `src/worker.ts`.
- Pipelines are accepted as JSON payloads via webhook.
