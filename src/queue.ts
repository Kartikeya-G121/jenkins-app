import Redis from 'ioredis';
import dotenv from 'dotenv';
import { WorkerLanguage } from './types';

dotenv.config();

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6380');

const QUEUE_KEY = 'build_queue';
export const IN_PROGRESS_KEY = 'build_in_progress';

// Language-specific queues — workers drain their own queue first, then fall back to generic
export const LANGUAGE_QUEUES: Record<WorkerLanguage, string> = {
  python:  'build_queue:python',
  node:    'build_queue:node',
  java:    'build_queue:java',
  generic: 'build_queue:generic',
};

export async function enqueueBuild(buildPayload: any, language: WorkerLanguage = 'generic') {
  const key = LANGUAGE_QUEUES[language] ?? QUEUE_KEY;
  await redis.lpush(key, JSON.stringify(buildPayload));
  console.log(`Enqueued build ${buildPayload.build_id} → queue:${language}`);
}

// Try language queue first, then fall back to generic
export async function dequeueBuild(language: WorkerLanguage, timeoutSeconds = 5): Promise<any | null> {
  const primary = LANGUAGE_QUEUES[language];
  const fallback = LANGUAGE_QUEUES['generic'];

  // Non-blocking check on primary queue first
  let raw = await redis.rpoplpush(primary, IN_PROGRESS_KEY);
  if (!raw && language !== 'generic') {
    // Blocking wait on generic fallback
    raw = await redis.brpoplpush(fallback, IN_PROGRESS_KEY, timeoutSeconds);
  } else if (!raw) {
    raw = await redis.brpoplpush(primary, IN_PROGRESS_KEY, timeoutSeconds);
  }

  return raw ? JSON.parse(raw) : null;
}

export async function acknowledgeBuild(buildPayload: any) {
  await redis.lrem(IN_PROGRESS_KEY, 1, JSON.stringify(buildPayload));
}

export async function getQueueDepths(): Promise<Record<string, number>> {
  const entries = Object.entries(LANGUAGE_QUEUES);
  const lengths = await Promise.all(entries.map(([, key]) => redis.llen(key)));
  return Object.fromEntries(entries.map(([lang], i) => [lang, lengths[i]]));
}
