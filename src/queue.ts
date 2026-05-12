import Redis from 'ioredis';
import dotenv from 'dotenv';
import { WorkerLanguage, BuildPriority } from './types';

dotenv.config();

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6380');

// Separate connection for non-blocking reads (HTTP endpoints)
export const redisReader = new Redis(process.env.REDIS_URL || 'redis://localhost:6380');

export const IN_PROGRESS_KEY = 'build_in_progress';

// Language-specific sorted set queues
export const LANGUAGE_QUEUES: Record<WorkerLanguage, string> = {
  python:  'build_queue:python',
  node:    'build_queue:node',
  java:    'build_queue:java',
  generic: 'build_queue:generic',
};

// Lower score = higher priority (ZPOPMIN pops lowest score first)
// Within same priority, earlier enqueue time = lower score = picked first (FIFO)
const PRIORITY_SCORE: Record<BuildPriority, number> = {
  high:   1_000_000_000_000,
  normal: 2_000_000_000_000,
  low:    3_000_000_000_000,
};

export function getBranchPriority(ref: string): BuildPriority {
  const branch = ref.replace('refs/heads/', '').toLowerCase();

  if (
    branch === 'main' ||
    branch === 'master' ||
    branch === 'production' ||
    branch === 'prod' ||
    branch.startsWith('release/') ||
    branch.startsWith('hotfix/')
  ) return 'high';

  if (
    branch === 'staging' ||
    branch === 'stage' ||
    branch === 'preprod' ||
    branch === 'pre-prod' ||
    branch === 'uat' ||
    branch === 'demo'
  ) return 'normal';

  if (
    branch === 'develop' ||
    branch === 'development' ||
    branch === 'dev' ||
    branch.startsWith('feature/') ||
    branch.startsWith('feat/') ||
    branch.startsWith('fix/') ||
    branch.startsWith('chore/') ||
    branch.startsWith('refactor/')
  ) return 'low';

  return 'normal';
}

export async function enqueueBuild(
  buildPayload: any,
  language: WorkerLanguage = 'generic',
  priority: BuildPriority = 'normal',
) {
  const key = LANGUAGE_QUEUES[language];
  // Score = priority base + ms timestamp → FIFO within same priority level
  const score = PRIORITY_SCORE[priority] + Date.now();
  await redis.zadd(key, score, JSON.stringify(buildPayload));
  console.log(`Enqueued build ${buildPayload.build_id} → queue:${language} priority:${priority} score:${score}`);
}

export async function dequeueBuild(language: WorkerLanguage): Promise<any | null> {
  const primary  = LANGUAGE_QUEUES[language];
  const fallback = LANGUAGE_QUEUES['generic'];

  // Atomically pop the lowest-score (highest priority) job using a Lua script
  // to ensure no race condition between check and pop
  const luaPop = `
    local result = redis.call('ZPOPMIN', KEYS[1], 1)
    if #result > 0 then
      redis.call('LPUSH', KEYS[2], result[1])
      return result[1]
    end
    return nil
  `;

  let raw = await redis.eval(luaPop, 2, primary, IN_PROGRESS_KEY) as string | null;

  if (!raw && language !== 'generic') {
    raw = await redis.eval(luaPop, 2, fallback, IN_PROGRESS_KEY) as string | null;
  }

  return raw ? JSON.parse(raw) : null;
}

export async function acknowledgeBuild(buildPayload: any) {
  await redis.lrem(IN_PROGRESS_KEY, 1, JSON.stringify(buildPayload));
}

export async function getQueueDepths(): Promise<Record<string, number>> {
  const entries = Object.entries(LANGUAGE_QUEUES);
  const lengths = await Promise.all(entries.map(([, key]) => redisReader.zcard(key)));
  return Object.fromEntries(entries.map(([lang], i) => [lang, lengths[i]]));
}
