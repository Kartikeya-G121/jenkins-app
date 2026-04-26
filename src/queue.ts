import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6380');

const QUEUE_KEY = 'build_queue';
const IN_PROGRESS_KEY = 'build_in_progress';

export async function enqueueBuild(buildPayload: any) {
  await redis.lpush(QUEUE_KEY, JSON.stringify(buildPayload));
}

export async function dequeueBuild(timeoutSeconds = 30) {
  const result = await redis.brpoplpush(QUEUE_KEY, IN_PROGRESS_KEY, timeoutSeconds);
  if (!result) return null;
  return JSON.parse(result);
}

export async function acknowledgeBuild(buildPayload: any) {
  await redis.lrem(IN_PROGRESS_KEY, 1, JSON.stringify(buildPayload));
}
