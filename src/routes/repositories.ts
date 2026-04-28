import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { listRepositories, upsertRepository, deleteRepository, getRepositoryByName } from '../db';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    return res.json({ repositories: await listRepositories() });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, url } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'name and url are required' });

    const existing = await getRepositoryByName(name);
    if (existing) return res.status(409).json({ error: 'Repository already exists', repository: existing });

    const repo = { id: uuidv4(), name, url, created_at: new Date().toISOString() };
    await upsertRepository(repo);
    return res.status(201).json({ repository: repo });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await deleteRepository(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Repository not found' });
    return res.json({ id: req.params.id, deleted: true });
  } catch (err) { next(err); }
});

export default router;
