import { Router } from 'express';
import { listBuilds, getBuild, getStages, getArtifacts, cancelBuild } from '../db';
import { csrfProtection } from '../middleware/csrf';

// We no longer have requestCancelBuild locally in the same process.
// For cancellation, we will need to publish to redis, or let the worker periodically check DB status.
// The PRD mentions workers checking cancel status, or we can use Redis Pub/Sub if needed.
// For the MVP, if we set status = 'cancelled' in the DB, the worker can check it, or we can push a cancel message.

const router = Router();

router.use(csrfProtection);

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const repoId = req.query.repository_id?.toString();

    let builds = await listBuilds();
    if (repoId) builds = builds.filter((b) => b.repository_id === repoId);

    const total = builds.length;
    const offset = (page - 1) * limit;
    return res.json({ builds: builds.slice(offset, offset + limit), pagination: { page, limit, total } });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const build = await getBuild(req.params.id);
    if (!build) return res.status(404).json({ error: 'Build not found' });
    const [stages, artifacts] = await Promise.all([getStages(req.params.id), getArtifacts(req.params.id)]);
    return res.json({ build, stages, artifacts });
  } catch (err) { next(err); }
});

router.get('/:id/logs', async (req, res) => {
  const buildId = req.params.id;
  const stages = await getStages(buildId);

  if (!stages.length) {
    return res.status(404).json({ error: 'Logs not found for build' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let sentBytes = 0;

  const publish = async () => {
    const refreshed = await getStages(buildId);
    for (const stage of refreshed) {
      const lines = stage.logs ? stage.logs.split(/\r?\n/) : [];
      let idx = 0;
      while (idx < lines.length) {
        const line = lines[idx++] || '';
        const event = {
          ts: new Date().toISOString(),
          stage: stage.name,
          stream: 'combined',
          line,
          stage_status: stage.status,
        };
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    }
    sentBytes += 1;
  };

  const interval = setInterval(async () => {
    await publish();
    const finalStages = await getStages(buildId);
    if (finalStages.every((stage) => ['success', 'failed', 'cancelled', 'skipped'].includes(stage.status))) {
      res.write(`data: ${JSON.stringify({ event: 'build.complete', status: finalStages.some((s) => s.status === 'failed') ? 'failed' : 'success' })}\n\n`);
      clearInterval(interval);
      res.end();
    }
  }, 1500);

  req.on('close', () => {
    clearInterval(interval);
  });
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const build = await getBuild(req.params.id);
    if (!build) return res.status(404).json({ error: 'Build not found' });
    if (['success', 'failed', 'cancelled'].includes(build.status))
      return res.status(400).json({ error: 'Build cannot be cancelled' });
    const cancelled = await cancelBuild(req.params.id);
    if (!cancelled) return res.status(500).json({ error: 'Unable to cancel build' });
    return res.json({ id: req.params.id, status: 'cancelled' });
  } catch (err) { next(err); }
});

router.get('/:id/artifacts', async (req, res, next) => {
  try {
    return res.json({ artifacts: await getArtifacts(req.params.id) });
  } catch (err) { next(err); }
});

export default router;
