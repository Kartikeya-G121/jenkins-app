# Setup & Run Instructions

Complete guide to get the CI/CD Engine running from scratch on a fresh machine.

---

## Prerequisites

Install the following before starting:

| Tool | Version | Check |
|---|---|---|
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Docker | 20+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |
| Git | any | `git --version` |

> Docker Desktop on macOS/Windows includes Docker Compose. On Linux, install it separately if `docker compose` is not found.

---

## 1. Clone the repository

```bash
git clone https://github.com/your-org/jenkins-app.git
cd jenkins-app
```

---

## 2. Start infrastructure

Start PostgreSQL and Redis using Docker Compose:

```bash
docker compose up -d
```

Verify both containers are running:

```bash
docker compose ps
```

You should see two services — `db` (PostgreSQL on port `5434`) and `redis` (Redis on port `6380`) both with status `running`.

The database schema is applied automatically on first start. If you need to reset it:

```bash
docker compose down -v
docker compose up -d
```

> The `-v` flag removes the persistent volume, wiping all data.

---

## 3. Configure environment

Copy the example env file:

```bash
cp .env.example .env
```

Open `.env` and fill in the values:

```env
PORT=4000
DATABASE_URL=postgres://jenkins:password@localhost:5434/jenkins
REDIS_URL=redis://localhost:6380
WEBHOOK_SECRET=<your-secret>
```

Generate a secure webhook secret:

```bash
openssl rand -hex 32
```

Paste the output as the value of `WEBHOOK_SECRET`. If you leave it empty or remove the line, signature verification is disabled — any request to `POST /webhook` will be accepted without a signature.

---

## 4. Install backend dependencies

From the project root:

```bash
npm install
```

---

## 5. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

---

## 6. Run the backend

```bash
npm run dev:controller
```

You should see:

```
CI/CD service listening on http://localhost:4000
Starting worker pool: worker-python-1, worker-node-1, worker-java-1, worker-generic-1
```

The backend starts the Express server and the worker pool in the same process. Workers begin polling Redis immediately.

---

## 7. Run the frontend

Open a second terminal in the project root:

```bash
cd frontend
npm run dev
```

You should see:

```
VITE ready in Xms

➜  Local:   http://localhost:5173/
```

Open `http://localhost:5173` in your browser. You should see the dashboard with the Worker Pool panel showing 4 idle workers.

---

## 8. Verify everything is connected

Check the health endpoint:

```bash
curl http://localhost:4000/
```

Expected response:

```json
{ "service": "jenkins-app", "status": "ok" }
```

Check workers:

```bash
curl http://localhost:4000/workers
```

Expected: 4 workers, all `busy: false`.

Check queue:

```bash
curl http://localhost:4000/queue
```

Expected: all depths at `0`, empty `activeBuilds`.

---

## 9. Trigger your first build

### Without signature verification

If `WEBHOOK_SECRET` is not set in `.env`:

```bash
curl -s -X POST http://localhost:4000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=dummy" \
  -d '{
    "repository": {
      "full_name": "test/repo",
      "clone_url": "https://github.com/test/repo"
    },
    "ref": "refs/heads/main",
    "after": "abc1234567890abc1234567890abc1234567890ab",
    "head_commit": {
      "message": "test build",
      "author": { "name": "dev" }
    }
  }'
```

### With signature verification

If `WEBHOOK_SECRET` is set, generate the correct HMAC:

```bash
BODY='{
  "repository": {
    "full_name": "test/repo",
    "clone_url": "https://github.com/test/repo"
  },
  "ref": "refs/heads/main",
  "after": "abc1234567890abc1234567890abc1234567890ab",
  "head_commit": {
    "message": "test build",
    "author": { "name": "dev" }
  }
}'

SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "<your-secret>" | awk '{print $2}')

curl -s -X POST http://localhost:4000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIG" \
  -d "$BODY"
```

Replace `<your-secret>` with the value of `WEBHOOK_SECRET` from your `.env`.

Expected response:

```json
{ "build_id": "uuid", "status": "queued", "priority": "high" }
```

The build will appear in the dashboard at `http://localhost:5173` within a few seconds.

> The worker will attempt to clone `https://github.com/test/repo` and fetch `.cicd.yml`. Since this repo doesn't exist, the build will fail at the setup stage — this is expected for a test payload. Use a real repo with a `.cicd.yml` file for a successful build.

---

## 10. Test with a real repository

Create a `.cicd.yml` file at the root of any GitHub repository:

```yaml
pipeline:
  image: node:20

  stages:
    - name: hello
      run: echo "Build $BUILD_ID running on $BRANCH_NAME"

    - name: done
      run: echo "All done"
      when: always
```

Then trigger a webhook pointing at that repo:

```bash
BODY='{
  "repository": {
    "full_name": "your-github-username/your-repo",
    "clone_url": "https://github.com/your-github-username/your-repo"
  },
  "ref": "refs/heads/main",
  "after": "<real-40-char-commit-sha>",
  "head_commit": {
    "message": "testing ci",
    "author": { "name": "you" }
  }
}'

SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "<your-secret>" | awk '{print $2}')

curl -s -X POST http://localhost:4000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIG" \
  -d "$BODY"
```

Get the real commit SHA from GitHub:

```bash
git rev-parse HEAD
```

---

## 11. Production build

Compile TypeScript and run without `ts-node-dev`:

```bash
# Backend
npm run build
npm start

# Frontend
cd frontend
npm run build
# Serve the dist/ folder with any static file server
npx serve dist
```

---

## Common issues

**`docker compose` not found**
Use `docker-compose` (with hyphen) if you have Docker Compose v1 installed.

**Port already in use**
Change `PORT=4000` in `.env`, or stop whatever is using port 4000:
```bash
lsof -i :4000
kill -9 <PID>
```

**PostgreSQL connection refused**
Make sure Docker containers are running: `docker compose ps`. If the `db` container is not healthy yet, wait a few seconds and retry.

**Redis connection refused**
Same as above — check `docker compose ps` and wait for the `redis` container to be running.

**`GET /queue` is slow (30s+)**
This happens if you have a stale Redis connection from a previous run. Restart the backend: `Ctrl+C` then `npm run dev:controller`.

**Build stuck in `queued` forever**
The worker couldn't dequeue the job. Check the backend terminal for errors. Restart with `Ctrl+C` and `npm run dev:controller`.

**`Invalid webhook signature` error**
The HMAC you generated doesn't match. Make sure:
- You're using the exact same `WEBHOOK_SECRET` value in both `.env` and the `openssl` command
- There are no trailing newlines in the body (`echo -n` not `echo`)
- The body passed to `openssl` is byte-for-byte identical to the body sent in the curl request
