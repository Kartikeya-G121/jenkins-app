import { Router } from 'express';
import { listBuilds, getBuild, getStages, getArtifacts, cancelBuild } from '../db';

const router = Router();

router.get('/', (_req, res) => {
  const builds = listBuilds();
  return res.json({ builds });
});

router.get('/:id', (req, res) => {
  const build = getBuild(req.params.id);
  if (!build) {
    return res.status(404).json({ error: 'Build not found' });
  }

  const stages = getStages(req.params.id);
  const artifacts = getArtifacts(req.params.id);
  return res.json({ build, stages, artifacts });
});

router.get('/:id/logs', (req, res) => {
  const stages = getStages(req.params.id);
  if (!stages.length) {
    return res.status(404).json({ error: 'Logs not found for build' });
  }

  const logs = stages.map((stage) => ({ name: stage.name, status: stage.status, logs: stage.logs }));
  return res.json({ logs });
});

router.post('/:id/cancel', (req, res) => {
  const build = getBuild(req.params.id);
  if (!build) {
    return res.status(404).json({ error: 'Build not found' });
  }
  if (['success', 'failed', 'cancelled'].includes(build.status)) {
    return res.status(400).json({ error: 'Build cannot be cancelled' });
  }

  const cancelled = cancelBuild(req.params.id);
  if (!cancelled) {
    return res.status(500).json({ error: 'Unable to cancel build' });
  }

  return res.json({ id: req.params.id, status: 'cancelled' });
});

router.get('/:id/artifacts', (req, res) => {
  const artifacts = getArtifacts(req.params.id);
  return res.json({ artifacts });
});

export default router;
