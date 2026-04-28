# CI/CD Engine

A minimal Jenkins-like CI/CD control plane built with Node.js, PostgreSQL, and Redis. Accepts webhook triggers, queues builds by language, and executes pipeline stages inside Docker containers via a pool of simulated workers.

---

## Architecture

```
                        ┌─────────────────────────────────────────┐
                        │              Express Server             │
  GitHub / curl  ──────▶│  POST /webhook                          │
                        │    - verify HMAC signature              │
                        │    - fetch .cicd.yml from GitHub        │
                        │    - create build + stages in DB        │
                        │    - enqueue to Redis (by language)     │
                        └────────────────┬────────────────────────┘
                                         │
                              ┌──────────▼──────────┐
                              │    Redis Queues     │
                              │  build_queue:python │
                              │  build_queue:node   │
                              │  build_queue:java   │
                              │  build_queue:generic│
                              └──────────┬──────────┘
                                         │
              ┌──────────────────────────▼──────────────────────────┐
              │                    Worker Pool                      │
              │  worker-python-1   worker-node-1                    │
              │  worker-java-1     worker-generic-1                 │
              │                                                     │
              │  Each worker polls its own language queue first,    │
              │  falls back to generic queue if empty.              │
              │  Runs pipeline stages sequentially in Docker.       │
              └──────────────────────────┬──────────────────────────┘
                                         │
                              ┌──────────▼──────────┐
                              │     PostgreSQL      │
                              │  repositories       │
                              │  builds             │
                              │  stages             │
                              │  artifacts          │
                              └─────────────────────┘
```

### Components

| File | Role |
|---|---|
| `src/index.ts` | Entry point — starts Express and the worker pool |
| `src/app.ts` | Express app, route registration, error handler |
| `src/routes/webhook.ts` | Receives webhook, verifies HMAC, fetches `.cicd.yml`, creates build |
| `src/routes/builds.ts` | REST API for listing/reading builds, logs (SSE), cancel |
| `src/worker.ts` | Worker pool — polls Redis, runs Docker stages, updates DB |
| `src/queue.ts` | Redis queue helpers — enqueue, dequeue, depth checks |
| `src/db.ts` | PostgreSQL queries via `pg` pool |
| `src/middleware/csrf.ts` | Blocks state-changing requests without `X-Requested-With` or `X-Hub-Signature-256` |
| `src/schema.sql` | DB schema — auto-applied by Docker Compose on first run |
| `frontend/` | React + Vite dashboard |

---

## Data Flow Walkthrough

### 1. Webhook received

A `POST /webhook` arrives (from GitHub or curl) with a push payload.

- The HMAC signature in `X-Hub-Signature-256` is verified against `WEBHOOK_SECRET`
- Repository is upserted into the `repositories` table
- `.cicd.yml` is fetched from `https://raw.githubusercontent.com/<repo>/<commit>/.cicd.yml`
- Pipeline language is detected from the `image` field (e.g. `node:20` → `node`)
- A build record is inserted into `builds` with status `queued`
- Each pipeline stage is inserted into `stages`
- The build payload is pushed onto the matching Redis language queue

### 2. Worker picks up the job

Each worker runs an independent polling loop with random jitter (100–800ms between polls).

- Worker checks its own language queue first (e.g. `build_queue:node`)
- Falls back to `build_queue:generic` if its queue is empty
- On pickup: build status → `running`, workspace Docker volume is created, repo is cloned via `alpine/git`

### 3. Stage execution

Stages run sequentially inside Docker containers:

- Each stage command runs as `docker run --rm -v workspace:/workspace <image> sh -c "<command>"`
- Logs are flushed to the DB every second (simulates streaming)
- `when: always / success / failed` controls whether a stage runs based on prior stage results
- Cancellation is checked between every command by reading build status from DB

### 4. Build completion

- On success: build status → `success`
- On failure: remaining stages are skipped or run based on `when`, build status → `failed`
- On cancel: build + remaining stages → `cancelled`
- Docker workspace volume is removed after every build

### 5. Real-world simulation

- `jitter(min, max)` adds random delays before polling and before execution
- `loadFactor()` applies a random 0.5×–1.5× multiplier to stage durations
- Workers stagger startup by 500ms each to avoid thundering herd
- Queue depths are logged after each completed job

---

## Pipeline config (`.cicd.yml`)

Place this file at the root of your repository:

```yaml
pipeline:
  image: node:20

  environment:
    NODE_ENV: production

  stages:
    - name: install
      run: npm ci

    - name: test
      run: npm test

    - name: build
      run: npm run build
      when: success

    - name: notify
      run: echo "done"
      when: always

  artifacts:
    paths:
      - dist/
```

`when` values: `success` (default), `failed`, `always`

---

## Getting started

### Prerequisites

- Docker + Docker Compose
- Node.js 18+

### 1. Start infrastructure

```bash
docker-compose up -d
```

This starts PostgreSQL on port `5434` and Redis on port `6380`. The schema is applied automatically on first run.

### 2. Configure environment

```bash
cp .env.example .env
```

`.env` values:

```
PORT=4000
DATABASE_URL=postgres://jenkins:password@localhost:5434/jenkins
REDIS_URL=redis://localhost:6380
WEBHOOK_SECRET=<your-secret>        # optional — skip to disable signature verification
```

Generate a secret:
```bash
openssl rand -hex 32
```

### 3. Install and run

```bash
npm install
npm run dev:controller
```

Frontend (separate terminal):
```bash
cd frontend
npm install
npm run dev
```

Dashboard: `http://localhost:5173`
API: `http://localhost:4000`

### 4. Trigger a build

```bash
BODY='{
  "repository": { "full_name": "your/repo", "clone_url": "https://github.com/your/repo" },
  "ref": "refs/heads/main",
  "after": "<40-char-commit-sha>",
  "head_commit": { "message": "your commit message", "author": { "name": "you" } }
}'

SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "<your-secret>" | awk '{print $2}')

curl -s -X POST http://localhost:4000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIG" \
  -d "$BODY"
```


If `WEBHOOK_SECRET` is not set, omit the signature header entirely.

### Production build

```bash
npm run build
npm start
```

---

## API reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/webhook` | Receive a push webhook, create and queue a build |
| `GET` | `/builds` | List all builds (supports `?page=` `?limit=` `?repository_id=`) |
| `GET` | `/builds/:id` | Get build detail with stages and artifacts |
| `GET` | `/builds/:id/logs` | SSE stream of live stage logs |
| `POST` | `/builds/:id/cancel` | Cancel a queued or running build |
| `GET` | `/builds/:id/artifacts` | List artifacts declared in the pipeline |
| `GET` | `/workers` | Current worker pool status |
| `GET` | `/queue` | Per-language queue depths + active builds |

---

## Database schema

```
repositories   id, name, url, created_at
builds         id, repository_id, ref, commit_id, commit_message, author,
               status, language, created_at, started_at, finished_at
stages         id, build_id, name, order, status, commands, logs,
               exit_code, duration_ms, started_at, finished_at, when
artifacts      id, build_id, path, url, created_at
```
