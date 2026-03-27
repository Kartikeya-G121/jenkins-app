import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { addStages, createBuild, getRepository, upsertRepository } from '../db';
import { PipelinePayload } from '../types';

const router = Router();

router.post('/', (req, res) => {
  const payload = req.body as PipelinePayload;

  if (!payload?.repository || !payload?.pipeline?.stages?.length) {
    return res.status(400).json({ error: 'Invalid webhook payload.' });
  }

  const now = new Date().toISOString();
  const repoId = payload.repository.id;

  const repository = getRepository(repoId);
  if (!repository) {
    upsertRepository({
      id: repoId,
      name: payload.repository.name,
      url: payload.repository.url,
      created_at: now,
    });
  }

  const buildId = uuidv4();
  createBuild({
    id: buildId,
    repository_id: repoId,
    ref: payload.ref,
    commit_id: payload.commit.id,
    commit_message: payload.commit.message,
    author: payload.commit.author,
    status: 'queued',
    created_at: now,
    started_at: null,
    finished_at: null,
  });

  const stageRecords = payload.pipeline.stages.map((stage, index) => ({
    id: uuidv4(),
    build_id: buildId,
    name: stage.name,
    order: index,
    status: 'queued' as const,
    commands: stage.commands,
    logs: '',
    started_at: null,
    finished_at: null,
  }));

  addStages(stageRecords);

  return res.status(201).json({ build_id: buildId, status: 'queued' });
});

export default router;
