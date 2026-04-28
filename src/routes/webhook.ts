import crypto from 'crypto';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import yaml from 'yaml';
import { addStages, createArtifact, createBuild, getRepositoryByName, upsertRepository } from '../db';
import { csrfProtection } from '../middleware/csrf';
import { enqueueBuild } from '../queue';

import { WorkerLanguage } from '../types';

const router = Router();

router.use(csrfProtection);

function verifySignature(rawBody: string | undefined, signatureHeader?: string) {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) return true;
  if (!signatureHeader || !rawBody) return false;

  if (!signatureHeader.startsWith('sha256=')) return false;
  const sent = Buffer.from(signatureHeader.slice('sha256='.length), 'hex');
  const expected = Buffer.from(crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex'), 'hex');

  if (sent.length !== expected.length) return false;
  return crypto.timingSafeEqual(sent, expected);
}

function detectLanguage(pipeline: any): WorkerLanguage {
  const image: string = (pipeline?.image || '').toLowerCase();
  if (image.includes('python')) return 'python';
  if (image.includes('node') || image.includes('npm') || image.includes('bun')) return 'node';
  if (image.includes('java') || image.includes('maven') || image.includes('gradle')) return 'java';
  return 'generic';
}

router.post('/', async (req, res) => {
  const payload = req.body;

  if (!verifySignature((req as any).rawBody, req.header('X-Hub-Signature-256'))) {
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  // Handle both standard GitHub push format and old custom payload
  const repoName = payload.repository?.full_name || payload.repository?.name;
  const repoUrl = payload.repository?.clone_url || payload.repository?.url;
  const commitId = payload.after || payload.commit?.id;
  const commitMessage = payload.head_commit?.message || payload.commit?.message || 'Webhook trigger';
  const author = payload.head_commit?.author?.name || payload.commit?.author || 'Unknown';
  const ref = payload.ref;

  if (!repoName || !commitId) {
    return res.status(400).json({ error: 'Invalid webhook payload: missing repository or commit details.' });
  }

  const now = new Date().toISOString();
  let repository = await getRepositoryByName(repoName);
  let repoId;
  if (!repository) {
    repoId = uuidv4();
    await upsertRepository({
      id: repoId,
      name: repoName,
      url: repoUrl,
      created_at: now,
    });
  } else {
    repoId = repository.id;
  }

  // Fetch .cicd.yml from GitHub before creating the build so we know the language
  const rawUrl = `https://raw.githubusercontent.com/${repoName}/${commitId}/.cicd.yml`;
  let pipeline: any = null;

  try {
    const response = await axios.get(rawUrl, { timeout: 5000 });
    const parsed = yaml.parse(response.data);
    pipeline = parsed.pipeline;
  } catch (error: any) {
    console.error(`Failed to fetch or parse .cicd.yml for ${repoName}@${commitId}: ${error.message}`);
  }

  const language = detectLanguage(pipeline);

  const buildId = uuidv4();
  await createBuild({
    id: buildId,
    repository_id: repoId,
    ref: ref || '',
    commit_id: commitId,
    commit_message: commitMessage,
    author: author,
    status: 'queued',
    language,
    created_at: now,
    started_at: null,
    finished_at: null,
  });

  if (!pipeline || !pipeline.stages || !pipeline.stages.length) {
    await addStages([{
      id: uuidv4(),
      build_id: buildId,
      name: 'System Error',
      order: 0,
      status: 'failed',
      commands: [],
      logs: 'Could not fetch or parse .cicd.yml at this commit.\n',
      exit_code: 1,
      duration_ms: 0,
      started_at: now,
      finished_at: now,
    }]);
  } else {
    const stageRecords = pipeline.stages.map((stage: any, index: number) => ({
      id: uuidv4(),
      build_id: buildId,
      name: stage.name || `Stage ${index + 1}`,
      order: index,
      status: 'queued' as const,
      commands: stage.run ? [stage.run] : (stage.commands || []),
      logs: '',
      exit_code: null,
      duration_ms: null,
      started_at: null,
      finished_at: null,
      when: stage.when,
    }));

    await addStages(stageRecords);

    if (pipeline.artifacts?.paths) {
      for (const path of pipeline.artifacts.paths) {
        await createArtifact({
          id: uuidv4(),
          build_id: buildId,
          path,
          url: '',
          created_at: now,
        });
      }
    }
  }

  await enqueueBuild({
    build_id: buildId,
    repository: { name: repoName, url: repoUrl },
    commit_sha: commitId,
    branch: ref,
    pipeline,
    language,
  }, language);

  return res.status(201).json({ build_id: buildId, status: 'queued' });
});

export default router;
